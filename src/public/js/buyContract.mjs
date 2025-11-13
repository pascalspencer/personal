import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";
import { getCurrentLoginId } from "./custom.mjs";


const derivAppID = 61696;
const connection = new WebSocket(
  `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`
);
let api;
const resultsContainer = document.getElementById("results-container");

// works
// Fetch trading instruments JSON
let tradingInstruments = {};
fetch("/trade/instruments")
  .then((response) => response.json())
  .then((data) => {
    tradingInstruments = data;
  })
  .catch((error) =>
    console.error("Error fetching trading instruments:", error)
  );

// --- automation control flag ---
let isAutomationEnabled = false;

// Function to toggle automation from outside this module
function setAutomationMode(enabled) {
  isAutomationEnabled = enabled;
  console.log("Automation mode:", enabled ? "ON" : "OFF");

  // Optionally start automation loop when turned on
  if (enabled) {
    startAutomation();
  }
}

// Run automated evaluation and buying repeatedly
let automationInterval = null;

function startAutomation() {
  if (automationInterval) clearInterval(automationInterval);

  automationInterval = setInterval(() => {
    if (isAutomationEnabled) {
      evaluateAndBuyContract();
    }
  }, 5000); // Runs every 5 seconds — adjust interval as needed
}

function stopAutomation() {
  isAutomationEnabled = false;
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
}

export { evaluateAndBuyContract, setAutomationMode, stopAutomation };



connection.onopen = function () {
  api = new DerivAPIBasic({ connection });

  // Call ping once the connection is open
  ping();

  console.log("WebSocket connection established.");
};


// works
function ping() {
  if (api) {
    setInterval(() => {
      api.ping();
    }, 30000);
  }
}


// works
async function getTradeTypeForSentiment(sentiment, index) {
  try {
    const response = await fetch("/trade/instruments");
    const tradingInstruments = await response.json();

    const sentimentParts = sentiment.split("/");
    if (sentimentParts[index]) {
      const selectedPart = sentimentParts[index].trim();

      console.log(tradingInstruments.trade_types[selectedPart]);
      return tradingInstruments.trade_types[selectedPart];
    } else {
      console.error("Index out of bounds or sentiment part is undefined.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching trade instruments:", error);
    return null;
  }
}

async function evaluateAndBuyContract() {
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown.value;
  console.log(`selected sentiment: ${selectedSentiment}`);
  const percentages = calculatePercentages();
  const maxPercentage = Math.max(...percentages);

  if (maxPercentage < 40) {
    return;
  }

  const maxIndex = percentages.indexOf(maxPercentage);

  try {
    const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex);
    console.log(tradeType);

    if (!tradeType) {
      console.error("Invalid trade type derived from sentiment.");
      return;
    }

    const market = document.getElementById("market").value;
    const submarket = document.getElementById("submarket").value;

    const response = await fetch("/trade/instruments");
    const tradingInstruments = await response.json();
  
    const symbol = tradingInstruments.symbols[submarket];
    if (!symbol) {
      console.error("Invalid symbol derived from submarket.");
      return;
    }

    const price = parseFloat(document.getElementById("price").value);
    console.log(`Symbol: ${symbol}, Price: ${price}`);

    buyContract(symbol, tradeType, 1, price);
  } catch (error) {
    console.error("Error fetching trade instruments or trade type:", error);
  }
}


// works
// // Function to get query parameters from the URL
// function getQueryParam(param) {
//   const urlParams = new URLSearchParams(window.location.search);
//   return urlParams.get(param);
// }

let isLoginIdLoaded = false; // Flag to track if the login ID has been loaded
let cachedLoginId = null; // Variable to cache the login ID

function loadLoginId(callback) {
    if (isLoginIdLoaded) {
        // If already loaded, execute the callback with the cached login ID
        return callback(cachedLoginId);
    }

    // Define the function to load the login ID
    const loadId = function() {
        const currentLoginId = getCurrentLoginId();

        if (!currentLoginId) {
            console.error("Login ID not found in URL");
            // Uncomment the next line if you want to alert the user
            // alert("Login ID not found in URL");
            cachedLoginId = null; // Set cachedLoginId to null if not found
            callback(null); // Call the callback with null if no ID found
            return;
        }

        console.log("Current Login ID:", currentLoginId);
        cachedLoginId = currentLoginId; // Cache the login ID
        isLoginIdLoaded = true; // Mark as loaded
        callback(currentLoginId); // Call the callback with the ID
    };

    // Add event listener to window.onload if not already set
    if (typeof window.onload === "function") {
        const originalOnLoad = window.onload;
        window.onload = function() {
            originalOnLoad();
            loadId(); // Call the loadId function
        };
    } else {
        window.onload = loadId; // Set loadId as the onload function
    }
}


function buyContract(symbol, tradeType, duration, price) {
  // Load the login ID and proceed with the contract proposal once it's available
  loadLoginId(function(loginId) {
      if (!loginId) {
        console.error("Login ID not found in callback function");
          return; // Exit if no loginId
      }

      // Define the request object for the contract proposal
      const buyContractRequest = {
          proposal: 1,
          amount: price,
          basis: "stake",
          contract_type: tradeType,
          currency: "USD",
          duration: duration,
          duration_unit: "t",
          symbol: symbol,
          loginid: loginId, // Use the loginId obtained from the callback
      };

      // Send proposal request to the API
      api.proposal(buyContractRequest).then((proposalResponse) => {
          if (proposalResponse.error) {
              console.error("Error in proposal response:", proposalResponse.error);
              alert("Error in proposal response. Please try again.");
              return;
          }

          // Define the request object to buy the contract using the proposal ID
          const buyRequest = {
              buy: proposalResponse.proposal.id,
              price: price,
          };

          // Send buy request to the API
          api.buy(buyRequest).then((buyResponse) => {
              if (buyResponse.error) {
                  console.error("Error buying contract:", buyResponse.error);
                  alert("Error buying contract. Please try again.");
              } else {
                  // Log the successful response and notify the user
                  console.log("Contract bought:", buyResponse);
                  alert("Contract bought successfully!");
              }
          });
      })
      .catch((error) => {
          console.error("Error in proposal request:", error);
          alert("Error in proposal request. Please try again.");
      });
  });
}

// works
function calculatePercentages() {
  const percentages = [];
  const divElements = resultsContainer.getElementsByTagName("div");

  for (let i = 0; i < 2 && i < divElements.length; i++) {
    const textContent = divElements[i].textContent;
    const percentageMatch = textContent.match(/\((\d+)%\)/);
    if (percentageMatch) {
      percentages.push(parseInt(percentageMatch[1], 10));
    }
  }

  return percentages;
}


export { evaluateAndBuyContract };