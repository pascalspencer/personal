document.addEventListener("DOMContentLoaded", function () {
  const dataForm = document.getElementById("trade-form");
  const spinnerContainer = document.getElementById("spinner-container");
  const loadingMessage = document.getElementById("loading-message");
  const resultsContainer = document.getElementById("results-container");
  let sentimentsData = {};

  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Constants
  const MAX_PERCENTAGE = 93;
  const MATCH_CHANCE_FREQUENCY = 2 / 11;
  const RANDOM_DEVIATION_CHANCE = 0.2;
  const GENERAL_DEVIATION_CHANCE = 0.1;
  const DEVIATION_BASE = 90.0;
  const DEVIATION_RANGE = 35.0;
  const RANDOM_FREQUENCY_MIN = 8.0;
  const RANDOM_FREQUENCY_RANGE = 5.0;

  const MAX_PERCENTAGE_DIGIT = 93;
  const DEVIATION_BASE_DIGIT = 50.0;
  const DEVIATION_RANGE_DIGIT = 35.0;
  const RANDOM_FREQUENCY_MIN_DIGIT = 7.0;
  const RANDOM_FREQUENCY_RANGE_DIGIT = 6.0;
  const RANDOM_DEVIATION_CHANCE_DIGIT = 0.2;

  const deviationFrequenciesDigits = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 5,
    6: 4,
    7: 3,
    8: 2,
  };

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

    fetch("/api/data")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        const submarkets = data[market] || [];

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

  function addOption(selectElement, optionText) {
    const option = document.createElement("option");
    option.text = optionText;
    selectElement.add(option);
  }

  function determineBaseChances(selectedNumber) {
    const totalNumbers = numbers.length;
    const chance = 100 / totalNumbers;

    let higherChance = chance;
    let lowerChance = chance;

    return { higherChance, lowerChance };
  }

  function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
    if (
      Math.random() < RANDOM_DEVIATION_CHANCE &&
      selectedNumber > Math.min(...numbers) &&
      selectedNumber < Math.max(...numbers)
    ) {
      const increaseAmount = Math.random() * 10;
      higherChance = Math.min(higherChance + increaseAmount, MAX_PERCENTAGE);
      lowerChance = Math.max(lowerChance - increaseAmount, 0);
    }
    return { higherChance, lowerChance };
  }

  function applyGeneralDeviation(higherChance, lowerChance) {
    if (Math.random() < GENERAL_DEVIATION_CHANCE) {
      const deviationAmount = DEVIATION_BASE + Math.random() * DEVIATION_RANGE;
      higherChance = deviationAmount;
      lowerChance = MAX_PERCENTAGE - higherChance;
    }
    return { higherChance, lowerChance };
  }

  function determinePercentage(selectedNumber) {
    let { higherChance, lowerChance } = determineBaseChances(selectedNumber);
    ({ higherChance, lowerChance } = applyRandomDeviation(
      higherChance,
      lowerChance,
      selectedNumber
    ));
    ({ higherChance, lowerChance } = applyGeneralDeviation(
      higherChance,
      lowerChance
    ));

    higherChance = Math.min(higherChance, MAX_PERCENTAGE);
    lowerChance = Math.max(lowerChance, 0);

    const randomFrequency =
      Math.random() * RANDOM_FREQUENCY_RANGE + RANDOM_FREQUENCY_MIN;

    const differs = higherChance * randomFrequency;
    let matches = lowerChance * randomFrequency;

    if (Math.random() >= MATCH_CHANCE_FREQUENCY) {
      matches *= 0.1;
    }

    return {
      higherChance,
      lowerChance,
      randomFrequency,
      matches,
      differs,
    };
  }

  function determineChances(selectedNumber) {
    const { matches, differs } = determinePercentage(selectedNumber);

    const totalChance = matches + differs;

    const matchesChance = ((matches / totalChance) * 97).toFixed(2);
    const differsChance = ((differs / totalChance) * 97).toFixed(2);

    return { matchesChance, differsChance };
  }

  function calculateBaseChances(selectedNumber, max, min) {
    let higherChanceDigit, lowerChanceDigit;

    if (selectedNumber === max || selectedNumber === 9) {
      higherChanceDigit = 0;
      lowerChanceDigit = MAX_PERCENTAGE_DIGIT;
    } else if (selectedNumber === min || selectedNumber === 0) {
      higherChanceDigit = MAX_PERCENTAGE_DIGIT;
      lowerChanceDigit = 0;
    } else {
      higherChanceDigit = Math.min(
        ((max - selectedNumber) / (max - min)) * 100,
        MAX_PERCENTAGE_DIGIT
      );
      lowerChanceDigit = Math.min(
        ((selectedNumber - min) / (max - min)) * 100,
        MAX_PERCENTAGE_DIGIT
      );
    }

    return { higherChanceDigit, lowerChanceDigit };
  }

  function applyRandomDeviationDigit(
    higherChanceDigit,
    lowerChanceDigit,
    selectedNumber
  ) {
    if (
      Math.random() < RANDOM_DEVIATION_CHANCE_DIGIT &&
      selectedNumber > 1 &&
      selectedNumber < 9
    ) {
      const increaseAmountDigit = Math.random() * 10;
      higherChanceDigit = Math.min(
        higherChanceDigit + increaseAmountDigit,
        MAX_PERCENTAGE_DIGIT
      );
      lowerChanceDigit = Math.max(lowerChanceDigit - increaseAmountDigit, 0);
    }
    return { higherChanceDigit, lowerChanceDigit };
  }

  function applyFrequencyDeviationDigit(
    higherChanceDigit,
    lowerChanceDigit,
    selectedNumber
  ) {
    const deviationFrequencyDigit =
      deviationFrequenciesDigits[selectedNumber] || 1;

    if (Math.random() < deviationFrequencyDigit / 10) {
      const deviationAmountDigit =
        DEVIATION_BASE_DIGIT + Math.random() * DEVIATION_RANGE_DIGIT;
      higherChanceDigit = deviationAmountDigit;
      lowerChanceDigit = MAX_PERCENTAGE_DIGIT - higherChanceDigit;
    }

    higherChanceDigit = Math.min(higherChanceDigit, MAX_PERCENTAGE_DIGIT);
    lowerChanceDigit = Math.max(lowerChanceDigit, 0);

    return { higherChanceDigit, lowerChanceDigit };
  }

  function calculatePercentageDigit(selectedNumber) {
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);

    let { higherChanceDigit, lowerChanceDigit } = calculateBaseChances(
      selectedNumber,
      max,
      min
    );
    ({ higherChanceDigit, lowerChanceDigit } = applyRandomDeviationDigit(
      higherChanceDigit,
      lowerChanceDigit,
      selectedNumber
    ));
    ({ higherChanceDigit, lowerChanceDigit } = applyFrequencyDeviationDigit(
      higherChanceDigit,
      lowerChanceDigit,
      selectedNumber
    ));

    const randomFrequencyDigit =
      Math.random() * RANDOM_FREQUENCY_RANGE_DIGIT + RANDOM_FREQUENCY_MIN_DIGIT;
    const over = higherChanceDigit * randomFrequencyDigit;
    const under = lowerChanceDigit * randomFrequencyDigit;

    return {
      higherChanceDigit,
      lowerChanceDigit,
      randomFrequencyDigit,
      over,
      under,
    };
  }

  function calculateChances(selectedNumber) {
    const { over, under } = calculatePercentageDigit(selectedNumber);

    const totalChanceDigit = over + under;
    const overChance = ((over / totalChanceDigit) * 97).toFixed(2);
    const underChance = ((under / totalChanceDigit) * 97).toFixed(2);

    return { overChance, underChance };
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
