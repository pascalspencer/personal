const express = require("express");
const session = require("express-session");
const axios = require('axios/dist/browser/axios.cjs');
const path = require("path");
require("dotenv").config();
const fs = require("fs");
const deviceSessions = require('./deviceSessions');
const WebSocket = require("ws");
const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");



const app = express();
const app_id = 61696;




// --- Robust WebSocket connection management ---
let wsConnection = null;
let wsReconnectAttempts = 0;
const maxReconnects = 10;
const reconnectDelay = 3000;

function createWebSocket() {
  wsConnection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);

  wsConnection.onopen = () => {
    wsReconnectAttempts = 0;
    console.log("WebSocket connection established.");
  };

  wsConnection.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  wsConnection.onclose = () => {
    if (wsReconnectAttempts < maxReconnects) {
      wsReconnectAttempts++;
      console.warn(`WebSocket closed. Attempting reconnect #${wsReconnectAttempts} in ${reconnectDelay}ms.`);
      setTimeout(createWebSocket, reconnectDelay);
    } else {
      console.error("Max WebSocket reconnect attempts reached.");
    }
  };
}

createWebSocket();

const api = new DerivAPI({ connection: wsConnection });
const basic = api.basic;

const active_symbols_request = {
  active_symbols: "brief",
  product_type: "basic",
};

// Initialize marketsData with Sets
const marketsData = {
  forex: [],
  indices: [],
  commodities: [],
  cryptocurrency: [],
  synthetic_index: [],
};

const tradeData = {
  up_and_down: ["Rise/Fall"],
  digits: ["Matches/Differs", "Even/Odd", "Over/Under"],
};


app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: "zodiac_deriv",
    resave: false,
    saveUninitialized: true,
    // store: MongoStore.create({
    //   mongoUrl: mongoUri,
    //   collectionName: 'sessions',
    //   ttl: 14 * 24 * 60 * 60 // 14 days (time to live)
    // }),
    cookie: { secure: true }, // Set to true if using HTTPS
  })
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// --- Keep WebSocket alive with periodic ping ---
const ping = () => {
  setInterval(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      try {
        wsConnection.send(JSON.stringify({ ping: 1 }));
      } catch (e) {
        // Ignore send errors
      }
    }
  }, 20000); // 20s interval for better reliability
};

// // --- LOGIN PAGE ---
// app.get("/login", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "login.html"));
// });

// // --- LOGIN AUTH ---
// app.post("/login", (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const clientsPath = path.join(__dirname, "public", "clients.json");
//     const clientsData = JSON.parse(fs.readFileSync(clientsPath, "utf8"));

//     const user = clientsData.customers.find(
//       c =>
//         c.clientUsername === username &&
//         c.clientPassword === password
//     );

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid username or password"
//       });
//     }

//     // Enforce max 2 devices per username (skip exempt users)
//     try {
//       const usernameKey = user.clientUsername;
//       if (!deviceSessions.isExempt(usernameKey)) {
//         const sessions = deviceSessions.getSessions(usernameKey);
//         const alreadyHas = sessions.some(s => s.sessionId === req.sessionID);
//         if (!alreadyHas && sessions.length >= 2) {
//           return res.status(403).json({
//             success: false,
//             message: "Maximum 2 devices allowed for this account. Please logout from another device."
//           });
//         }
//       }
//     } catch (err) {
//       console.error('Device session check failed:', err);
//     }

//     // Save session
//     req.session.user = {
//       username: user.clientUsername,
//       loginTime: Date.now()
//     };

//     // record device/session
//     try {
//       deviceSessions.addSession(user.clientUsername, req.sessionID, {
//         ip: req.ip || req.connection?.remoteAddress,
//         ua: req.get('User-Agent') || ''
//       });
//     } catch (err) {
//       console.error('Failed to record device session:', err);
//     }

//     // Redirect to Deriv OAuth
//     return res.json({
//       success: true,
//       redirect: `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}`
//     });

//   } catch (err) {
//     console.error("Login error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });


app.get("/sign-in", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "public", "sign-in.html"));
  }
  catch (err) {
    console.log(err);
  }
});

// --- LOGOUT ---
app.post('/logout', (req, res) => {
  try {
    const sid = req.sessionID;
    // remove from device tracking
    try {
      deviceSessions.removeSession(sid);
    } catch (e) {
      console.error('Error removing device session:', e);
    }

    req.session.destroy(err => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ success: false, message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post("/trade", (req, res) => {
  try {
    const accountType = (req.body && req.body.accountType) ? String(req.body.accountType) : '';
    // Normalize to expected values
    const acct = (accountType.toLowerCase() === 'demo') ? 'demo' : 'real';

    // Redirect to the static trade page and include the selected account type
    return res.redirect(`/trade.html?accountType=${encodeURIComponent(acct)}`);
  } catch (err) {
    console.error('Error handling /trade POST:', err);
    return res.sendFile(path.join(__dirname, "public", "trade.html"));
  }
});

app.get('/trade/instruments', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'trading_instruments.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading JSON file:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.json(JSON.parse(data));
  });
});


// --- Fetch Active Symbols via DerivAPI ---
const fetchActiveSymbols = async () => {
  try {
    const response = await basic.activeSymbols({
      active_symbols: "brief",
      product_type: "basic"
    });

    if (!response || !response.active_symbols) {
      throw new Error("Invalid API response");
    }

    // Reset marketsData
    const formatted = {
      forex: [],
      indices: [],
      commodities: [],
      cryptocurrency: [],
      synthetic_index: []
    };

    response.active_symbols.forEach(item => {
      const market = item.market;
      if (formatted[market]) {
        formatted[market].push({
          symbol: item.symbol,          // to send in buyContract
          display_name: item.display_name  // to show in dropdown
        });
      }
    });

    return formatted;

  } catch (err) {
    console.error("Error fetching active symbols:", err.message);
    return {};
  }
};

// --- API endpoint ---
app.get("/api/data", async (req, res) => {
  const symbols = await fetchActiveSymbols();
  if (!symbols || Object.keys(symbols).length === 0) {
    return res.status(500).json({ error: "Failed to fetch instruments" });
  }
  res.json(symbols);
});


app.get("/redirect", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "redirect-loader.html"));
});

app.post("/api/process-redirect", async (req, res) => {
  // Accept tokens/accounts as arrays for flexibility
  let tokens = req.query.tokens;
  let accounts = req.query.accounts;
  let currencies = req.query.currencies;

  // Dynamically collect all tokenN/acctN/curN parameters (token1, token2, ...)
  if (!Array.isArray(tokens)) {
    tokens = [];
    let i = 1;
    while (req.query[`token${i}`]) {
      tokens.push(req.query[`token${i}`]);
      i++;
    }
  }
  if (!Array.isArray(accounts)) {
    accounts = [];
    let i = 1;
    while (req.query[`acct${i}`]) {
      accounts.push(req.query[`acct${i}`]);
      i++;
    }
  }
  if (!Array.isArray(currencies)) {
    currencies = [];
    let i = 1;
    while (req.query[`cur${i}`]) {
      currencies.push(req.query[`cur${i}`]);
      i++;
    }
  }

  // Build account objects
  const accountObjs = [];
  for (let i = 0; i < tokens.length; i++) {
    accountObjs.push({
      token: tokens[i],
      account: accounts[i] || null,
      currency: currencies[i] || null
    });
  }

  if (!basic) {
    console.error("DerivAPI basic is not initialized.");
    return res.status(500).json({ error: "API not initialized" });
  }

  try {
    // Map of loginid -> {token, currency, is_virtual}
    const loginMap = {};
    let currentLoginId = null;
    let selectedAccounts = [];

    // Authorize each token and collect account info
    for (const acc of accountObjs) {
      if (!acc.token) continue;
      try {
        const response = await basic.authorize(acc.token);
        if (response?.authorize) {
          // Only add the loginid that matches the account in the query string
          const loginid = response.authorize.loginid;
          if (loginid && acc.account && loginid === acc.account) {
            loginMap[loginid] = {
              token: acc.token,
              currency: acc.currency,
              is_virtual: response.authorize.is_virtual
            };
          }
          currentLoginId = loginid;
        }
      } catch (err) {
        console.error("Authorization failed:", err.message);
      }
    }

    // Build list of available accounts (real, demo, others) using the original mapping
    selectedAccounts = accounts.map((loginid, idx) => {
      const info = loginMap[loginid];
      if (!info) return null;
      return {
        loginid,
        token: info.token,
        currency: info.currency,
        type: info.is_virtual ? 'demo' : 'real'
      };
    }).filter(Boolean);

    // If more than 2 tokens/accounts, include all in sign-in
    // (frontend should show all available accounts for selection)

    // Validate that when an account is selected, its token matches
    // (frontend: pass selected loginid, backend: find correct token)

    // If no valid login found
    if (!currentLoginId) {
      // Return a redirect to home with error param instead of HTML, 
      // so the loader can handle the "bad request" scenario gracefully via redirect
      return res.json({
        redirectUrl: '/index.html?error=auth_failed'
      });
    }

    // Build redirect URL with all available accounts/tokens
    // Pass as arrays for frontend to handle selection
    const redirectUrl = `/sign-in?accounts=${encodeURIComponent(JSON.stringify(selectedAccounts))}`;
    console.log("Redirecting to:", redirectUrl);

    return res.json({ redirectUrl });

  } catch (error) {
    console.error("Redirect process error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/trade/data", (req, res) => {
  res.json(tradeData);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  ping(); // Start the pinging process to keep the WebSocket connection alive
});

export default app;
