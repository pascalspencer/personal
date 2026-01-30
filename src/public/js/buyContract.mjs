import { getCurrentToken } from './popupMessages.mjs';
import { showLoginidPrompt } from './sign-in.mjs';
import { showLivePopup } from './livePopup.mjs';

// --- WebSocket connection setup ---
const derivAppID = 61696;
let connection = null;
let wsReconnectAttempts = 0;
const maxReconnects = 10;
const reconnectDelay = 3000;

function createWebSocket() {
  connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

  connection.onopen = function () {
    wsReconnectAttempts = 0;
    api = connection;
    lastAuthorizedToken = null; // Reset auth cache on new connection
    startPing();
    console.log("WebSocket connection is fantastic.");

    document.dispatchEvent(new Event("ws-opened"));
  };

  connection.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  connection.onclose = function () {
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

let api = null; // kept for compatibility checks in other codepaths
const resultsContainer = document.getElementById("results-container");

// request bookkeeping
let reqCounter = 1;
const pending = new Map();        // req_id -> resolve(response)
const subscriptions = new Map();  // req_id -> { resolve, timeout }

// detected account currency (NO hardcoded fallback)
let defaultCurrency = null;
let lastAuthorizedToken = null;

/**
 * Robustly detect the active account currency from authorize response
 */
function getBestAccountCurrency(authResp) {
  if (!authResp || !authResp.authorize) return null;

  // Preferred: explicit currency
  if (authResp.authorize.currency) {
    return authResp.authorize.currency;
  }

  // Fallback: account_list (real or virtual)
  const list = authResp.authorize.account_list;
  if (Array.isArray(list) && list.length) {
    // Prefer non-virtual if present, otherwise virtual
    const real = list.find(a => a.is_virtual === 0 && a.currency);
    if (real) return real.currency;

    const demo = list.find(a => a.is_virtual === 1 && a.currency);
    if (demo) return demo.currency;
  }

  return null;
}


function parseCurrencyFromAuth(resp) {
  try {
    if (!resp) return null;
    if (resp.authorize && resp.authorize.currency) return resp.authorize.currency;
    if (resp.authorize && Array.isArray(resp.authorize.account_list) && resp.authorize.account_list.length) {
      const a = resp.authorize.account_list[0];
      if (a && a.currency) return a.currency;
    }
  } catch (e) { }
  return null;
}

/**
 * Shared helper to get the correct token for the selected account
 */
export function getAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const accountSelect = typeof document !== 'undefined' ? document.getElementById("accountType") : null;
  const accountFromUrl = params.get('accountType') || params.get('account');
  const selected = accountSelect?.value ?? accountFromUrl;

  let loginidToUse = localStorage.getItem('selected_loginid') || selected;
  let selectedToken = null;

  if (loginidToUse && localStorage.getItem(loginidToUse)) {
    selectedToken = localStorage.getItem(loginidToUse);
  } else if (selected && localStorage.getItem(selected)) {
    selectedToken = localStorage.getItem(selected);
  } else {
    selectedToken = params.get('userToken') || localStorage.getItem('userToken');
  }

  // Final fallback to popupMessages helper if still null
  return selectedToken || getCurrentToken();
}

// --- WebSocket lifecycle ---
connection.onopen = function () {
  api = connection; // mark as available for simple checks elsewhere
  startPing();
  console.log("WebSocket connection is fantastic.");

  document.addEventListener("DOMContentLoaded", async () => {
    const token = getAuthToken();
    if (!token) {
      console.warn("No token found at authorization.");
      return;
    }

    console.log("Authorizing with token (masked):", String(token).slice(0, 8));
    try {
      const resp = await sendJson({ authorize: token });
      console.log("Authorize response:", resp);

      const cur = getBestAccountCurrency(resp);
      if (cur) {
        defaultCurrency = cur;
        console.log("✅ Account currency detected:", defaultCurrency);
      } else {
        console.warn("⛔ Could not detect account currency — trading disabled");
      }
    } catch (err) {
      console.error("Authorization failed:", err);
    }
  });
};

connection.onerror = (err) => {
  console.error("WebSocket error:", err);
};

connection.onmessage = (evt) => {
  let msg;
  try { msg = JSON.parse(evt.data); } catch (e) { return; }

  const echo = msg.echo_req || {};
  const id = echo.req_id;

  // If this response belongs to a subscription and contains tick -> route to subscription
  if (id && subscriptions.has(id)) {
    const sub = subscriptions.get(id);
    // handle tick responses streaming from a subscribe call
    if (msg.tick) {
      // resolve subscription promise with first quote (then send forget)
      try { connection.send(JSON.stringify({ forget: msg.tick.id })); } catch (e) { }
      clearTimeout(sub.timeout);
      sub.resolve(msg);
      subscriptions.delete(id);
      return;
    }
    // if error on subscription
    if (msg.error) {
      clearTimeout(sub.timeout);
      sub.reject(msg);
      subscriptions.delete(id);
      return;
    }
  }

  // Normal single-response routing
  if (id && pending.has(id)) {
    const resolver = pending.get(id);
    pending.delete(id);
    resolver(msg);
    return;
  }

  // Untracked messages (e.g., general updates) — log at debug level
  // console.log("Unmatched message:", msg);

  // Debug WebSocket state
  if (connection) {
    // console.log("WebSocket state:", connection.readyState, WebSocket.OPEN);
  }
};


// --- Ping keep-alive ---
let pingInterval = null;
function startPing() {
  if (!connection || pingInterval) return;
  pingInterval = setInterval(() => {
    if (connection && connection.readyState === WebSocket.OPEN) {
      try { connection.send(JSON.stringify({ ping: 1 })); } catch (e) { }
    }
  }, 20000); // 20s interval for better reliability
}

// --- low-level send + await single response ---
function sendJson(payload, timeoutMs = 3000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const req_id = reqCounter++;
  payload.req_id = req_id;

  return new Promise((resolve, reject) => {
    pending.set(req_id, (resp) => {
      // Don't reject on API errors; resolve with the response so caller can handle it
      return resolve(resp);
    });

    try {
      connection.send(JSON.stringify(payload));
    } catch (err) {
      pending.delete(req_id);
      return reject(err);
    }

    const to = setTimeout(() => {
      if (pending.has(req_id)) {
        pending.delete(req_id);
        reject(new Error("Request timeout"));
      }
    }, timeoutMs);
    // wrap resolver to clear timeout
    const original = pending.get(req_id);
    pending.set(req_id, (resp) => { clearTimeout(to); original(resp); });
  });
}

// --- subscribe helper: resolves on first matching streaming message (e.g., ticks) ---
function subscribeOnce(payload, timeoutMs = 8000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const req_id = reqCounter++;
  payload.req_id = req_id;
  payload.subscribe = 1; // ensure subscribe semantics for streaming endpoints

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (subscriptions.has(req_id)) {
        subscriptions.delete(req_id);
        // attempt to forget subscription on timeout
        try { connection.send(JSON.stringify({ forget: req_id })); } catch (e) { }
        reject(new Error("Subscription timeout"));
      }
    }, timeoutMs);

    subscriptions.set(req_id, { resolve, reject, timeout });

    try {
      connection.send(JSON.stringify(payload));
    } catch (err) {
      clearTimeout(timeout);
      subscriptions.delete(req_id);
      return reject(err);
    }
  });
}


// --- Automation Mode Control ---
let isAutomationEnabled = false;

export function setAutomationMode(enabled) {
  isAutomationEnabled = enabled;
  console.log("Automation mode:", enabled ? "ON" : "OFF");
}

export function getAutomationMode() {
  return isAutomationEnabled;
}

// --- Fetch live trading instruments from backend ---
let tradingInstruments = null;

async function fetchLiveInstruments() {
  if (tradingInstruments) return tradingInstruments;

  try {
    const response = await fetch("/api/data", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }); // backend fetch from Deriv API
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.text();
    tradingInstruments = JSON.parse(data);
    return tradingInstruments;
  } catch (err) {
    console.error("Error fetching live trading instruments:", err);
    return {};
  }
}

// --- Safe Evaluate & Buy ---
async function evaluateAndBuyContractSafe() {
  console.log("Automation tick…");

  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;
  const tradeDigit = document.getElementById("input-value")?.value;

  if (!market) return console.warn("⛔ Market not selected");
  if (!submarket) return console.warn("⛔ Submarket not selected");
  if (!selectedSentiment) return console.warn("⛔ Sentiment not selected");


  const instruments = await fetchLiveInstruments();
  console.log("Fetched instruments:", instruments);

  const percentages = calculatePercentages();
  console.log("Percentages:", percentages);

  if (percentages.length < 2) {
    return console.warn("⛔ Not enough sentiment data");
  }

  const maxPercentage = Math.max(...percentages);
  const maxIndex = percentages.indexOf(maxPercentage);

  if (maxPercentage < 40) {
    console.warn("⛔ No strong sentiment (>=40%)");

    // Show popup for weak sentiment
    try {
      const overlay = document.createElement('div');
      overlay.className = 'trade-popup-overlay';

      const popup = document.createElement('div');
      popup.className = 'trade-popup';

      const title = document.createElement('h3');
      title.textContent = 'Insufficient Sentiment';
      popup.appendChild(title);

      const msgP = document.createElement('p');
      msgP.textContent = `No strong sentiment detected. Maximum sentiment is ${maxPercentage}%, but at least 40% is required to execute a trade.`;
      popup.appendChild(msgP);

      const closeBtn = document.createElement('a');
      closeBtn.className = 'close-btn';
      closeBtn.href = '#';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); overlay.remove(); });
      popup.appendChild(closeBtn);

      overlay.appendChild(popup);
      try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show sentiment popup:', e); }

      // Auto-dismiss after 6 seconds
      setTimeout(() => { try { overlay.remove(); } catch (e) { } }, 6000);
    } catch (e) {
      console.warn('Failed to build sentiment popup:', e);
    }

    return;
  }

  console.log(`Winning sentiment index = ${maxIndex}`);

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex, submarket);
  console.log("Trade type:", tradeType);

  if (!tradeType) {
    return console.error("⛔ Could not map sentiment → trade type");
  }

  const price = parseFloat(document.getElementById("price")?.value || 1);

  console.log(`🔥 Automated mode active — executing trade
  Symbol: ${submarket}
  Type: ${tradeType}
  Price: ${price}
  Digit: ${tradeDigit}`);

  // Execute trade without waiting for faster automation
  buyContract(submarket, tradeType, 1, price, tradeDigit).catch(err => {
    console.error("Automation trade failed:", err);
  });
}

async function getTradeTypeForSentiment(sentiment, index) {
  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;

  const selected = parts[index].trim().toLowerCase();
  if (!selected) return null;

  // Minimal, reliable mapping
  const map = {
    "rise": "CALL",
    "fall": "PUT",
    "matches": "DIGITMATCH",
    "differs": "DIGITDIFF",
    "even": "DIGITEVEN",
    "odd": "DIGITODD",
    "over": "DIGITOVER",
    "under": "DIGITUNDER",
  };

  for (const key in map) {
    if (selected.includes(key)) return map[key];
  }

  console.warn("No mapping for:", selected);
  return null;
}

// --- Wait for first live tick ---
async function waitForFirstTick(symbol) {
  // subscribeOnce resolves with the raw message; extract quote
  try {
    const msg = await subscribeOnce({ ticks: symbol });
    if (msg && msg.tick && msg.tick.quote !== undefined) {
      return msg.tick.quote;
    }
    throw new Error("Invalid tick message");
  } catch (err) {
    throw err;
  }
}


// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price, prediction = null, liveTickQuote = null, suppressPopup = false) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    console.error("❌ WebSocket not connected.");
    alert("Trading connection not established. Please refresh the page.");
    return { error: { message: "WebSocket not open" } };
  }

  // 1. Ensure authorized (Unified helper)
  const selectedToken = getAuthToken();
  if (!selectedToken) {
    alert("Trading token missing. Please log in.");
    return { error: { message: "No token" } };
  }

  if (lastAuthorizedToken !== selectedToken) {
    try {
      const authResp = await sendJson({ authorize: selectedToken });
      if (authResp?.error) return authResp;
      lastAuthorizedToken = selectedToken;
      const cur = getBestAccountCurrency(authResp);
      if (cur) defaultCurrency = cur;
    } catch (err) { return { error: { message: err.message } }; }
  }

  // 2. Direct Buy by Parameters (Instant - No Proposal ID needed)
  const parameters = {
    symbol,
    contract_type: tradeType,
    currency: defaultCurrency || "USD",
    basis: "stake",
    amount: Number(price),
    duration: duration,
    duration_unit: "t"
  };

  if (tradeType.startsWith("DIGIT") && prediction !== null) {
    parameters.barrier = String(prediction);
  }

  const buyPayload = {
    buy: 1,
    price: Number(price),
    parameters: parameters
  };

  try {
    console.log("[Speed] Executing Direct Buy:", tradeType);
    const resp = await sendJson(buyPayload);

    if (resp.buy && !suppressPopup) {
      showLivePopup(resp.buy.contract_id, {
        tradeType,
        stake: price,
        payout: resp.buy.payout
      });
    }

    // Attach _meta for strategy logic (Martingale support)
    if (resp.buy) {
      resp._meta = {
        profit: 0 // Placeholder, strategy waits for result anyway
      };
    }

    return resp;
  } catch (err) {
    console.error("❌ Direct Buy failed:", err);
    return { error: { message: err.message } };
  }
}

/**
 * Wait for a contract to be settled (Won/Lost)
 * @param {number|string} contractId 
 */
export async function waitForSettlement(contractId) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket not open");
  }

  return new Promise((resolve, reject) => {
    const id = reqCounter++;
    const subPayload = {
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: id
    };

    const handler = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.echo_req?.req_id === id && msg.proposal_open_contract) {
          const poc = msg.proposal_open_contract;
          if (poc.is_settled) {
            // Cleanup
            connection.removeEventListener('message', handler);
            try { connection.send(JSON.stringify({ forget: poc.id })); } catch (e) { }
            resolve(poc);
          }
        } else if (msg.echo_req?.req_id === id && msg.error) {
          connection.removeEventListener('message', handler);
          reject(msg.error);
        }
      } catch (err) { }
    };

    connection.addEventListener('message', handler);
    connection.send(JSON.stringify(subPayload));

    // Timeout safety
    setTimeout(() => {
      connection.removeEventListener('message', handler);
      reject(new Error("Settlement wait timed out"));
    }, 30000);
  });
}


// Unified Bulk Buy using buy_contract_for_multiple_accounts
async function buyContractBulk(symbol, tradeType, duration, stake, barrier, count, tokens) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    console.error("❌ WebSocket not connected.");
    alert("Trading connection not established. Please refresh the page.");
    return { error: { message: "WebSocket not connected" } };
  }

  // Ensure authorized using the provided tokens or fallback to getAuthToken()
  let tokensToUse = tokens;
  if (!tokensToUse || tokensToUse.length === 0 || !tokensToUse[0]) {
    const singleToken = getAuthToken();
    if (singleToken) {
      tokensToUse = [singleToken];
    }
  }

  // If a single token is used for multiple "Target Trades", expand the array
  if (tokensToUse && tokensToUse.length === 1 && count > 1) {
    tokensToUse = Array(count).fill(tokensToUse[0]);
  }

  const tokenToUse = tokensToUse && tokensToUse.length > 0 ? tokensToUse[0] : null;
  if (tokenToUse) {
    if (lastAuthorizedToken !== tokenToUse) {
      try {
        console.log("[TRACK] Authorizing for Bulk API", { token: tokenToUse.slice(0, 8) + '...' });
        const authResp = await sendJson({ authorize: tokenToUse });
        if (authResp?.error) {
          console.warn("Bulk authorization failed:", authResp.error);
          return { error: authResp.error };
        }
        lastAuthorizedToken = tokenToUse;
        const cur = getBestAccountCurrency(authResp);
        if (cur) {
          defaultCurrency = cur;
          console.log("✅ Currency refreshed during bulk auth:", defaultCurrency);
        }
      } catch (err) {
        console.warn("Bulk authorize request error:", err);
        return { error: { message: err.message } };
      }
    }
  } else {
    console.warn("No token provided for bulk trade authorization");
    return { error: { message: "No token provided" } };
  }

  // Construct parameter object for the contract
  const parameters = {
    symbol: symbol,
    contract_type: tradeType,
    currency: defaultCurrency || "USD",
    basis: "stake",
    amount: stake,
    duration: duration,
    duration_unit: "t",
  };

  // Digit-specific barriers
  if (tradeType.startsWith("DIGIT")) {
    if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
      parameters.barrier = String(barrier ?? 0);
    }
  }

  // Construct payload
  const maxPrice = Number(stake) + 1;

  const payload = {
    buy_contract_for_multiple_accounts: 1,
    tokens: tokensToUse, // Use the processed and expanded array
    parameters: parameters,
    price: maxPrice
  };

  try {
    console.log("[TRACK] Sending bulk buy request", { count: tokensToUse.length, symbol, tradeType });
    const resp = await sendJson(payload);

    if (resp.error) {
      console.error("❌ Bulk buy error:", resp.error);
      return { error: resp.error };
    }

    console.log("🎉 Bulk buy executed:", resp);

    // Show live popups for the contracts
    if (resp.buy_contract_for_multiple_accounts && Array.isArray(resp.buy_contract_for_multiple_accounts.result)) {
      resp.buy_contract_for_multiple_accounts.result.forEach(item => {
        if (item.buy && item.buy.contract_id) {
          showLivePopup(item.buy.contract_id, {
            tradeType: tradeType,
            stake: stake,
            payout: item.buy.payout
          });
        }
      });
    }

    return resp;
  } catch (err) {
    console.error("❌ Bulk buy exception:", err);
    return { error: { message: err.message } };
  }
}


// --- Helper to calculate sentiment percentages ---
function calculatePercentages() {
  const percentages = [];
  const divs = resultsContainer?.getElementsByTagName("div") || [];
  for (let i = 0; i < 2 && i < divs.length; i++) {
    const match = divs[i].textContent?.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }
  return percentages;
}

// --- Export for automation ---
export { evaluateAndBuyContractSafe, buyContract, buyContractBulk, showLoginidPrompt, waitForSettlement };
