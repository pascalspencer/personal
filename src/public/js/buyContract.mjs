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
  if (api) {
    setInterval(() => api.ping(), 30000);
  }
}

// --- Load trading instruments ---
let tradingInstruments = {};
fetch("/trade/instruments")
  .then((response) => response.json())
  .then((data) => {
    tradingInstruments = data;
  })
  .catch((error) => console.error("Error fetching trading instruments:", error));

// --- Automation Mode Control ---
let isAutomationEnabled = false;
let automationInterval = null;

function setAutomationMode(enabled) {
  isAutomationEnabled = enabled;
  console.log("Automation mode:", enabled ? "ON" : "OFF");

  if (enabled) {
    startAutomation();
  } else {
    stopAutomation();
  }
}

function getAutomationMode() {
  return isAutomationEnabled;
}

function startAutomation() {
  stopAutomation(); // Clear any existing loop first

  automationInterval = setInterval(() => {
    if (isAutomationEnabled) {
      console.log("Running automated trade...");
      evaluateAndBuyContract();
    }
  }, 5000); // every 5 seconds (adjust as needed)
}

function stopAutomation() {
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
}

// --- Evaluate and Buy Logic ---
async function evaluateAndBuyContract() {
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;
  console.log(`Selected sentiment: ${selectedSentiment}`);

  const percentages = calculatePercentages();
  const maxPercentage = Math.max(...percentages);

  if (maxPercentage < 40) return; // skip weak signals

  const maxIndex = percentages.indexOf(maxPercentage);

  try {
    const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
    if (!tradeType) {
      console.error("Invalid trade type derived from sentiment.");
      return;
    }

    const market = document.getElementById("market").value;
    const submarket = document.getElementById("submarket").value;

    const response = await fetch("/trade/instruments");
    const instruments = await response.json();
    const symbol = instruments.symbols[submarket];

    if (!symbol) {
      console.error("Invalid symbol derived from submarket.");
      return;
    }

    const price = parseFloat(document.getElementById("price").value);
    console.log(`Symbol: ${symbol}, Price: ${price}`);

    buyContract(symbol, tradeType, 1, price);
  } catch (error) {
    console.error("Error in evaluateAndBuyContract:", error);
  }
}

// --- Trade Type Fetcher ---
async function getTradeTypeForSentiment(sentiment, index) {
  try {
    const response = await fetch("/trade/instruments");
    const instruments = await response.json();

    const sentimentParts = sentiment.split("/");
    if (sentimentParts[index]) {
      const selectedPart = sentimentParts[index].trim();
      return instruments.trade_types[selectedPart];
    } else {
      console.error("Index out of bounds or undefined sentiment part.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching trade instruments:", error);
    return null;
  }
}

// --- Login ID Loader ---
let isLoginIdLoaded = false;
let cachedLoginId = null;

function loadLoginId(callback) {
  if (isLoginIdLoaded) return callback(cachedLoginId);

  const loadId = function () {
    const currentLoginId = getCurrentLoginId();

    if (!currentLoginId) {
      console.error("Login ID not found in URL");
      cachedLoginId = null;
      callback(null);
      return;
    }

    console.log("Current Login ID:", currentLoginId);
    cachedLoginId = currentLoginId;
    isLoginIdLoaded = true;
    callback(currentLoginId);
  };

  if (typeof window.onload === "function") {
    const originalOnLoad = window.onload;
    window.onload = function () {
      originalOnLoad();
      loadId();
    };
  } else {
    window.onload = loadId;
  }
}

// --- Buy Contract ---
function buyContract(symbol, tradeType, duration, price) {
  loadLoginId(function (loginId) {
    if (!loginId) return console.error("Login ID not found in callback.");

    const buyContractRequest = {
      proposal: 1,
      amount: price,
      basis: "stake",
      contract_type: tradeType,
      currency: "USD",
      duration: duration,
      duration_unit: "t",
      symbol: symbol,
      loginid: loginId,
    };

    api.proposal(buyContractRequest)
      .then((proposalResponse) => {
        if (proposalResponse.error) {
          console.error("Error in proposal:", proposalResponse.error);
          alert("Error in proposal. Please try again.");
          return;
        }

        const buyRequest = { buy: proposalResponse.proposal.id, price };
        api.buy(buyRequest).then((buyResponse) => {
          if (buyResponse.error) {
            console.error("Error buying contract:", buyResponse.error);
            alert("Error buying contract. Please try again.");
          } else {
            console.log("Contract bought:", buyResponse);
            alert("Contract bought successfully!");
          }
        });
      })
      .catch((error) => {
        console.error("Proposal request error:", error);
        alert("Proposal request failed. Please try again.");
      });
  });
}

// --- Helper to calculate sentiment percentages ---
function calculatePercentages() {
  const percentages = [];
  const divElements = resultsContainer.getElementsByTagName("div");

  for (let i = 0; i < 2 && i < divElements.length; i++) {
    const textContent = divElements[i].textContent;
    const match = textContent.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }

  return percentages;
}

// --- Export everything needed ---
export {
  evaluateAndBuyContract,
  setAutomationMode,
  getAutomationMode,
  stopAutomation,
};
