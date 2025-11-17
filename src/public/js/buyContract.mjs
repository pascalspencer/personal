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
function ping() {
  if (api) setInterval(() => api.ping(), 30000);
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
  Price: ${price}`);

  buyContract(submarket, tradeType, 1, price);
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
    "rise": "CALLE",
    "fall": "PUTE",
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



// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price) {
  if (!api) return console.error("API not ready");

  console.log(`Preparing trade for ${symbol} (${tradeType})…`);

  // 1 — Pull live contract specs
  const resp = await api.contractsFor({
    contracts_for: symbol,
    currency: "USD",
    landing_company: "svg",
    product_type: "basic"
  }).catch(err => {
    console.error("contracts_for failed:", err);
    return null;
  });

  if (!resp || resp.error) {
    console.error("contracts_for error:", resp?.error);
    return;
  }

  const available = resp.contracts_for.available || [];
  const contract = available.find(c => c.contract_type === tradeType);

  if (!contract) {
    console.error(`⛔ ${tradeType} not available for ${symbol}`);
    console.log("Available:", available.map(c => c.contract_type));
    return;
  }

  const minDur = contract.min_contract_duration;
  const maxDur = contract.max_contract_duration;

  // Duration unit from server
  const unit = minDur?.unit || "t";

  if (duration < minDur.value || duration > maxDur.value) {
    console.warn(`Duration ${duration}${unit} invalid. Allowed: ${minDur.value}-${maxDur.value}`);
    return;
  }

  // 2 — Build proposal
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol,
    duration,
    duration_unit: unit
  };

  // digit contracts need barrier 0–9
  if (tradeType.startsWith("DIGIT")) {
    proposal.barrier = String(Math.floor(Math.random() * 10));
  }

  console.log("📤 Sending proposal:", proposal);

  // 3 — Send proposal and then buy
  const pResp = await api.proposal(proposal);
  if (pResp.error) return console.error("Proposal error:", pResp.error);

  const propId = pResp.proposal?.id;
  if (!propId) return console.error("No proposal ID returned");

  const buyResp = await api.buy({ buy: propId, price });
  if (buyResp.error) return console.error("Buy error:", buyResp.error);

  console.log("Contract bought:", buyResp);
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
