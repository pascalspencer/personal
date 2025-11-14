import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';
import { calculateChances } from './over_under.mjs';
import { determineChances } from './matches.mjs';
import { evaluateAndBuyContractSafe, getAutomationMode, setAutomationMode } from './buyContract.mjs';

document.addEventListener("DOMContentLoaded", function () {
  const dataForm = document.getElementById("trade-form");
  const spinnerContainer = document.getElementById("spinner-container");
  const loadingMessage = document.getElementById("loading-message");
  const resultsContainer = document.getElementById("results-container");

  // Top toggle
  const modeToggle = document.getElementById("mode-toggle");
  const modeDisplay = document.getElementById("mode-display");

  if (modeToggle && modeDisplay) {
    modeToggle.addEventListener("change", () => {
      const enabled = modeToggle.checked;
      setAutomationMode(enabled);
      modeDisplay.innerHTML = `Current Mode: <strong>${enabled ? "Automated" : "Manual"}</strong>`;
      console.log(`Trading mode switched to: ${enabled ? "Automated" : "Manual"}`);
    });
  } else {
    console.warn("#mode-toggle or #mode-display not found in DOM!");
  }

  let api;
  let sentimentsData = {};
  let marketsData = {};

  const derivAppID = 61696;
  const connection = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`);

  // --- WebSocket connection ---
  connection.onopen = () => {
    api = new DerivAPIBasic({ connection });
    ping();
    console.log("WebSocket connection established.");

    // Fetch live sentiments & market data
    fetch("/trade/data")
      .then((res) => res.json())
      .then((data) => sentimentsData = data)
      .catch((err) => console.error("Error fetching trade data:", err));

    fetch("/api/data")
      .then((res) => res.json())
      .then((data) => {
        marketsData = data;
        populateSubmarkets();
      })
      .catch((err) => console.error("Error fetching live markets:", err));
  };

  connection.onerror = (err) => console.error("WebSocket error:", err);

  function ping() {
    if (api) setInterval(() => api.ping(), 30000);
  }

  function populateSubmarkets() {
    const marketSelect = document.getElementById("market");
    const submarketSelect = document.getElementById("submarket");

    const selectedMarket = marketSelect.value || Object.keys(marketsData)[0];

    submarketSelect.innerHTML = `<option value="">Select Submarket</option>`;

    console.log("Populating submarkets for market:", selectedMarket, marketsData[selectedMarket]);


    marketsData[selectedMarket].forEach(({ symbol, display_name }) => {
      const option = document.createElement("option");
      option.value = symbol;            // actual symbol for trading
      option.textContent = display_name; // human-readable
      submarketSelect.appendChild(option);
    });

    submarketSelect.disabled = false;
  }


  // Event listener
  document.getElementById("market").addEventListener("change", populateSubmarkets);


  // --- Populate Sentiments dynamically ---
  function populateSentiments() {
    const contractType = document.getElementById("contract_type").value;
    const sentimentDropdown = document.getElementById("sentiment");
    sentimentDropdown.innerHTML = "";

    const sentiments = sentimentsData[contractType] || [];
    sentiments.forEach((sent) => addOption(sentimentDropdown, sent));

    const selectedSentiment = sentimentDropdown.value;
    document.getElementById("digit-value").style.display =
      ["Matches/Differs", "Over/Under"].includes(selectedSentiment) ? "block" : "none";

    sentimentDropdown.disabled = !sentiments.length;
  }

  // --- Display results ---
  function displaySelectedOptionsAfterFetch() {
    const sentimentDropdown = document.getElementById("sentiment");
    const selectedSentiment = sentimentDropdown.value;
    const selectedNumber = parseInt(document.getElementById("input-value").value, 10);

    const { overChance, underChance } = calculateChances(selectedNumber);
    const { matchesChance, differsChance } = determineChances(selectedNumber);

    const sentimentParts = selectedSentiment.split("/");
    const percentages = sentimentParts.map(generatePercentage);

    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "block";

    sentimentParts.forEach((part, index) => {
      const optionElement = document.createElement("div");
      if (part.trim() === "Matches") optionElement.textContent = `Matches (${matchesChance}%) Stop trade`;
      else if (part.trim() === "Differs") optionElement.textContent = `Differs (${differsChance}%) Stop trade`;
      else if (part.trim() === "Over") optionElement.textContent = `Over (${overChance}%) Stop trade`;
      else if (part.trim() === "Under") optionElement.textContent = `Under (${underChance}%) Stop trade`;
      else optionElement.textContent = `${part.trim()} (${percentages[index]}%) Stop trade`;
      resultsContainer.appendChild(optionElement);
    });

    document.getElementById("digit-value").style.display =
      ["Matches/Differs", "Over/Under"].includes(selectedSentiment) ? "block" : "none";
  }

  function generatePercentage() {
    let pct;
    do { pct = Math.floor(Math.random() * 87) + 1; } while (pct === 50);
    return pct;
  }

  function addOption(selectElement, optionText) {
    const option = document.createElement("option");
    option.text = optionText;
    selectElement.add(option);
  }

  // --- Event listeners ---
  document.getElementById("market").addEventListener("change", populateSubmarkets);
  document.getElementById("contract_type").addEventListener("change", populateSentiments);
  window.addEventListener("load", populateSubmarkets);

  dataForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showSpinnerAndMessages();
  });

  function showSpinnerAndMessages() {
    spinnerContainer.style.display = "block";
    document.body.classList.add("blur-background");
    loadingMessage.textContent = "Running simulations...";

    setTimeout(() => {
      spinnerContainer.style.display = "none";
      loadingMessage.textContent = "";
      document.body.classList.remove("blur-background");

      displaySelectedOptionsAfterFetch();

      if (getAutomationMode()) {
        console.log("Automated mode active — executing trade...");
        evaluateAndBuyContractSafe();
      } else {
        console.log("Manual mode active — skipping auto-trade.");
      }
    }, 10500);
  }
});
