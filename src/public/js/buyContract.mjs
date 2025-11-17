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

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
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
async function buyContract(symbol, tradeType, duration, price) {
  if (!api) {
    console.error("API not ready. WebSocket not connected.");
    return;
  }
  console.log(`Preparing trade for ${symbol} (${tradeType})...`);

  // 1. Fetch contracts_for specs
  const req = {
    contracts_for: symbol,
    currency: "USD",
    landing_company: "svg",
    product_type: "basic"
  };
  const resp = await api.contractsFor(req).catch(err => {
    console.error("contracts_for request failed:", err);
    return null;
  });
  if (!resp || resp.error) {
    console.error("contracts_for error:", resp?.error);
    return;
  }

  const available = resp.contracts_for.available;
  const contract = available.find(c => c.contract_type === tradeType);
  if (!contract) {
    console.error(`⛔ Contract type ${tradeType} not available for symbol ${symbol}`);
    console.log("Available types:", available.map(c => c.contract_type));
    return;
  }

  // 2. Determine duration_unit
  const minDur = contract.min_contract_duration;
  const maxDur = contract.max_contract_duration;
  const unit = minDur.unit;  // e.g., "s", "t", "m", "h"
  console.log(`Contract ${tradeType} allows durations unit="${unit}", min=${minDur.value}, max=${maxDur.value}`);

  // If tick-based (unit = "t"), ensure duration fits
  if (unit === "t") {
    if (duration < minDur.value || duration > maxDur.value) {
      console.warn(`Duration value ${duration} out of bounds for ticks (${minDur.value}-${maxDur.value})`);
      return;
    }
  } else {
    // time-based
    if (duration < minDur.value || duration > maxDur.value) {
      console.warn(`Duration value ${duration} out of bounds (${minDur.value}-${maxDur.value})`);
      return;
    }
  }

  // 3. Barrier logic
  let proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol
  };

  if (unit) {
    proposal.duration = duration;
    proposal.duration_unit = unit;
  }

  if (contract.barriers > 0) {
    // barrier is required
    // If barrier value is provided by contract.barrier use it, else derive
    const barrierVal = contract.barrier || contract.high_barrier || contract.low_barrier;
    if (!barrierVal) {
      console.error("Barrier required but none provided by contract specs");
      return;
    }
    proposal.barrier = barrierVal.toString();
    console.log("Using barrier:", proposal.barrier);
  }

  console.log("📤 Sending proposal:", proposal);
  api.proposal(proposal)
    .then(pResp => {
      if (pResp.error) {
        console.error("Proposal error:", pResp.error);
        return;
      }
      const propId = pResp.proposal.id;
      return api.buy({ buy: propId, price })
        .then(buyResp => {
          if (buyResp.error) {
            console.error("Buy error:", buyResp.error);
            return;
          }
          console.log("Contract bought:", buyResp);
        });
    })
    .catch(err => {
      console.error("Proposal request failed:", err);
    });
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
