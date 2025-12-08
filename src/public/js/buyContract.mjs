import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
let api = null;
let pingInterval = null;
let cachedAuthToken = null;
const resultsContainer = document.getElementById("results-container");

// ----------------------
// Initialization
// ----------------------
connection.onopen = () => {
  api = new DerivAPIBasic({ connection });
  startPing();
  console.log("WebSocket connection established.");

  // keep previous behavior: try to authorize if userToken present in URL/localStorage
  document.addEventListener("DOMContentLoaded", async () => {
    const token = getCurrentToken();
    if (token) {
      try {
        await authorizeWithToken(token);
        console.log("Authorized at DOMContentLoaded.");
      } catch (err) {
        console.warn("Initial authorization failed:", err);
      }
    }
  });
};

// ----------------------
// Utilities
// ----------------------
function startPing() {
  if (!api || pingInterval) return;
  pingInterval = setInterval(() => api.ping(), 30000);
}

function getCurrentToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("userToken");
  if (urlToken) {
    localStorage.setItem("userToken", urlToken);
    console.log("Saved User Token from query (partial):", String(urlToken).slice(0, 8));
    return urlToken;
  }
  const stored = localStorage.getItem("userToken");
  if (stored) {
    return stored;
  }
  return null;
}

function getTokensFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    acct1: params.get("acct1") || null,
    token1: params.get("token1") || null,
    cur1: params.get("cur1") || null,
    acct2: params.get("acct2") || null,
    token2: params.get("token2") || null,
    cur2: params.get("cur2") || null,
  };
}

// ----------------------
// Authorization helpers
// ----------------------
async function authorizeWithToken(token) {
  if (!api || api.is_closed) throw new Error("API not connected");
  if (!token) throw new Error("No token provided");
  // cache to avoid re-authorizing same token repeatedly
  if (cachedAuthToken === token) return true;

  try {
    const resp = await api.authorize(token);
    if (resp && resp.authorize) {
      cachedAuthToken = token;
      console.log("Authorized successfully (partial token):", String(token).slice(0, 8));
      return true;
    }
    throw new Error("Authorize response invalid");
  } catch (err) {
    console.error("authorizeWithToken failed:", err);
    throw err;
  }
}

async function ensureAuthorized() {
  if (!api || api.is_closed) throw new Error("API not connected");

  // 1) try stored userToken (from /redirect?userToken=... pattern)
  const stored = getCurrentToken();
  if (stored) {
    try { await authorizeWithToken(stored); return true; } catch (e) { /* continue */ }
  }

  // 2) try explicit tokens passed as acct1/token1 / acct2/token2 in URL
  const { token1, token2 } = getTokensFromUrl();
  const tokens = [token1, token2].filter(Boolean);
  for (const t of tokens) {
    try { await authorizeWithToken(t); return true; } catch (e) { /* try next */ }
  }

  // no token authorized
  return false;
}

// ----------------------
// Market / trade helpers
// ----------------------
async function fetchLiveInstruments() {
  // cached minimal fetch
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Failed fetching instruments");
    return await res.json();
  } catch (err) {
    console.error("Error fetching live trading instruments:", err);
    return {};
  }
}

function calculatePercentages() {
  const percentages = [];
  const divs = resultsContainer?.getElementsByTagName("div") || [];
  for (let i = 0; i < 2 && i < divs.length; i++) {
    const match = divs[i].textContent?.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }
  return percentages;
}

async function getTradeTypeForSentiment(sentiment, index) {
  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;
  const selected = parts[index].trim().toLowerCase();
  if (!selected) return null;

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
  return null;
}

// ----------------------
// Ticks / subscription
// ----------------------
async function waitForFirstTick(symbol) {
  return new Promise((resolve, reject) => {
    if (!api || api.is_closed) return reject("API not connected");

    const tickStream = api.subscribe({ ticks: symbol });

    // DerivAPIBasic returns a stream that calls onMessage/onError
    tickStream.onMessage = (msg) => {
      if (msg && msg.tick && msg.tick.quote !== undefined) {
        try { tickStream.unsubscribe(); } catch (e) {}
        resolve(msg.tick.quote);
      }
    };

    tickStream.onError = (err) => {
      try { tickStream.unsubscribe(); } catch (e) {}
      reject(err);
    };

    // safety timeout
    const timeout = setTimeout(() => {
      try { tickStream.unsubscribe(); } catch (e) {}
      reject(new Error("Tick subscription timeout"));
    }, 8000);

    // clear timeout on resolve/reject via promise handlers
    const originalResolve = resolve;
    resolve = (v) => { clearTimeout(timeout); originalResolve(v); };
    const originalReject = reject;
    reject = (e) => { clearTimeout(timeout); originalReject(e); };
  });
}

// ----------------------
// Core: buy contract
// ----------------------
async function buyContract(symbol, tradeType, duration, price, prediction = null) {
  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return;
  }

  // 0) ensure we are authorized before subscribing / requesting proposals
  try {
    const ok = await ensureAuthorized();
    if (!ok) {
      console.error("❌ Authorization failed or missing. Aborting trade.");
      return;
    }
  } catch (err) {
    console.error("❌ Authorization error:", err);
    return;
  }

  console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
  console.log("⏳ Subscribing to live ticks (authorized) before requesting proposal…");

  // 1) Subscribe and wait for first tick
  let livePrice;
  try {
    livePrice = await waitForFirstTick(symbol);
  } catch (err) {
    console.error("❌ Could not get live tick:", err);
    return;
  }
  console.log("🔥 Using live tick:", livePrice);

  // 2) build proposal
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol,
    duration,
    duration_unit: "t"
  };

  if (["CALL", "PUT", "ONETOUCH", "NOTOUCH"].includes(tradeType)) {
    proposal.contract_type = tradeType;
  } else if (tradeType.startsWith("DIGIT")) {
    proposal.contract_type = tradeType;
    if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
      if (prediction === null || isNaN(prediction)) {
        console.warn("⚠️ Digit contract requires prediction. Defaulting to 0.");
        proposal.prediction = 0;
      } else {
        proposal.prediction = Number(prediction);
      }
    }
  } else if (["MULTUP", "MULTDOWN"].includes(tradeType)) {
    proposal.contract_type = tradeType;
    proposal.multiplier = 10;
  } else {
    proposal.contract_type = tradeType;
  }

  // 3) request proposal
  let proposalResp;
  try {
    proposalResp = await api.proposal(proposal);
    if (!proposalResp || proposalResp.error) {
      console.error("❌ Proposal error:", proposalResp?.error || "No response");
      return;
    }
    console.log("Proposal response:", proposalResp);
  } catch (err) {
    console.error("❌ Proposal request failed:", err);
    return;
  }

  const propId = proposalResp.proposal.id;
  console.log("🆔 Proposal ID:", propId);

  // 4) buy
  let buyResp;
  try {
    buyResp = await api.buy({ buy: propId, price });
    if (!buyResp || buyResp.error) {
      console.error("❌ Buy error:", buyResp?.error || "No response");
      return;
    }
    console.log("🎉 Contract bought successfully:", buyResp);
    return buyResp;
  } catch (err) {
    console.error("❌ Buy call failed:", err);
    return;
  }
}

// ----------------------
// Automation entry
// ----------------------
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
  if (percentages.length < 2) return console.warn("⛔ Not enough sentiment data");

  const maxPercentage = Math.max(...percentages);
  const maxIndex = percentages.indexOf(maxPercentage);
  if (maxPercentage < 40) return console.warn("⛔ No strong sentiment (>=40%)");

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
  if (!tradeType) return console.error("⛔ Could not map sentiment → trade type");

  const price = parseFloat(document.getElementById("price")?.value || 1);
  console.log(`🔥 Automated trade — Symbol: ${submarket}, Type: ${tradeType}, Price: ${price}, Digit: ${tradeDigit}`);

  await buyContract(submarket, tradeType, 1, price, tradeDigit);
}

// ----------------------
// Export
// ----------------------
export { evaluateAndBuyContractSafe };
