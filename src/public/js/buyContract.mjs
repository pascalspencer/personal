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

// --- Trade Type Fetcher ---
async function getTradeTypeForSentiment(sentiment, index, symbol) {
  const sentimentParts = sentiment.split("/");
  if (!sentimentParts[index]) return null;

  const selectedPart = sentimentParts[index].trim();

  // Fetch dynamic contract types for this symbol
  const contractsResp = await api.contractsFor({
    contracts_for: symbol,
    currency: "USD"
  });

  if (contractsResp.error) {
    console.error("contracts_for error:", contractsResp.error);
    return null;
  }

  const availableContracts = contractsResp.contracts_for.available;

  // Create a searchable list { display_name, contract_type }
  const dynamicList = availableContracts.map(c => ({
    display: c.contract_display,
    type: c.contract_type
  }));

  console.log("Dynamic contracts:", dynamicList);

  // Try direct match by display name
  const directMatch = dynamicList.find(c =>
    c.display.toLowerCase().includes(selectedPart.toLowerCase())
  );
  if (directMatch) return directMatch.type;

  // Fallback smart matching:
  const keywordMap = [
    ["Rise", ["rise", "call", "higher", "up"]],
    ["Fall", ["fall", "put", "lower", "down"]],
    ["Touch", ["touch"]],
    ["NoTouch", ["no touch", "notouch"]],
    ["Even", ["even"]],
    ["Odd", ["odd"]],
    ["Over", ["over"]],
    ["Under", ["under"]],
    ["Matches", ["match"]],
    ["Differs", ["diff"]]
  ];

  for (const [label, keywords] of keywordMap) {
    if (keywords.some(k => selectedPart.toLowerCase().includes(k))) {
      const match = dynamicList.find(c =>
        c.display.toLowerCase().includes(label.toLowerCase())
      );
      if (match) return match.type;
    }
  }

  console.warn("⚠ No dynamic match found for:", selectedPart);
  return null;
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
