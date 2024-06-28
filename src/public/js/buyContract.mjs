import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';


connection.onopen = function () {
    api = new DerivAPIBasic({ connection });

    // Call ping once the connection is open
    ping();

    console.log("WebSocket connection established.");
}

function ping() {
    if (api) {
      setInterval(() => {
        api.ping();
      }, 30000);
    }
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


  function buyContract(symbol, tradeType, duration, price) {
    fetch("/loginId")
      .then(response => response.json())
      .then((currentLoginId) => {
        const currentUserLoginId = currentLoginId;
        console.log("Current Login ID:", currentUserLoginId);
  
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
          loginid: currentUserLoginId
        };
  
        // Send proposal request to the API
        api.proposal(buyContractRequest).then(proposalResponse => {
          if (proposalResponse.error) {
            console.error("Error in proposal response:", proposalResponse.error);
            alert("Error in proposal response. Please try again.");
            return;
          }

          // Define the request object to buy the contract using the proposal ID
          const buyRequest = {
            buy: proposalResponse.proposal.id,
            price: price
          };

          // Send buy request to the API
          api.buy(buyRequest).then(buyResponse => {
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
      })
  
      .catch(error => {
        console.error("Error fetching login ID:", error);
        // alert("Error fetching login ID. Please try again.");
      });
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
