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
  Multipliers: ["Up/Down"],
  up_and_down: ["Rise/Fall", "Higher/Lower"],
  high_and_low: ["Touch/No Touch"],
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

app.get("/sign-in", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "public", "sign-in.html"));
  }
  catch (err) {
    console.log(err);
  }
});


app.post("/trade", (req, res) => {
  const filePath = path.resolve(__dirname, "public", "clients.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Internal Server Error");
    }

    try {
      const jsonData = JSON.parse(data);
      const { usernameClient, passwordClient } = req.body;
      const customers = jsonData.customers;

      const client = customers.find(
        (customer) =>
          customer.clientUsername === usernameClient &&
          customer.clientPassword === passwordClient
      );

      let deviceIp = [];
      async function getPublicIP() {
        try {
          const response = await axios.get('https://api.ipify.org?format=json');
          const ipResponse = response.data.ip
          return ipResponse;
        } catch (error) {
          console.error('Error fetching IP address:', error);
          throw error;
        }
      }

      if (client) {
        getPublicIP()
          .then((deviceIpAddress) => {
            deviceIp.push(deviceIpAddress);
            if (deviceIp.length > 2) {
              return res.status(400).send("Too many devices");
            }
            // req.session.authenticated = true;
            return res.sendFile(path.join(__dirname, "public", "trade.html"));
          })
          .catch((error) => {
            console.error('Error fetching IP address:', error);
            return res.status(500).send("Internal Server Error");
          });
      } else {
        return res.status(401).send("Invalid username or password");
      }
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return res.status(500).send("Internal Server Error");
    }
  });
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

  const user_accounts = [
    { account: acct1, token: token1, currency: cur1 },
    { account: acct2, token: token2, currency: cur2 },
  ];

  if (!basic) {
    console.error("DerivAPI basic is not initialized.");
    return res.sendStatus(500);
  }

  
  try {

    const loginIds = [];
    let currentLoginId = null
    let userToken = null;
    

    for (const account of user_accounts) {
      if (account.token) {
        console.log(`Authorizing account with token: ${account.token}`);
        userToken = account.token;
        try {
          const jsonResponse = await basic.authorize(account.token);
          console.log(JSON.stringify(jsonResponse.authorize.account_list, null, 2));

          if (jsonResponse && jsonResponse.authorize) {
            const authorizeJson = jsonResponse.authorize;
            
            if (authorizeJson.account_list) {
              authorizeJson.account_list.forEach(acc => {
                loginIds.push(acc.loginid);
                console.log(`Added login ID: ${acc.loginid}`);
              });
              console.log('Current login IDs:', loginIds);
            }

            if (authorizeJson.loginid) {
              currentLoginId = authorizeJson.loginid;
              console.log(`Current login ID set to: ${currentLoginId}`);
            }
          }
        } catch (error) {
          console.error('Error authorizing account:', error);
        }
      } else {
        console.log('No token found for this account.');
      }
    }

    const allUserIds  = loginIds;
    const currentUserId = currentLoginId
    console.log(`Current login id stored in session ${currentUserId}`);

    if (currentUserId) {
      // Successful authorization, redirect immediately
      return res.redirect(`/sign-in?currentLoginId=${currentLoginId}&userToken=${userToken}`);
    } else {
        // Authorization failed, refresh first and then redirect
        return res.send(`
            <script>
                setTimeout(() => {
                    location.reload();
                }, 1000); // Refresh after 1 second
                
                setTimeout(() => {
                    window.location.href = "/sign-in?currentLoginId=${currentUserId}";
                }, 3000); // Redirect after 3 seconds
            </script>
        `);
    }


 } catch (error) {
    console.error("Error authorizing accounts:", error);
    res.sendStatus(500);
  }
});

// console.log(`login id array stored outside session ${currentLoginId}`);




app.get("/trade/data", (req, res) => {
  res.json(tradeData);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  ping(); // Start the pinging process to keep the WebSocket connection alive
});

export default app;
