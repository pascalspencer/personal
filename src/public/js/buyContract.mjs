import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
let api;
const resultsContainer = document.getElementById("results-container");

// --- WebSocket connection ---
connection.onopen = function () {
  api = new DerivAPIBasic({ connection });
  ping();
  console.log("WebSocket connection established.");

  document.addEventListener("DOMContentLoaded", async () => {
      const token = getCurrentToken();
      if (!token) {
          console.warn("No token found at authorization.");
          return;
      }

      console.log("Authorizing with token:", token);

      try {
          const resp = await api.authorize(token);
          console.log("Authorize response:", resp);
      } catch (err) {
          console.error("Authorization failed:", err);
      }
  });
};



// --- Ping keep-alive ---
let pingInterval = null;
  function ping() {
    if (!api || pingInterval) return;
    pingInterval = setInterval(() => api.ping(), 30000);
  }

function getCurrentToken() {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("userToken");

    if (urlToken) {
        localStorage.setItem("userToken", urlToken);
        console.log("Saved User Token from query:", urlToken);
        return urlToken;
    }

    const stored = localStorage.getItem("userToken");
    if (stored) {
        console.log("Loaded User Token from storage:", stored);
        return stored;
    }

    return null;
}

// --- Automation Mode Control ---
let isAutomationEnabled = false;
let automationInterval = null;

export function setAutomationMode(enabled) {
  isAutomationEnabled = enabled;
  console.log("Automation mode:", enabled ? "ON" : "OFF");
}

export function getAutomationMode() {
  return isAutomationEnabled;
}

// --- Fetch live trading instruments from backend ---
let tradingInstruments = null;

async function fetchLiveInstruments() {
  if (tradingInstruments) return tradingInstruments;

  try {
    const response = await fetch("/api/data"); // backend fetch from Deriv API
    tradingInstruments = await response.json();
    return tradingInstruments;
  } catch (err) {
    console.error("Error fetching live trading instruments:", err);
    return {};
  }
}

// --- Safe Evaluate & Buy ---
async function evaluateAndBuyContractSafe() {
  console.log("Automation tick…");

  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;
  const tradeDigit = document.getElementById("input-value")?.value;

  if (!market) return console.warn("⛔ Market not selected");
  if (!submarket) return console.warn("⛔ Submarket not selected");
  if (!selectedSentiment) return console.warn("⛔ Sentiment not selected");
  

  const instruments = await fetchLiveInstruments();
  console.log("Fetched instruments:", instruments);

  const percentages = calculatePercentages();
  console.log("Percentages:", percentages);

  if (percentages.length < 2) {
    return console.warn("⛔ Not enough sentiment data");
  }

  const maxPercentage = Math.max(...percentages);
  const maxIndex = percentages.indexOf(maxPercentage);

  if (maxPercentage < 40) {
    return console.warn("⛔ No strong sentiment (>=40%)");
  }

  console.log(`Winning sentiment index = ${maxIndex}`);

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex, submarket);
  console.log("Trade type:", tradeType);

  if (!tradeType) {
    return console.error("⛔ Could not map sentiment → trade type");
  }

  const price = parseFloat(document.getElementById("price")?.value || 1);

  console.log(`🔥 Automated mode active — executing trade
  Symbol: ${submarket}
  Type: ${tradeType}
  Price: ${price}
  Digit: ${tradeDigit}`);

  buyContract(submarket, tradeType, 1, price, tradeDigit);
}

async function getTradeTypeForSentiment(sentiment, index) {
  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;

  const selected = parts[index].trim().toLowerCase();
  if (!selected) return null;

  // Minimal, reliable mapping
  const map = {
    "touch": "ONETOUCH",
    "no touch": "NOTOUCH",
    "rise": "CALL",
    "fall": "PUT",
    "higher": "TICKHIGH",
    "lower": "TICKLOW",
    "matches": "DIGITMATCH",
    "differs": "DIGITDIFF",
    "even": "DIGITEVEN",
    "odd": "DIGITODD",
    "over": "DIGITOVER",
    "under": "DIGITUNDER",
    "up": "MULTUP",
    "down": "MULTDOWN"
  };

  for (const key in map) {
    if (selected.includes(key)) return map[key];
  }

  console.warn("No mapping for:", selected);
  return null;
}

// --- Wait for first live tick ---
async function waitForFirstTick(symbol) {
  return new Promise((resolve, reject) => {
    if (!api || api.is_closed) return reject("API not connected");

    const tickStream = api.subscribe({ ticks: symbol });

    tickStream.onMessage = msg => {
      if (msg.tick && msg.tick.quote !== undefined) {
        console.log("📈 First tick received:", msg.tick.quote);
        tickStream.unsubscribe();    // stop stream
        resolve(msg.tick.quote);     // return live price
      }
    };

    tickStream.onError = err => {
      console.error("❌ Tick subscription error:", err);
      try { tickStream.unsubscribe(); } catch (e) {}
      reject(err);
    };
  });
}



// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price, prediction = null) {
  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return;
  }


  console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
  console.log("⏳ Subscribing to live ticks (authorized) before requesting proposal…");

  // 2) Subscribe and wait for first tick (ensures we have live price & active subscription)
  let livePrice;
  try {
    livePrice = await waitForFirstTick(symbol);
  } catch (err) {
    console.error("❌ Could not get live tick:", err);
    return;
  }

  console.log("🔥 Using live tick:", livePrice);

  //------------------------------------------
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol: symbol,
    duration: duration,
    duration_unit: "t"
  };

  // ---- VANILLA CONTRACTS (Rise/Fall, Touch/No Touch) ----
  if (["CALL", "PUT", "ONETOUCH", "NOTOUCH"].includes(tradeType)) {
    proposal.contract_type = tradeType;
  }

  // ---- DIGIT CONTRACTS ----
  else if (tradeType.startsWith("DIGIT")) {
    proposal.contract_type = tradeType;

    // These contracts REQUIRE prediction
    if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
      if (prediction === null || isNaN(prediction)) {
        console.warn("⚠️ Digit contract requires prediction (0-9). Defaulting to 0.");
        proposal.prediction = tradeDigit || 0;
      } else {
        proposal.prediction = Number(prediction);
      }
    }

    // EVEN / ODD → no prediction required
  }

  // ---- MULTIPLIER CONTRACTS ----
  else if (["MULTUP", "MULTDOWN"].includes(tradeType)) {
    proposal.contract_type = tradeType;
    
    // Deriv requires multiplier field
    proposal.multiplier = 10; // default – can be updated to user selection
  }

  // ---- UNKNOWN CONTRACT FALLBACK ----
  else {
    console.warn(`⚠️ Unknown contract type: ${tradeType}`);
    proposal.contract_type = tradeType;
  }


  //------------------------------------------
  // 6. REQUEST PROPOSAL
  //------------------------------------------
  let proposalResp;
  try {
    proposalResp = await api.proposal(proposal);
    console.log("Proposal response:", proposalResp);
  } catch (err) {
    console.error("❌ Proposal request failed:", err);
    return;
  }

  if (!proposalResp || proposalResp.error) {
    console.error("❌ Proposal error:", proposalResp.error);
    return;
  }

  const propId = proposalResp.proposal.id;
  console.log("🆔 Proposal ID:", propId);


  //------------------------------------------
  // 7. BUY CONTRACT
  //------------------------------------------
  let buyResp;
  try {
    buyResp = await api.buy({ buy: propId, price });
    console.log("Buy response:", buyResp);
  } catch (err) {
    console.error("❌ Buy call failed:", err);
    return;
  }

  if (buyResp.error) {
    console.error("❌ Buy error:", buyResp.error);
    return;
  }

  console.log("🎉 Contract bought successfully:", buyResp);
  return buyResp;
}


// --- Helper to calculate sentiment percentages ---
function calculatePercentages() {
  const percentages = [];
  const divs = resultsContainer?.getElementsByTagName("div") || [];
  for (let i = 0; i < 2 && i < divs.length; i++) {
    const match = divs[i].textContent?.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }
  return percentages;
}

// --- Export for automation ---
export { evaluateAndBuyContractSafe };
