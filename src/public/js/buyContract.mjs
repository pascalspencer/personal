import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";
import { getCurrentLoginId } from "./custom.mjs";

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`);
let api;
const resultsContainer = document.getElementById("results-container");

// --- WebSocket connection ---
connection.onopen = function () {
  api = new DerivAPIBasic({ connection });
  ping();
  console.log("WebSocket connection established.");
};

// --- Ping keep-alive ---
let pingInterval = null;
  function ping() {
    if (!api || pingInterval) return;
    pingInterval = setInterval(() => api.ping(), 30000);
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

  buyContract(submarket, tradeType, 1, price, tradeDigit);
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

// --- Helpers: read acct/token params from current page URL and authorize before proposals ---
function getTokensFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    acct1: params.get("acct1") || null,
    token1: params.get("token1") || params.get("token") || null,
    cur1: params.get("cur1") || null,
    acct2: params.get("acct2") || null,
    token2: params.get("token2") || null,
    cur2: params.get("cur2") || null,
  };
}

async function authorizeUsingQueryTokens() {
  if (!api || api.is_closed) {
    console.error("API not connected for authorization");
    return false;
  }

  const { token1, token2 } = getTokensFromUrl();
  const tokens = [token1, token2].filter(Boolean);

  if (tokens.length === 0) {
    console.warn("No tokens (token1/token2) found in URL query string.");
    return false;
  }

  // Try tokens in order until one authorizes
  for (const t of tokens) {
    try {
      const resp = await api.authorize(t);
      if (resp && resp.authorize) {
        console.log("Authorized with token from URL query.");
        return true;
      }
      console.warn("Authorize response did not contain authorize payload for token:", t, resp);
    } catch (err) {
      console.warn("Authorization attempt failed for token:", t, err);
    }
  }

  return false;
}

// --- Wait for first live tick ---
async function waitForFirstTick(symbol) {
  return new Promise((resolve, reject) => {
    if (!api || api.is_closed) return reject("API not connected");

    const tickStream = api.subscribe({ ticks: symbol });

    tickStream.onMessage = msg => {
      if (msg.tick && msg.tick.quote !== undefined) {
        console.log("📈 First tick received:", msg.tick.quote);
        tickStream.unsubscribe();    // stop stream
        resolve(msg.tick.quote);     // return live price
      }
    };

    tickStream.onError = err => {
      console.error("❌ Tick subscription error:", err);
      try { tickStream.unsubscribe(); } catch (e) {}
      reject(err);
    };
  });
}



// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price, prediction = null) {
  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return;
  }

  // 1) Authorize first (acct1/token1/cur1 or acct2/token2/cur2)
  const authorized = await authorizeUsingQueryTokens();
  if (!authorized) {
    console.warn("Authorization missing or failed. Aborting to avoid proposal errors.");
    return;
  }

  console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
  console.log("⏳ Subscribing to live ticks (authorized) before requesting proposal…");

  // 2) Subscribe and wait for first tick (ensures we have live price & active subscription)
  let livePrice;
  try {
    livePrice = await waitForFirstTick(symbol);
  } catch (err) {
    console.error("❌ Could not get live tick:", err);
    return;
  }

  console.log("🔥 Using live tick:", livePrice);

  //------------------------------------------
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol: symbol,
    duration: duration,
    duration_unit: "t"
  };

  // ---- VANILLA CONTRACTS (Rise/Fall, Touch/No Touch) ----
  if (["CALL", "PUT", "ONETOUCH", "NOTOUCH"].includes(tradeType)) {
    proposal.contract_type = tradeType;
  }

  // ---- DIGIT CONTRACTS ----
  else if (tradeType.startsWith("DIGIT")) {
    proposal.contract_type = tradeType;

    // These contracts REQUIRE prediction
    if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
      if (prediction === null || isNaN(prediction)) {
        console.warn("⚠️ Digit contract requires prediction (0-9). Defaulting to 0.");
        proposal.prediction = tradeDigit || 0;
      } else {
        proposal.prediction = Number(prediction);
      }
    }

    // EVEN / ODD → no prediction required
  }

  // ---- MULTIPLIER CONTRACTS ----
  else if (["MULTUP", "MULTDOWN"].includes(tradeType)) {
    proposal.contract_type = tradeType;
    
    // Deriv requires multiplier field
    proposal.multiplier = 10; // default – can be updated to user selection
  }

  // ---- UNKNOWN CONTRACT FALLBACK ----
  else {
    console.warn(`⚠️ Unknown contract type: ${tradeType}`);
    proposal.contract_type = tradeType;
  }


  //------------------------------------------
  // 6. REQUEST PROPOSAL
  //------------------------------------------
  let proposalResp;
  try {
    proposalResp = await api.proposal(proposal);
    console.log("Proposal response:", proposalResp);
  } catch (err) {
    console.error("❌ Proposal request failed:", err);
    return;
  }

  if (!proposalResp || proposalResp.error) {
    console.error("❌ Proposal error:", proposalResp.error);
    return;
  }

  const propId = proposalResp.proposal.id;
  console.log("🆔 Proposal ID:", propId);


  //------------------------------------------
  // 7. BUY CONTRACT
  //------------------------------------------
  let buyResp;
  try {
    buyResp = await api.buy({ buy: propId, price });
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



// --- Login ID Loader ---
let cachedLoginId = null;

function getCachedLoginId() {
  if (cachedLoginId) return cachedLoginId;

  const loginId = getCurrentLoginId();
  if (!loginId) {
    console.error("Login ID missing. Cannot trade.");
    return null;
  }

  cachedLoginId = loginId;
  return cachedLoginId;
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
