import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';

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

  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Constants
  const MAX_PERCENTAGE = 93;
  const MATCH_CHANCE_FREQUENCY = 2 / 11; // Probability of high match chance
  const RANDOM_DEVIATION_CHANCE = 0.2;
  const GENERAL_DEVIATION_CHANCE = 0.1;
  const DEVIATION_BASE = 90.0;
  const DEVIATION_RANGE = 35.0;
  const RANDOM_FREQUENCY_MIN = 8.0;
  const RANDOM_FREQUENCY_RANGE = 5.0;

  function determineBaseChances(selectedNumber) {
    const totalNumbers = numbers.length; // total numbers from 0 to 9
    const chance = 100 / totalNumbers;

    let higherChance, lowerChance;

    // Calculate chances based on selectedNumber
    higherChance = lowerChance = chance;

    return { higherChance, lowerChance };
  }

  function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
    if (
      Math.random() < RANDOM_DEVIATION_CHANCE &&
      selectedNumber > Math.min(...numbers) &&
      selectedNumber < Math.max(...numbers)
    ) {
      const increaseAmount = Math.random() * 10; // Increase by up to 10%
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

    // Ensure bounds are respected
    higherChance = Math.min(higherChance, MAX_PERCENTAGE);
    lowerChance = Math.max(lowerChance, 0);

    // Generate a random frequency between RANDOM_FREQUENCY_MIN and (RANDOM_FREQUENCY_MIN + RANDOM_FREQUENCY_RANGE)
    const randomFrequency =
      Math.random() * RANDOM_FREQUENCY_RANGE + RANDOM_FREQUENCY_MIN;

    // Multiply the chosen percentage by the random frequency
    const differs = higherChance * randomFrequency;
    let matches = lowerChance * randomFrequency;

    // Adjust match chance to be higher when deviation occurs
    if (
      Math.random() < RANDOM_DEVIATION_CHANCE &&
      selectedNumber > Math.min(...numbers) &&
      selectedNumber < Math.max(...numbers)
    ) {
      matches *= 2; // Increase match chance significantly during deviation
    } else {
      // Adjust match chance to be low most of the time
      if (Math.random() >= MATCH_CHANCE_FREQUENCY) {
        matches *= 0.1; // Reduce match chance significantly
      }
    }

    return {
      higherChance,
      lowerChance,
      randomFrequency,
      matches,
      differs,
    };
  }

  // Export a function to determine the chances
  function determineChances(selectedNumber) {
    const { matches, differs } = determinePercentage(selectedNumber);

    // Determine total chance
    const totalChance = matches + differs;

    // Determine matchesChance and differsChance percentages
    const matchesChance = Math.floor((matches / totalChance) * 97);
    const differsChance = Math.floor((differs / totalChance) * 97);

    return { matchesChance, differsChance };
  }

  // Deviation frequencies for specific numbers
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

  // Constants
  const MAX_PERCENTAGE_DIGIT = 93;
  const DEVIATION_BASE_DIGIT = 50.0;
  const DEVIATION_RANGE_DIGIT = 35.0;
  const RANDOM_FREQUENCY_MIN_DIGIT = 7.0;
  const RANDOM_FREQUENCY_RANGE_DIGIT = 6.0;
  const RANDOM_DEVIATION_CHANCE_DIGIT = 0.2;

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
    const overChance = Math.floor((over / totalChanceDigit) * 97);
    const underChance = Math.floor((under / totalChanceDigit) * 97);

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

  async function buyContract(symbol, tradeType, duration, price) {
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
    const api = new DerivAPIBasic({ connection });
  
    connection.onopen = async function () {
      try {
        // Send proposal request to the API and await the response
        const proposalResponse = await api.proposal(buyContractRequest);
  
        // Define the request object to buy the contract using the proposal ID
        const buyRequest = {
          buy: proposalResponse.proposal.id,
          price: price,
        };
  
        // Send buy request to the API and await the response
        const buyResponse = await api.buy(buyRequest);
  
        // Log the successful response and notify the user
        console.log("Contract bought:", buyResponse);
        alert("Contract bought successfully!");
      } catch (error) {
        // Log any errors and notify the user
        console.error("Error buying contract:", error);
        alert("Error buying contract. Please try again.");
      }
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