import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";


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
function getTradeTypeForSentiment(sentiment, index) {
  let tradingInstruments = {};
      fetch("/trade/instruments")
      .then((response) => response.json())
      .then((data) => {
          tradingInstruments = data;
      
      const sentimentParts = sentiment.split("/");
      if (sentimentParts[index]) {
      const selectedPart = sentimentParts[index].trim();

      console.log(tradingInstruments.trade_types[selectedPart])
      return tradingInstruments.trade_types[selectedPart];
      } else {
      console.error("Index out of bounds or sentiment part is undefined.");
      return null;
      }
  })
}


function evaluateAndBuyContract() {
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown.value;
  console.log(`selected sentiment: ${selectedSentiment}`);
  const percentages = calculatePercentages();
  const maxPercentage = Math.max(...percentages);

  if (maxPercentage < 40) {
    return;
  };

  const maxIndex = percentages.indexOf(maxPercentage);

  const fetchTradeType = async () => {
    try {
      const tradeTypeData = getTradeTypeForSentiment(selectedSentiment, maxIndex);
      return tradeTypeData;
    } catch (error) {
      console.error("Error fetching trade type:", error);
      return null;
    }
  }

  const getTradeType = async () => {
  const tradeType = await fetchTradeType();
  console.log(tradeType);
  
  if (!tradeType) {
    console.error("Invalid trade type derived from sentiment.");
    return;
  }

  const market = document.getElementById("market").value;
  const submarket = document.getElementById("submarket").value;

  let tradingInstruments = {};
  fetch("/trade/instruments")
    .then((response) => response.json())
    .then((data) => {
      tradingInstruments = data;
  
      const symbol = tradingInstruments.symbols[submarket];
      if (!symbol) {
        console.error("Invalid symbol derived from submarket.");
        return;
      }
  
      const price = parseFloat(document.getElementById("price").value);
      console.log(`Symbol: ${symbol}, Price: ${price}`);

      buyContract(symbol, tradeType, 1, price);
    })
    .catch((error) => {
      console.error("Error fetching trading instruments:", error);
    });
  }
  getTradeType();
  
}


// works
// Function to get query parameters from the URL
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function buyContract(symbol, tradeType, duration, price) {
  // Extract the currentLoginId from the URL
  const currentLoginId = getQueryParam("currentLoginId");

  if (!currentLoginId) {
    console.error("Login ID not found in URL");
    alert("Login ID not found in URL");
    return;
  }

  console.log("Current Login ID:", currentLoginId);

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
    loginid: currentLoginId,
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