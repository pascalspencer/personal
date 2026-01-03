// ==================================
// DERIV MATCHES + HEDGE STRATEGY
// ==================================

const WS_URL = "wss://ws.deriv.com/websockets/v3?app_id=1089";
const API_TOKEN = "PUT_YOUR_API_TOKEN_HERE";
const SYMBOL = "R_25";

// ---- RISK CONFIG ----
const STAKE = 1;
const MAX_MATCH_ATTEMPTS = 5;
const REQUIRED_ABSENCE = 70;
const HISTORY_LIMIT = 120;
const VOLATILITY_THRESHOLD = 0.35; // higher = more chaos

// ---- STATE ----
let ws;
let tickHistory = [];
let matchAttempts = 0;
let sessionWon = false;
let awaitingHedge = false;
let lastMatchDigit = null;

// ===============================
// CONNECT
// ===============================
ws = new WebSocket(WS_URL);

ws.onopen = () => {
  ws.send(JSON.stringify({ authorize: API_TOKEN }));
};

ws.onmessage = (msg) => handleMessage(JSON.parse(msg.data));

// ===============================
// MESSAGE HANDLER
// ===============================
function handleMessage(data) {
  if (data.msg_type === "authorize") subscribeTicks();
  if (data.msg_type === "tick") processTick(data.tick);
  if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract.is_sold) {
    handleResult(data.proposal_open_contract);
  }
}

// ===============================
// SUBSCRIBE TICKS
// ===============================
function subscribeTicks() {
  ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1 }));
}

// ===============================
// PROCESS TICK
// ===============================
function processTick(tick) {
  const digit = Number(tick.quote.toString().slice(-1));
  tickHistory.push(digit);
  if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

  renderTickCounter();

  if (!canTrade()) return;
  if (isVolatile()) return;

  const matchDigit = selectMatchDigit();
  if (matchDigit !== null) executeMatch(matchDigit);
}

// ===============================
// VISUAL TICK COUNTER
// ===============================
function renderTickCounter() {
  const counts = Array(10).fill(0);
  tickHistory.forEach(d => counts[d]++);

  console.clear();
  console.log("📊 DIGIT COUNTER (last", tickHistory.length, "ticks)");
  counts.forEach((c, d) => {
    console.log(`Digit ${d}: ${"█".repeat(c)} (${c})`);
  });
}

// ===============================
// VOLATILITY DETECTION
// ===============================
function isVolatile() {
  if (tickHistory.length < 50) return true;

  const counts = Array(10).fill(0);
  tickHistory.forEach(d => counts[d]++);

  const mean = tickHistory.length / 10;
  const variance = counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / 10;
  const chaos = Math.sqrt(variance) / mean;

  if (chaos > VOLATILITY_THRESHOLD) {
    console.log("⚠️ Volatility too high — trading paused");
    return true;
  }
  return false;
}

// ===============================
// DIGIT SELECTION (MATCH)
// ===============================
function selectMatchDigit() {
  if (tickHistory.length < REQUIRED_ABSENCE) return null;

  const stats = [...Array(10).keys()].map(d => ({
    digit: d,
    lastSeen: [...tickHistory].reverse().indexOf(d),
    freq: tickHistory.filter(x => x === d).length
  }));

  const candidates = stats.filter(
    d => d.lastSeen === -1 || d.lastSeen >= REQUIRED_ABSENCE
  );

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.freq - b.freq);

  return candidates[0].digit;
}

// ===============================
// TRADE CONDITIONS
// ===============================
function canTrade() {
  return !sessionWon && matchAttempts < MAX_MATCH_ATTEMPTS;
}

// ===============================
// EXECUTE MATCH
// ===============================
function executeMatch(digit) {
  matchAttempts++;
  lastMatchDigit = digit;

  console.log(`🎯 MATCH ${matchAttempts}/${MAX_MATCH_ATTEMPTS} → Digit ${digit}`);

  sendTrade("DIGITMATCH", digit);
}

// ===============================
// EXECUTE DIFFERS HEDGE
// ===============================
function executeHedge(digit) {
  console.log(`🛡️ HEDGE → DIFFERS ${digit}`);
  sendTrade("DIGITDIFF", digit);
}

// ===============================
// SEND TRADE
// ===============================
function sendTrade(type, digit) {
  ws.send(JSON.stringify({
    buy: 1,
    price: STAKE,
    parameters: {
      amount: STAKE,
      basis: "stake",
      contract_type: type,
      currency: "USD",
      duration: 1,
      duration_unit: "t",
      symbol: SYMBOL,
      barrier: digit
    }
  }));

  ws.send(JSON.stringify({ proposal_open_contract: 1, subscribe: 1 }));
}

// ===============================
// HANDLE RESULT
// ===============================
function handleResult(contract) {
  if (contract.profit > 0) {
    console.log("✅ WIN → Session complete");
    sessionWon = true;
    ws.close();
  } else {
    console.log("❌ LOSS");

    if (!awaitingHedge && lastMatchDigit !== null) {
      awaitingHedge = true;
      executeHedge(lastMatchDigit);
    } else {
      awaitingHedge = false;
    }
  }
}
