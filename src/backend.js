const express = require("express");
const session = require("express-session");
const axios = require('axios/dist/browser/axios.cjs');
const path = require("path");
require("dotenv").config();
const fs = require("fs");
const WebSocket = require("ws");
const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");



const app = express();
const app_id = 61696;



const connection = new WebSocket(
  `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
);

connection.onopen = () => {
  console.log("WebSocket connection established.");
};

connection.onerror = (error) => {
  console.error("WebSocket error:", error);
};

const api = new DerivAPI({ connection });
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

const ping = () => {
  setInterval(() => {
    if (basic) {
      basic.ping();
    }
  }, 30000);
};

// --- LOGIN PAGE ---
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --- LOGIN AUTH ---
app.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;

    const clientsPath = path.join(__dirname, "public", "clients.json");
    const clientsData = JSON.parse(fs.readFileSync(clientsPath, "utf8"));

    const user = clientsData.customers.find(
      c =>
        c.clientUsername === username &&
        c.clientPassword === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    // Save session
    req.session.user = {
      username: user.clientUsername,
      loginTime: Date.now()
    };

    // Redirect to Deriv OAuth
    return res.json({
      success: true,
      redirect: `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}`
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


app.get("/sign-in", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "public", "sign-in.html"));
  }
  catch (err) {
    console.log(err);
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


app.get("/redirect", async (req, res) => {
  const { acct1, token1, cur1, acct2, token2, cur2 } = req.query;

  const accounts = [
    { account: acct1, token: token1, currency: cur1 },
    { account: acct2, token: token2, currency: cur2 }
  ];

  if (!basic) {
    console.error("DerivAPI basic is not initialized.");
    return res.status(500).send("API not initialized");
  }

  try {
    let currentLoginId = null;
    let userToken = null;
    const loginIds = [];

    // 🔥 Authorize only accounts that have tokens
    for (const acc of accounts) {
      if (!acc.token) continue;

      try {
        const response = await basic.authorize(acc.token);

        if (response?.authorize) {
          userToken = acc.token; // last successful token

          // build login ID list
          response.authorize.account_list.forEach(a => {
            loginIds.push(a.loginid);
          });

          // current login id
          currentLoginId = response.authorize.loginid;
        }
      } catch (err) {
        console.error("Authorization failed:", err.message);
      }
    }

    console.log("All user login IDs:", loginIds);
    console.log("Current login ID:", currentLoginId);

    // ⛔ No valid login found → do not reload page
    if (!currentLoginId) {
      return res.send(`
        <h2 style="font-family: sans-serif; color: #444;">Authorization Failed</h2>
        <p>No valid Deriv login ID found.</p>
        <p>Please try again.</p>
      `);
    }

    // 🎯 SUCCESS → Clean redirect to sign-in page
    const redirectUrl = `/sign-in?token1=${token1}&token2=${token2}`;
    console.log("Redirecting to:", redirectUrl);

    return res.redirect(redirectUrl);

  } catch (error) {
    console.error("Redirect process error:", error);
    return res.status(500).send("Internal Server Error");
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
