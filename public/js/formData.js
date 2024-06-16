import { calculateChances  as calculateDigitChances } from "./digit.js"
import { determineChances as calculateMatchesChances } from "./matches.js"
document.addEventListener("DOMContentLoaded", function () {
  const dataForm = document.getElementById("trade-form");
  const spinnerContainer = document.getElementById("spinner-container");
  const loadingMessage = document.getElementById("loading-message");
  const resultsContainer = document.getElementById("results-container");
  let sentimentsData = {};

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
    }, 8500);
  }

  function populateSubmarkets() {
    const market = document.getElementById("market").value;
    const submarketDropdown = document.getElementById("submarket");
    submarketDropdown.innerHTML = "";

    fetch('/api/data')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Ensure data[market] exists and is an array
      const submarkets = data[market] || [];

      // Populate submarket dropdown
      submarkets.forEach(submarket => {
        addOption(submarketDropdown, submarket);
      });

      // Enable and make submarket dropdown required
      submarketDropdown.disabled = false;
      submarketDropdown.required = true;
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
    });
  }

  function populateSentiments() {
    const sentimentData = document.getElementById("contract_type").value;
    const sentimentDropdown = document.getElementById("sentiment");
    sentimentDropdown.innerHTML = "";

    const sentiments = sentimentsData[sentimentData] || [];
    sentiments.forEach(sentiment => addOption(sentimentDropdown, sentiment));

    const selectedSentiment = sentimentDropdown.value;

    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";
    }
    else if (["Even/Odd"].includes(selectedSentiment)){
      document.getElementById("digit-value").style.display = "none";
    }

    sentimentDropdown.disabled = false;
  }

  function addOption(selectElement, optionText) {
    const option = document.createElement("option");
    option.text = optionText;
    selectElement.add(option);
  }

  function displaySelectedOptionsAfterFetch() {
    const sentimentDropdown = document.getElementById("sentiment");
    const selectedSentiment = sentimentDropdown.value;
    const selectedNumber = parseInt(document.getElementById("input-value").value, 10);

    const { overChance, underChance } = calculateDigitChances(selectedNumber);
    const { matchesChance, differsChance } = calculateMatchesChances(selectedNumber);

    const sentimentParts = selectedSentiment.split("/");
    const percentages = sentimentParts.map(generatePercentage);

    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "block";

    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";

      sentimentParts.forEach((part, index) => {
        const optionElement = document.createElement("div");
        if (part.trim() === "Matches") {
          optionElement.textContent = `Matches (${matchesChance}%) Stop trade after selected Ticks`;
        } else if (part.trim() === "Differs") {
          optionElement.textContent = `Differs (${differsChance}%) Stop trade after selected Ticks`;
        } else if (part.trim() === "Over") {
          optionElement.textContent = `Over (${overChance}%) Stop trade after selected Ticks`;
        } else if (part.trim() === "Under") {
          optionElement.textContent = `Under (${underChance}%) Stop trade after selected Ticks`;
        } else {
          optionElement.textContent = `${part.trim()} (${percentages[index]}%) Stop trade after selected Ticks`;
        }
        resultsContainer.appendChild(optionElement);
      });
    }
    else if (["Even/Odd"].includes(selectedSentiment)){
      document.getElementById("digit-value").style.display = "none";
    }
     else {
      document.getElementById("digit-value").style.display = "none";
      sentimentParts.forEach((part, index) => {
        const optionElement = document.createElement("div");
        optionElement.textContent = `${part.trim()} (${percentages[index]}%) Stop trade after selected Ticks`;
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

    fetch('/trade/data')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Assuming data structure like { Multipliers: [...], up_and_down: [...], high_and_low: [...], digits: [...] }
      sentimentsData = {
        Multipliers: data.Multipliers || [],
        up_and_down: data.up_and_down || [],
        high_and_low: data.high_and_low || [],
        digits: data.digits || []
      };

    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
    });
  document.getElementById("market").addEventListener("change", populateSubmarkets);
  document.getElementById("contract_type").addEventListener("change", populateSentiments);
  window.addEventListener("load", populateSubmarkets);

  dataForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showSpinnerAndMessages();
  });
});
