import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";
import { getCurrentLoginId } from "./custom.mjs";

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`);
let api;
const resultsContainer = document.getElementById("results-container");

// --- WebSocket connection ---
connection.onopen = function () {
  api = new DerivAPIBasic({ connection });
  startPing();
  console.log("WebSocket connection established.");
};

// --- Ping keep-alive ---
let pingInterval = null;
function startPing() {
  if (!api || pingInterval) return;
  pingInterval = setInterval(() => api.ping(), 30000);
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

// --- Fetch live trading instruments ---
let tradingInstruments = null;
async function fetchLiveInstruments() {
  if (tradingInstruments) return tradingInstruments;
  try {
    const response = await fetch("/api/data");
    tradingInstruments = await response.json();
    return tradingInstruments;
  } catch (err) {
    console.error("Error fetching live trading instruments:", err);
    return {};
  }
}

// --- Helper: Timeout wrapper ---
function withTimeout(promise, ms = 7000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏱ Timeout waiting for API response")), ms)
    ),
  ]);
}

// --- Helper: Active symbols check ---
async function isSymbolActive(symbol) {
  try {
    const activeSymbolsResp = await withTimeout(api.activeSymbols());
    return activeSymbolsResp.active_symbols?.some(s => s.symbol === symbol);
  } catch (err) {
    console.warn("Could not fetch active symbols:", err);
    return false;
  }
}

// --- Get trade type from sentiment ---
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
  console.warn("No mapping for sentiment:", selected);
  return null;
}

// --- Calculate percentages ---
function calculatePercentages() {
  const percentages = [];
  const divs = resultsContainer?.getElementsByTagName("div") || [];
  for (let i = 0; i < 2 && i < divs.length; i++) {
    const match = divs[i].textContent?.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }
  return percentages;
}

// --- Safe Evaluate & Buy (with proposal pre-checks) ---
export async function evaluateAndBuyContractSafe() {
  console.log("Automation tick…");

  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;
  const price = parseFloat(document.getElementById("price")?.value || 1);

  if (!market) return console.warn("⛔ Market not selected");
  if (!submarket) return console.warn("⛔ Submarket not selected");
  if (!selectedSentiment) return console.warn("⛔ Sentiment not selected");

  // Check if symbol is currently active
  const active = await isSymbolActive(submarket);
  if (!active) return console.warn(`⛔ Symbol ${submarket} is not active.`);

  const instruments = await fetchLiveInstruments();
  console.log("Fetched instruments:", instruments);

  const percentages = calculatePercentages();
  if (percentages.length < 2) return console.warn("⛔ Not enough sentiment data");

  const maxPercentage = Math.max(...percentages);
  const maxIndex = percentages.indexOf(maxPercentage);
  if (maxPercentage < 40) return console.warn("⛔ No strong sentiment (>=40%)");

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
  if (!tradeType) return console.error("⛔ Could not map sentiment → trade type");

  console.log(`🔥 Preparing trade → Symbol: ${submarket}, Type: ${tradeType}, Price: ${price}`);

  // Buy contract safely
  await buyContractSafe(submarket, tradeType, 1, price);
}

// --- Unified buyContract with timeout and safe logging ---
async function buyContractSafe(symbol, tradeType, duration, price) {
  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return;
  }

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

  console.log(`🚀 Sending proposal for ${symbol} (${tradeType})…`);

  // Proposal with timeout
  let proposalResp;
  try {
    proposalResp = await withTimeout(api.proposal(proposal));
  } catch (err) {
    console.error("❌ Proposal request failed or timed out:", err);
    return;
  }

  if (!proposalResp?.proposal?.id) {
    console.error("❌ Proposal invalid or missing ID:", proposalResp);
    return;
  }

  const propId = proposalResp.proposal.id;
  console.log("🆔 Proposal ID received:", propId);

  // Buy contract with timeout
  let buyResp;
  try {
    buyResp = await withTimeout(api.buy({ buy: propId, price }));
  } catch (err) {
    console.error("❌ Buy request failed or timed out:", err);
    return;
  }

  if (buyResp.error) {
    console.error("❌ Buy error:", buyResp.error);
    return;
  }

  console.log("🎉 Contract bought successfully:", buyResp);
  return buyResp;
}
