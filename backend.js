const express = require('express');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const WebSocket = require('ws');
const DerivAPI = require('@deriv/deriv-api/dist/DerivAPI');

const app = express();

const connection = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=61696');
const api = new DerivAPI({ connection });
const basic = api.basic;

const active_symbols_request = {
  active_symbols: 'brief',
  product_type: 'basic',
};

// Initialize marketsData with Sets
const marketsData = {
  forex: new Set(),
  indices: new Set(),
  commodities: new Set(),
  cryptocurrency: new Set(),
  synthetic_index: new Set()
};

const tradeData = {
  Multipliers: ["Up/Down"],
  up_and_down: ["Rise/Fall", "Higher/Lower"],
  high_and_low: ["Touch/No Touch"],
  digits: ["Matches/Differs", "Even/Odd", "Over/Under"]
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const ping = () => {
  setInterval(() => {
    basic.ping();
  }, 30000);
};

const activeSymbolsResponse = async (res) => {
  const data = JSON.parse(res.data);

  if (data.error) {
    console.error('Error:', data.error.message);
    connection.removeEventListener('message', activeSymbolsResponse);
    await basic.disconnect();
    return;
  }

  if (data.msg_type === 'active_symbols') {
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

    connection.removeEventListener('message', activeSymbolsResponse);
  }
};

const getActiveSymbols = async () => {
  connection.addEventListener('message', activeSymbolsResponse);
  await basic.activeSymbols(active_symbols_request);
};

app.get('/sign-in', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sign-in.html'));
});

app.post('/trade', (req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'clients.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Internal Server Error');
    }

    try {
      const jsonData = JSON.parse(data);
      const { usernameClient, passwordClient } = req.body;
      const customers = jsonData.customers;

      const client = customers.find(customer => 
        customer.clientUsername === usernameClient && customer.clientPassword === passwordClient
      );

      if (client) {
        return res.sendFile(path.join(__dirname, 'public', 'trade.html'));
      } else {
        return res.status(401).send('Invalid username or password');
      }
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return res.status(500).send('Internal Server Error');
    }
  });
});

app.get('/api/data', (req, res) => {
  getActiveSymbols()
    .then(() => {
      res.json(marketsData);
    })
    .catch(error => {
      console.error('Error getting active symbols:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.get('/redirect', async (req, res) => {
  const { token1, token2 } = req.query;

  try {
    // Authorize the first account
    await basic.authorize(token1);

    // If there is a second account, authorize it as well
    if (token2) {
      await basic.authorize(token2);
    }

    // Respond with a success status
    res.sendStatus(200);
  } catch (error) {
    console.error('Error authorizing accounts:', error);
    // Respond with a server error status
    res.sendStatus(500);
  }
});


app.get('/trade/data', (req, res) => {
  res.json(tradeData);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  ping(); // Start the pinging process to keep the WebSocket connection alive
});

module.exports = app;
