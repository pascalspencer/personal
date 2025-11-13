import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';
import { calculateChances } from './over_under.mjs';
import { determineChances } from './matches.mjs';
import { evaluateAndBuyContract, getAutomationMode, setAutomationMode } from './buyContract.mjs';


document.addEventListener("DOMContentLoaded", function () {
  const dataForm = document.getElementById("trade-form");
  const spinnerContainer = document.getElementById("spinner-container");
  const loadingMessage = document.getElementById("loading-message");
  const resultsContainer = document.getElementById("results-container");
  const automationToggle = document.getElementById("automation-toggle");
  const modeLabel = document.getElementById("mode-label");

  // Handle toggle switch
  automationToggle.addEventListener("change", () => {
    const enabled = automationToggle.checked;
    setAutomationMode(enabled);
    modeLabel.textContent = enabled ? "Automated Mode" : "Manual Mode";

    // Optional instant feedback
    console.log(`Trading mode switched to: ${enabled ? "Automated" : "Manual"}`);
  });

  const derivAppID = 61696; 
  const connection = new WebSocket(
    `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`
  );
  let api;
  let sentimentsData = {};
  let submarkets = {};


  function showSpinnerAndMessages() {
    spinnerContainer.style.display = "block";
    document.body.classList.add("blur-background");
    loadingMessage.textContent = "Running simulations...";

    setTimeout(() => {
      loadingMessage.textContent = "Finalizing predictions...";
    }, 6500);

    setTimeout(() => {
      spinnerContainer.style.display = "none";
      loadingMessage.textContent = "";
      document.body.classList.remove("blur-background");

      displaySelectedOptionsAfterFetch();

      // ✅ Only auto-trade if automated mode is enabled
      if (getAutomationMode()) {
        console.log("Automated mode active — executing trade...");
        evaluateAndBuyContract();
      } else {
        console.log("Manual mode active — skipping auto-trade.");
      }
    }, 10500);
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


        submarkets = data[market] || [];


        submarkets.forEach((submarket) => {
          addOption(submarketDropdown, submarket);
        });


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


    ping();

    console.log("WebSocket connection established.");


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
