import { getCurrentLoginId } from "./custom.mjs";

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
