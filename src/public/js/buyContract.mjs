// Note: DerivAPIBasic removed — sending raw JSON over WebSocket and handling responses by req_id.

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

let api = null; // kept for compatibility checks in other codepaths
const resultsContainer = document.getElementById("results-container");

// request bookkeeping
let reqCounter = 1;
const pending = new Map();        // req_id -> resolve(response)
const subscriptions = new Map();  // req_id -> { resolve, timeout }

// --- WebSocket lifecycle ---
connection.onopen = function () {
  api = connection; // mark as available for simple checks elsewhere
  startPing();
  console.log("WebSocket connection is fantastic.");

  document.addEventListener("DOMContentLoaded", async () => {
    const token = getCurrentToken();
    if (!token) {
      console.warn("No token found at authorization.");
      return;
    }

    console.log("Authorizing with token (masked):", String(token).slice(0, 8));
    try {
      const resp = await sendJson({ authorize: token });
      console.log("Authorize response:", resp);
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
      const subId = msg.tick.id; // THIS is the real subscription ID

      if (subId) {
        try {
          connection.send(JSON.stringify({ forget: subId }));
        } catch (e) {}
      }

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
  // console.debug("Unmatched message:", msg);
};

// --- Ping keep-alive ---
let pingInterval = null;
function startPing() {
  if (!connection || pingInterval) return;
  pingInterval = setInterval(() => {
    try { connection.send(JSON.stringify({ ping: 1 })); } catch (e) {}
  }, 30000);
}

// --- low-level send + await single response ---
function sendJson(payload, timeoutMs = 8000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const req_id = reqCounter++;
  payload.req_id = req_id;

  return new Promise((resolve, reject) => {
    pending.set(req_id, (resp) => {
      if (resp && resp.error) return reject(resp);
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
async function subscribeOnce(payload, timeoutMs = 8000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }

  const req_id = reqCounter++;
  payload.req_id = req_id;
  payload.subscribe = 1;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscriptions.delete(req_id);
      reject(new Error("Subscription timeout"));
    }, timeoutMs);

    subscriptions.set(req_id, { resolve, reject, timeout });

    try {
      connection.send(JSON.stringify(payload));
    } catch (err) {
      clearTimeout(timeout);
      subscriptions.delete(req_id);
      reject(err);
    }
  });
}


// --- Token helpers ---
function getCurrentToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("userToken");

  if (urlToken) {
    localStorage.setItem("userToken", urlToken);
    console.log("Saved User Token from query (masked):", String(urlToken).slice(0, 8));
    return urlToken;
  }

  const stored = localStorage.getItem("userToken");
  if (stored) {
    console.log("Loaded User Token from storage (masked):", String(stored).slice(0, 8));
    return stored;
  }

  return null;
}

// --- Automation Mode Control ---
let isAutomationEnabled = false;
let automationInterval = null;

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
    const response = await fetch("/api/data"); // backend fetch from Deriv API
    tradingInstruments = await response.json();
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
    return console.warn("⛔ No strong sentiment (>=40%)");
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

  await buyContract(submarket, tradeType, 1, price, tradeDigit);
}

async function getTradeTypeForSentiment(sentiment, index) {
  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;

  const selected = parts[index].trim().toLowerCase();
  if (!selected) return null;

  // Minimal, reliable mapping
  const map = {
    "touch": "ONETOUCH",
    "no touch": "NOTOUCH",
    "rise": "CALL",
    "fall": "PUT",
    "higher": "TICKHIGH",
    "lower": "TICKLOW",
    "matches": "DIGITMATCH",
    "differs": "DIGITDIFF",
    "even": "DIGITEVEN",
    "odd": "DIGITODD",
    "over": "DIGITOVER",
    "under": "DIGITUNDER",
    "up": "MULTUP",
    "down": "MULTDOWN"
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
      console.log("📈 First tick received:", msg.tick.quote);
      return msg.tick.quote;
    }
    throw new Error("Invalid tick message");
  } catch (err) {
    throw err;
  }
}


// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price, prediction = null) {
    if (!connection || connection.readyState !== WebSocket.OPEN) {
        console.error("❌ WebSocket not connected.");
        return;
    }

    // Ensure authorized (basic check: presence of cached userToken or session-based token)
    const token = getCurrentToken();
    if (!token) {
      console.warn("No token available; attempt will likely fail.");
    } else {
      // ensure authorization on server-side was done via /redirect; re-authorize if necessary
      try {
        const authResp = await sendJson({ authorize: token });
        if (authResp.error) {
          console.warn("Authorization failed:", authResp.error);
          // continue or abort depending on your preference; here we continue and let proposal fail if unauthorized
        } else {
          console.log("Authorized before proposal (masked token).");
        }
      } catch (err) {
        console.warn("Authorize request error:", err);
      }
    }

    console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
    console.log("⏳ Subscribing to live ticks before requesting proposal…");

    // 1) Get live tick
    let livePrice;
    try {
        livePrice = await waitForFirstTick(symbol);
    } catch (err) {
        console.error("❌ Could not get live tick:", err);
        return;
    }

    console.log("🔥 Using live tick:", livePrice);

    // 2) Build PROPOSAL object
    const proposal = {
        proposal: 1,
        amount: price,
        basis: "stake",
        contract_type: tradeType,
        currency: "USD",
        symbol: symbol,
        duration: duration,
        duration_unit: "t",
    };

    // Digit-specific
    if (tradeType.startsWith("DIGIT")) {
        if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
            proposal.barrier = String(prediction ?? 0);
        }
    }

    // Multiplier
    if (["MULTUP", "MULTDOWN"].includes(tradeType)) {
        proposal.multiplier = 10;
    }

    // 3) SEND PROPOSAL
    let proposalResp;
    try {
        proposalResp = await sendJson(proposal);
        console.log("Proposal response:", proposalResp);
    } catch (err) {
        console.error("❌ Proposal request failed:", err);
        return;
    }

    if (proposalResp.error) {
        console.error("❌ Proposal error:", proposalResp.error);
        return;
    }

    // Extract correct proposal info
    const prop = proposalResp.proposal;
    if (!prop || !prop.id) {
      console.error("❌ Proposal missing id:", proposalResp);
      return;
    }
    const propId = prop.id;
    const askPrice = prop.ask_price ?? prop.ask_price; // use ask_price if present

    console.log("🆔 Proposal ID:", propId);
    console.log("💵 Ask Price:", askPrice);

    // 4) BUY CONTRACT
    let buyResp;
    try {
        buyResp = await sendJson({ buy: propId, price: askPrice });
        console.log("Buy response:", buyResp);
    } catch (err) {
        console.error("❌ Buy call failed:", err);
        return;
    }

    if (buyResp.error) {
        console.error("❌ Buy error:", buyResp.error);
        return;
    }

    console.log("🎉 Contract bought successfully:", buyResp);
    return buyResp;
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
export { evaluateAndBuyContractSafe };
