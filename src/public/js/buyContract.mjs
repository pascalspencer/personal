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
  if (enabled) startAutomation();
  else stopAutomation();
}

export function getAutomationMode() {
  return isAutomationEnabled;
}

function startAutomation() {
  stopAutomation();
  automationInterval = setInterval(() => {
    if (isAutomationEnabled) evaluateAndBuyContractSafe();
  }, 5000);
}

function stopAutomation() {
  if (automationInterval) clearInterval(automationInterval);
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
  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;

  if (!market || !submarket || !selectedSentiment) return;

  const instruments = await fetchLiveInstruments();

  if (!instruments[market]?.includes(submarket)) {
    console.warn(`Invalid submarket "${submarket}" for market "${market}"`);
    return;
  }

  const percentages = calculatePercentages();
  const maxPercentage = Math.max(...percentages);
  if (maxPercentage < 40) return;

  const maxIndex = percentages.indexOf(maxPercentage);

  try {
    const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
    if (!tradeType) return console.error("Invalid trade type derived from sentiment.");

    const price = parseFloat(document.getElementById("price")?.value || 1);
    buyContract(submarket, tradeType, 1, price);
  } catch (err) {
    console.error("Error in evaluateAndBuyContractSafe:", err);
  }
}

// --- Trade Type Fetcher ---
async function getTradeTypeForSentiment(sentiment, index) {
  const sentimentParts = sentiment.split("/");
  if (!sentimentParts[index]) return null;
  const selectedPart = sentimentParts[index].trim();

  // --- Sentiment-to-Contract Mapping ---
  const mapping = {
    "Touch": "ONETOUCH",
    "NoTouch": "NOTOUCH",
    "Up": "MULTUP",
    "Down": "MULTDOWN",
    "Rise": "CALLE",
    "Fall": "PUTE",
    "Higher": "TICKHIGH",
    "Lower": "TICKLOW",
    "Matches": "DIGITMATCH",
    "Differs": "DIGITDIFF",
    "Even": "DIGITEVEN",
    "Odd": "DIGITODD",
    "Over": "DIGITOVER",
    "Under": "DIGITUNDER"
  };

  const tradeType = mapping[selectedPart] || null;
  if (!tradeType) console.error("Unknown sentiment:", selectedPart);
  return tradeType;
}


// --- Buy Contract ---
function buyContract(symbol, tradeType, duration, price) {
  const loginId = getCachedLoginId();
  if (!loginId) return console.error("Login ID not found.");


    const buyRequest = {
      proposal: 1,
      amount: price,
      basis: "stake",
      contract_type: tradeType,
      currency: "USD",
      duration: duration,
      duration_unit: "t",
      symbol,
      loginid: loginId,
    };

    api.proposal(buyRequest)
      .then((proposalResp) => {
        if (proposalResp.error) return console.error("Proposal error:", proposalResp.error);

        api.buy({ buy: proposalResp.proposal.id, price })
          .then((buyResp) => {
            if (buyResp.error) return console.error("Buy error:", buyResp.error);
            console.log("Contract bought:", buyResp);
            alert("Contract bought successfully!");
          });
      })
      .catch((err) => console.error("Proposal request failed:", err));
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
