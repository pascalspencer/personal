import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import DerivAPI from "@deriv/deriv-api/dist/DerivAPI.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();


const app = express();
const app_id = 61696;


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  forex: new Set(),
  indices: new Set(),
  commodities: new Set(),
  cryptocurrency: new Set(),
  synthetic_index: new Set(),
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
  res.sendFile(path.join(__dirname, "public", "sign-in.html"));
});

const activeSymbolsResponse = async (res) => {
  const data = JSON.parse(res.data);

  if (data.error) {
    console.error("Error:", data.error.message);
    connection.removeEventListener("message", activeSymbolsResponse);
    await basic.disconnect();
    return;
  }

  if (data.msg_type === "active_symbols") {
    const contractsData = data.active_symbols;
    for (const contract of contractsData) {
      const market = contract.market;
      // Ensure marketsData[market] is a Set
      if (!(marketsData[market] instanceof Set)) {
        marketsData[market] = new Set();
      }
      marketsData[market].add(contract.display_name);
    }

    // Convert sets back to arrays if needed
    for (const market in marketsData) {
      marketsData[market] = Array.from(marketsData[market]);
    }

    connection.removeEventListener("message", activeSymbolsResponse);
  }
};

const getActiveSymbols = async () => {
  connection.addEventListener("message", activeSymbolsResponse);
  await basic.activeSymbols(active_symbols_request);
};

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

      if (client) {
        req.session.authenticated = true;
        return res.sendFile(path.join(__dirname, "public", "trade.html"));
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


app.get("/api/data", (req, res) => {
  getActiveSymbols()
    .then(() => {
      res.json(marketsData);
    })
    .catch((error) => {
      console.error("Error getting active symbols:", error);
      res.status(500).json({ error: "Internal Server Error" });
    });
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
    for (const account of user_accounts) {
      if (account.token) {
        console.log("Authorizing account ...");
        await basic.authorize(account.token);
      }
    }

    req.session.token1 = token1;

    res.redirect("/sign-in");
  } catch (error) {
    console.error("Error authorizing accounts:", error);
    res.sendStatus(500);
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
