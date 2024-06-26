import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';
import { calculateChances } from './over_under.mjs';
import { determineChances } from './matches.mjs';

document.addEventListener("DOMContentLoaded", function () {
  const dataForm = document.getElementById("trade-form");
  const spinnerContainer = document.getElementById("spinner-container");
  const loadingMessage = document.getElementById("loading-message");
  const resultsContainer = document.getElementById("results-container");
  const derivAppID = 61696; // Replace with your actual app ID
  const connection = new WebSocket(
    `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`
  );
  let api;
  let sentimentsData = {};
  let submarkets = {}

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

  function showSpinnerAndMessages() {
    spinnerContainer.style.display = "block";
    document.body.classList.add("blur-background");
    loadingMessage.textContent = "Running simulations...";

    setTimeout(() => {
      loadingMessage.textContent = "Finalizing predictions...";
    }, 4500);

    setTimeout(() => {
      spinnerContainer.style.display = "none";
      loadingMessage.textContent = "";
      document.body.classList.remove("blur-background");
      displaySelectedOptionsAfterFetch();
      evaluateAndBuyContract();
    }, 8500);
  }

  function getTradeTypeForSentiment(sentiment, index) {
    const sentimentParts = sentiment.split("/");
    if (sentimentParts[index]) {
      const selectedPart = sentimentParts[index].trim();
      return tradingInstruments.trade_types[selectedPart];
    } else {
      console.error("Index out of bounds or sentiment part is undefined.");
      return null;
    }
  }

  function evaluateAndBuyContract() {
    const sentimentDropdown = document.getElementById("sentiment");
    const selectedSentiment = sentimentDropdown.value;
    const percentages = calculatePercentages();
    const maxPercentage = Math.max(...percentages);
    const maxIndex = percentages.indexOf(maxPercentage);

    const tradeType = getTradeTypeForSentiment(selectedSentiment, maxIndex);
    if (!tradeType) {
      console.error("Invalid trade type derived from sentiment.");
      return;
    }

    const market = document.getElementById("market").value;
    const submarket = document.getElementById("submarket").value;

    const symbol = tradingInstruments.symbols[submarket];
    if (!symbol) {
      console.error("Invalid symbol derived from submarket.");
      return;
    }

    const price = parseFloat(document.getElementById("price").value);

    buyContract(symbol, tradeType, 1, price);
  }

  function populateSubmarkets() {
    const market = document.getElementById("market").value;
    const submarketDropdown = document.getElementById("submarket");
    submarketDropdown.innerHTML = "";

    fetch("/api/data")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Ensure data[market] exists and is an array
        submarkets = data[market] || [];

        // Populate submarket dropdown
        submarkets.forEach((submarket) => {
          addOption(submarketDropdown, submarket);
        });

        // Enable and make submarket dropdown required
        submarketDropdown.disabled = false;
        submarketDropdown.required = true;
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  }

 
  

  function populateSentiments() {
    const sentimentData = document.getElementById("contract_type").value;
    const sentimentDropdown = document.getElementById("sentiment");
    sentimentDropdown.innerHTML = "";

    const sentiments = sentimentsData[sentimentData] || [];
    sentiments.forEach((sentiment) => addOption(sentimentDropdown, sentiment));

    const selectedSentiment = sentimentDropdown.value;

    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";
    } else if (["Even/Odd"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "none";
    } else {
      document.getElementById("digit-value").style.display = "none";
    }

    sentimentDropdown.disabled = false;
  }

  connection.onopen = function () {
    api = new DerivAPIBasic({ connection });

    // Call ping once the connection is open
    ping();

    console.log("WebSocket connection established.");

    // Fetch sentiments data once the WebSocket connection is open
    fetch("/trade/data")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        sentimentsData = data;
        populateSentiments();
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });

      fetch("/api/data")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Ensure data exists and is an array
      submarkets = data;
      populateSubmarkets();
      })
  };

  connection.onerror = function (error) {
    console.error("WebSocket error:", error);
  };

  function ping() {
    if (api) {
      setInterval(() => {
        api.ping();
      }, 30000);
    }
  }

  function buyContract(symbol, tradeType, duration, price) {
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
    };
  
    // Initialize the WebSocket connection and Deriv API instance
  
    connection.onopen = function () {
      const api = new DerivAPIBasic({ connection });
  
      // Send proposal request to the API
      api.proposal(buyContractRequest, function (proposalResponse) {
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
        api.buy(buyRequest, function (buyResponse) {
          if (buyResponse.error) {
            console.error("Error buying contract:", buyResponse.error);
            alert("Error buying contract. Please try again.");
          } else {
            // Log the successful response and notify the user
            console.log("Contract bought:", buyResponse);
            alert("Contract bought successfully!");
          }
        });
      });
    };
  
    connection.onerror = function (error) {
      console.error("WebSocket error:", error);
      alert("WebSocket error. Please try again.");
    };
  
    connection.onclose = function () {
      console.log("WebSocket connection closed.");
    };
  }
  
    

    if (connection.readyState === WebSocket.OPEN) {
      connection.onopen(); // Call the onopen handler directly if the connection is already open
    } 
    else {
      connection.onopen = function () {
        api = new DerivAPIBasic({ connection });
        ping(); // Ensure ping is called once the connection is open
        console.log("WebSocket connection established.");
      };
    }
  

  function addOption(selectElement, optionText) {
    const option = document.createElement("option");
    option.text = optionText;
    selectElement.add(option);
  }

  function displaySelectedOptionsAfterFetch() {
    const sentimentDropdown = document.getElementById("sentiment");
    const selectedSentiment = sentimentDropdown.value;
    const selectedNumber = parseInt(
      document.getElementById("input-value").value,
      10
    );

    const { overChance, underChance } = calculateChances(selectedNumber);
    const { matchesChance, differsChance } = determineChances(selectedNumber);

    const sentimentParts = selectedSentiment.split("/");
    const percentages = sentimentParts.map(generatePercentage);

    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "block";

    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";

      sentimentParts.forEach((part, index) => {
        const optionElement = document.createElement("div");
        if (part.trim() === "Matches") {
          optionElement.textContent = `Matches (${matchesChance}%) Stop trade`;
        } else if (part.trim() === "Differs") {
          optionElement.textContent = `Differs (${differsChance}%) Stop trade`;
        } else if (part.trim() === "Over") {
          optionElement.textContent = `Over (${overChance}%) Stop trade`;
        } else if (part.trim() === "Under") {
          optionElement.textContent = `Under (${underChance}%) Stop trade`;
        } else {
          optionElement.textContent = `${part.trim()} (${
            percentages[index]
          }%) Stop trade`;
        }
        resultsContainer.appendChild(optionElement);
      });
    } else {
      document.getElementById("digit-value").style.display = "none";
      sentimentParts.forEach((part, index) => {
        const optionElement = document.createElement("div");
        optionElement.textContent = `${part.trim()} (${
          percentages[index]
        }%) Stop trade`;
        resultsContainer.appendChild(optionElement);
      });
    }
  }

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

  function generatePercentage() {
    let percentage;
    do {
      percentage = Math.floor(Math.random() * 87) + 1;
    } while (percentage === 50);
    return percentage;
  }

  fetch("/trade/data")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      // Assuming data structure like { Multipliers: [...], up_and_down: [...], high_and_low: [...], digits: [...] }
      sentimentsData = {
        Multipliers: data.Multipliers || [],
        up_and_down: data.up_and_down || [],
        high_and_low: data.high_and_low || [],
        digits: data.digits || [],
      };
    })
    .catch((error) => {
      console.error("There was a problem with the fetch operation:", error);
    });
  document
    .getElementById("market")
    .addEventListener("change", populateSubmarkets);
  document
    .getElementById("contract_type")
    .addEventListener("change", populateSentiments);
  window.addEventListener("load", populateSubmarkets);

  dataForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showSpinnerAndMessages();
  });
});
