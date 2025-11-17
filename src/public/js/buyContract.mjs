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
  if (!api) return console.error("API not ready. WebSocket not connected.");

  console.log(`Preparing trade for ${symbol} (${tradeType})...`);

  // 1️⃣ Fetch dynamic contract specs
  const contractsResp = await api.contractsFor({
    contracts_for: symbol,
    currency: "USD"
  }).catch(err => {
    console.error("contracts_for request failed:", err);
    return null;
  });

  if (!contractsResp || contractsResp.error) {
    return console.error("contracts_for error:", contractsResp?.error);
  }

  const available = contractsResp.contracts_for.available;
  const contract = available.find(c => c.contract_type === tradeType);

  if (!contract) {
    return console.error(`⛔ Contract type ${tradeType} is NOT available for ${symbol}`);
  }

  // 2️⃣ Detect duration type: tick / time / multipliers
  let durationUnit = null;
  let needsBarrier = false;
  let barrierValue = undefined;

  // Multipliers do not use proposals or duration
  const isMultiplier = tradeType === "MULTUP" || tradeType === "MULTDOWN";

  if (isMultiplier) {
    console.log("⚡ Multipliers detected → sending buy request directly.");

    return api.buy({
      buy: tradeType,
      amount: price,
      basis: "stake",
      symbol,
      multiplier: contract?.multiplier || 100
    }).then(resp => {
      if (resp.error) return console.error("Multiplier buy error:", resp.error);
      console.log("Multiplier contract bought:", resp);
    });
  }

  // Check duration units allowed
  const durations = contract.available_duration || [];

  const tickDuration = durations.find(d => d.unit === "t");
  const timeDuration = durations.find(d => d.unit !== "t");

  if (tickDuration) {
    durationUnit = "t";   // tick supported
  } else if (timeDuration) {
    durationUnit = timeDuration.unit; // s, m, h
  } else {
    return console.error("⛔ Contract has no valid duration units.");
  }

  // 3️⃣ Barrier detection
  if (contract.barriers === 1) {
    // Single barrier
    needsBarrier = true;
    barrierValue = contract.barrier || contract.high_barrier || contract.low_barrier;
  }

  if (contract.barriers === 2) {
    console.warn("Double-barrier contracts not supported automatically.");
    return;
  }

  // For digit trades → barrier = 0–9
  const isDigitContract = tradeType.startsWith("DIGIT");
  if (isDigitContract) {
    needsBarrier = true;
    barrierValue = Math.floor(Math.random() * 10).toString(); // 0–9 digit
  }

  // 4️⃣ Build proposal request
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol,
  };

  if (!isMultiplier) {
    proposal.duration = duration;
    proposal.duration_unit = durationUnit;
  }

  if (needsBarrier && barrierValue !== undefined) {
    proposal.barrier = barrierValue.toString();
  }

  console.log("📤 Sending proposal:", proposal);

  // 5️⃣ Send proposal → then buy
  api.proposal(proposal)
    .then(proposalResp => {
      if (proposalResp.error) {
        console.error("Proposal error:", proposalResp.error);
        return;
      }

      const id = proposalResp.proposal.id;

      return api.buy({ buy: id, price })
        .then(buyResp => {
          if (buyResp.error) return console.error("Buy error:", buyResp.error);
          console.log("Contract bought:", buyResp);
        });
    })
    .catch(err => console.error("Proposal failed:", err));
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
