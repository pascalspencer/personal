import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";
import { getCurrentLoginId } from "./custom.mjs";

const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${derivAppID}`);
let api;
const resultsContainer = document.getElementById("results-container");

// --- WebSocket connection ---
connection.onopen = function () {
  api = new DerivAPIBasic({ connection });
  ping();
  console.log("WebSocket connection established.");
};

// --- Ping keep-alive ---
function ping() {
  if (api) setInterval(() => api.ping(), 30000);
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
  Price: ${price}`);

  buyContract(submarket, tradeType, 1, price);
}

// Dynamic mapping: fetch available contract types for the symbol and choose the best match
async function getTradeTypeForSentiment(sentiment, index, symbol) {
  if (!api) {
    console.error("API not ready.");
    return null;
  }

  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;
  const selected = parts[index].trim();
  if (!selected) return null;

  // Request contracts_for for this symbol (use product_type/basic per docs)
  const req = {
    contracts_for: symbol,
    currency: "USD",
    landing_company: "svg",
    product_type: "basic",
  };

  const resp = await api.contracts_for(req).catch(err => {
    console.error("contracts_for failed:", err);
    return null;
  });
  if (!resp || resp.error) {
    console.error("contracts_for error:", resp?.error);
    return null;
  }

  const available = resp.contracts_for.available || [];
  if (!available.length) {
    console.warn("No available contracts returned for", symbol);
    return null;
  }

  // Build a searchable list of {type, display}
  const dynamic = available.map(c => ({
    type: c.contract_type,                  // e.g. "DIGITUNDER"
    display: (c.contract_display || "").toLowerCase(), // human name
    raw: c
  }));

  const lower = selected.toLowerCase();

  // 1) Direct match on display or contract_type
  let found = dynamic.find(d =>
    d.display.includes(lower) || d.type.toLowerCase() === lower || d.type.toLowerCase().includes(lower)
  );
  if (found) return found.type;

  // 2) Keyword-based fallback mapping (broad)
  const keywordMap = [
    [["touch"], ["ONETOUCH", "TOUCH", "ONE_TOUCH", "ONETOUCH"]],
    [["no touch","notouch","no-touch"], ["NOTOUCH","NO_TOUCH"]],
    [["rise","call","call e","call"], ["CALLE","CALL","RISE","CALL"]],
    [["fall","put"], ["PUTE","PUT","FALL"]],
    [["higher","up","higher than","upwards"], ["TICKHIGH","HIGHTICK","HIGH"]], // ticks variants
    [["lower","down"], ["TICKLOW","LOWTICK","LOW"]],
    [["match","matches"], ["DIGITMATCH","DIGITMATCH"]],
    [["diff","differs"], ["DIGITDIFF","DIGITDIFF"]],
    [["even"], ["DIGITEVEN"]],
    [["odd"], ["DIGITODD"]],
    [["over"], ["DIGITOVER"]],
    [["under"], ["DIGITUNDER"]],
    [["mult","multiplier","up","down (mult)"], ["MULTUP","MULTDOWN"]]
  ];

  for (const [keywords, types] of keywordMap) {
    if (keywords.some(k => lower.includes(k))) {
      // try to find any available contract whose type is in `types`
      const matched = dynamic.find(d => types.some(t => d.type.toUpperCase().includes(t.toUpperCase())));
      if (matched) return matched.type;
    }
  }

  // 3) Greedy fuzzy: look for any contract_display token in selected
  for (const d of dynamic) {
    const tokens = d.display.split(" ").filter(Boolean);
    if (tokens.some(t => lower.includes(t))) return d.type;
  }

  console.warn("No dynamic match found for sentiment part:", selected, "available:", dynamic.map(d => d.type));
  return null;
}


// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price) {
  if (!api) {
    console.error("API not ready. WebSocket not connected.");
    return;
  }
  console.log(`Preparing trade for ${symbol} (${tradeType})...`);

  // fetch contracts_for
  const req = {
    contracts_for: symbol,
    currency: "USD",
    landing_company: "svg",
    product_type: "basic",
  };

  const resp = await api.contracts_for(req).catch(err => {
    console.error("contracts_for request failed:", err);
    return null;
  });
  if (!resp || resp.error) {
    console.error("contracts_for error:", resp?.error);
    return;
  }

  const available = resp.contracts_for.available || [];
  // Prefer exact type match, otherwise try matching by display
  let contract = available.find(c => c.contract_type === tradeType);
  if (!contract) {
    contract = available.find(c => (c.contract_display || "").toLowerCase().includes(tradeType.toLowerCase()));
  }
  if (!contract) {
    console.error(`⛔ Contract type ${tradeType} not available for ${symbol}`);
    console.log("Available types:", available.map(c => c.contract_type));
    return;
  }

  // Examine durations from the returned specs
  // contracts_for commonly returns min_contract_duration / max_contract_duration objects
  const minDur = contract.min_contract_duration || {};
  const maxDur = contract.max_contract_duration || {};
  const minUnit = minDur.unit || null; // "s", "t", "m", etc.
  const maxUnit = maxDur.unit || minUnit;

  // Helper to check duration validity (convert units only when same unit; doc responses typically align)
  // If ticks are supported, minUnit === "t"
  let chosenUnit = minUnit || "s"; // fallback
  if (minUnit === "t") chosenUnit = "t";
  else chosenUnit = minUnit || "s";

  // Validate passed duration against min/max (units assumed same)
  if (typeof duration === "number" && minDur.value != null && maxDur.value != null) {
    if (duration < minDur.value || duration > maxDur.value) {
      console.warn(`Duration ${duration}${chosenUnit} out of bounds for ${tradeType}: allowed ${minDur.value}-${maxDur.value} ${chosenUnit}`);
      return;
    }
  }

  // Build proposal
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol,
  };

  // Add duration/duration_unit when contract expects one (multipliers may not)
  const isMultiplier = (contract.contract_category && contract.contract_category.toLowerCase().includes("multiplier")) ||
                       tradeType.toUpperCase().includes("MULT");
  if (!isMultiplier) {
    if (chosenUnit) {
      proposal.duration = duration;
      proposal.duration_unit = chosenUnit;
    }
  }

  // Determine barrier requirements and set barrier if needed
  // contract.barriers may be 0,1,2; for DIGIT* contracts we must set barrier 0-9
  const barriers = contract.barriers || 0;

  if (barriers === 1) {
    // If server provided a barrier use it; else derive one:
    // - For DIGIT* use a random digit 0-9
    // - Otherwise use last tick price (rounded) as a sensible barrier
    if (contract.barrier) {
      proposal.barrier = String(contract.barrier);
    } else if (String(tradeType).toUpperCase().startsWith("DIGIT")) {
      proposal.barrier = String(Math.floor(Math.random() * 10)); // 0-9
    } else {
      // fetch latest tick to compute barrier near current price
      const tickResp = await api.ticks({ ticks: symbol }).catch(err => {
        console.warn("ticks fetch failed:", err);
        return null;
      });
      if (tickResp && tickResp.echo_req && tickResp.tick && tickResp.tick.quote != null) {
        // choose barrier close to current price (string). For many contracts barrier expects numeric string.
        proposal.barrier = String(tickResp.tick.quote);
      } else if (contract.high_barrier || contract.low_barrier) {
        proposal.barrier = String(contract.high_barrier || contract.low_barrier);
      } else {
        console.error("Barrier required but no source found (server didn't provide barrier and tick fetch failed). Aborting.");
        return;
      }
    }
  } else if (barriers === 2) {
    // double barrier: derive from contract.high_barrier/low_barrier if available
    if (contract.high_barrier && contract.low_barrier) {
      // Deriv expects barrier as "high:low" in some endpoints — but for safety we abort and log.
      console.error("Double-barrier contract detected; automatic handling not implemented. high_barrier/low_barrier:", contract.high_barrier, contract.low_barrier);
      return;
    } else {
      console.error("Double-barrier contract requires both barriers; server did not provide. Aborting.");
      return;
    }
  }

  // Attach barrier if determined
  if (proposal.barrier !== undefined) {
    console.log("Using barrier:", proposal.barrier);
  }

  console.log("📤 Sending proposal:", proposal);

  // Propose and then buy
  try {
    const pResp = await api.proposal(proposal);
    if (pResp.error) {
      console.error("Proposal error:", pResp.error);
      return;
    }

    // proposal successful — take the id
    const propId = pResp.proposal && pResp.proposal.id;
    if (!propId) {
      console.error("Proposal response did not include id:", pResp);
      return;
    }

    // execute buy with returned proposal id and price
    const buyResp = await api.buy({ buy: propId, price }).catch(err => {
      console.error("Buy call failed:", err);
      return null;
    });
    if (!buyResp) return;
    if (buyResp.error) {
      console.error("Buy error:", buyResp.error);
      return;
    }

    console.log("Contract bought successfully:", buyResp);
    return buyResp;
  } catch (err) {
    console.error("Proposal/buy sequence failed:", err);
  }
}




// --- Login ID Loader ---
let cachedLoginId = null;

function getCachedLoginId() {
  if (cachedLoginId) return cachedLoginId;

  const loginId = getCurrentLoginId();
  if (!loginId) {
    console.error("Login ID missing. Cannot trade.");
    return null;
  }

  cachedLoginId = loginId;
  return cachedLoginId;
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
