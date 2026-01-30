import { buyContract, getAuthToken } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';
import { showLivePopup } from './livePopup.mjs';

let running = false;
let tickWs = null;
let tickHistory = [];
let lastMatchDigit = null;
let awaitingHedge = false;
let matchAttempts = 0;
let sessionWon = false;
let pingInterval = null;

// UI Elements
let stakeInput, maxAttemptsInput, absenceInput, volatilityInput;
let tickGrid, absenceDisplay, statusDisplay;

const HISTORY_LIMIT = 120;
const derivAppID = 61696;

document.addEventListener("DOMContentLoaded", () => {
  // Inject Super Matches UI
  document.body.insertAdjacentHTML("beforeend", `
        <div id="super-matches-panel" style="display: none;">
            <div class="smart-card">
                <div class="smart-header">
                    <h2 class="smart-title">Super Matches</h2>
                    <p class="smart-sub">Digit Match</p>
                </div>

                <div class="smart-form">
                    <div class="analysis-section" style="margin-bottom: 20px;">
                        <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                            Digit Analysis (Last ${HISTORY_LIMIT} ticks)
                        </div>
                        
                        <!-- Digit Statistics Grid (Symmetrical 2x5) -->
                        <div id="sm-digit-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
                            <!-- Digits 0-9 indicators will be here -->
                        </div>

                        <div class="tick-header" style="margin-bottom: 8px; font-size: 0.9rem; color: #666;">Live Tick Stream</div>
                        <div class="tick-grid" id="tick-grid-sm" style="display: flex; gap: 4px; overflow-x: hidden; height: 35px; align-items: center; background: #f9f9f9; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
                            <!-- Ticks will flow here -->
                        </div>
                    </div>

                    <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="field">
                            <label for="sm-absence">Min Frequency (%)</label>
                            <input type="number" id="sm-absence" min="1" max="100" value="15">
                        </div>
                        <div class="field">
                            <label for="sm-max-attempts">Max Attempts</label>
                            <input type="number" id="sm-max-attempts" min="1" value="5">
                        </div>
                        <div class="field">
                            <label for="sm-volatility">Volatility Limit</label>
                            <input type="number" id="sm-volatility" step="0.01" value="0.35">
                        </div>
                        <div class="field">
                            <label for="sm-stake">Stake (Min 0.35)</label>
                            <input type="number" id="sm-stake" min="0.35" step="0.01" value="0.35">
                        </div>
                    </div>

                    <div class="action-area" style="text-align: center;">
                        <button id="run-super-matches" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN</button>
                        <div id="sm-status" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Ready</div>
                    </div>
                </div>
            </div>
        </div>
    `);

  // Get UI elements
  stakeInput = document.getElementById("sm-stake");
  maxAttemptsInput = document.getElementById("sm-max-attempts");
  absenceInput = document.getElementById("sm-absence");
  volatilityInput = document.getElementById("sm-volatility");
  tickGrid = document.getElementById("tick-grid-sm");
  absenceDisplay = document.getElementById("sm-digit-stats"); // Now using the grid container
  statusDisplay = document.getElementById("sm-status");

  document.getElementById("run-super-matches").onclick = toggleStrategy;

  // Market listeners
  const marketSelect = document.getElementById("market");
  const submarketSelect = document.getElementById("submarket");

  if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
  if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

  startTickStream();
});

function toggleStrategy() {
  if (running) {
    stopStrategy("Stopped by user");
  } else {
    startStrategy();
  }
}

function startStrategy() {
  const token = getAuthToken();
  if (!token) {
    alert("Please login first");
    return;
  }

  running = true;
  sessionWon = false;
  matchAttempts = 0;
  awaitingHedge = false;
  lastMatchDigit = null;

  document.getElementById("run-super-matches").textContent = "STOP";
  document.getElementById("run-super-matches").classList.add("stop");
  statusDisplay.textContent = "Scanning...";
}

function stopStrategy(msg) {
  running = false;
  document.getElementById("run-super-matches").textContent = "RUN";
  document.getElementById("run-super-matches").classList.remove("stop");
  statusDisplay.textContent = msg || "Ready";
}

function startTickStream() {
  if (tickWs) return;

  const submarket = document.getElementById("submarket")?.value;
  if (!submarket) return;

  try {
    tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

    tickWs.onopen = () => {
      console.log(`[SuperMatch] Tick stream connected for ${submarket}`);
      tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
      startPing(tickWs);
    };

    tickWs.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.tick) {
        processTick(data.tick);
      }
    };

    tickWs.onerror = (err) => {
      console.error("[SuperMatch] Tick stream error:", err);
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = null;
    };

    tickWs.onclose = () => {
      console.warn("[SuperMatch] Tick stream closed. Reconnecting...");
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = null;
      tickWs = null;
      // Only reconnect if the panel is visible or strategy is running
      const smPanel = document.getElementById("super-matches-panel");
      if (smPanel && smPanel.style.display !== "none") {
        setTimeout(startTickStream, 2000);
      }
    };
  } catch (e) {
    console.error("[SuperMatch] Failed to start tick stream:", e);
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = null;
    setTimeout(startTickStream, 5000);
  }
}

function startPing(ws) {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ ping: 1 }));
      } catch (e) {
        console.warn("[SuperMatch] Ping failed", e);
      }
    }
  }, 20000);
}

function restartTickStream() {
  if (tickWs) {
    tickWs.close();
  } else {
    startTickStream();
  }
}

function processTick(tick) {
  const quote = tick.quote.toString();
  const digit = Number(quote.slice(-1));

  tickHistory.push(digit);
  if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

  updateUI();

  if (!running) return;
  if (awaitingHedge) return;

  // Volatility check
  if (isVolatile()) {
    statusDisplay.innerHTML = '<span style="color: orange;">⚠️ High Volatility - Paused</span>';
    return;
  }

  if (matchAttempts >= Number(maxAttemptsInput.value)) {
    stopStrategy("Max attempts reached");
    return;
  }

  const matchDigit = selectMatchDigit();
  if (matchDigit !== null) {
    executeMatch(matchDigit);
  } else {
    statusDisplay.textContent = "Scanning for hot digit...";
  }
}

function isVolatile() {
  if (tickHistory.length < 50) return false;

  const counts = Array(10).fill(0);
  tickHistory.forEach(d => counts[d]++);

  const mean = tickHistory.length / 10;
  const variance = counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / 10;
  const chaos = Math.sqrt(variance) / mean;

  return chaos > Number(volatilityInput.value);
}

function selectMatchDigit() {
  const minFrequency = Number(absenceInput.value);
  const dataSize = tickHistory.length;

  // Need at least a small sample (reduced from 50 to 15 for faster start)
  if (dataSize < 15) return null;

  // 1. Calculate weighted frequency
  // Newer ticks contribute more to the "Hot" score
  const scores = Array(10).fill(0);

  tickHistory.forEach((digit, index) => {
    // Weight increases linearly from 0.5 (oldest) to 1.5 (newest)
    const weight = 0.5 + (index / dataSize);
    scores[digit] += weight;
  });

  // Convert scores to a relative "Heat" percentage for UI display consistency
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const heatStats = scores.map((score, digit) => ({
    digit,
    heat: (score / totalScore) * 100,
    // Check if appeared in the very last 5 ticks (Trend detection)
    recentCount: tickHistory.slice(-5).filter(x => x === digit).length
  }));

  // Sort by Heat descending
  heatStats.sort((a, b) => b.heat - a.heat);

  const best = heatStats[0];

  // Best Judgment Criteria:
  // 1. Must exceed the Min Frequency (user setting)
  // 2. Stronger preference if it appeared in the last 5 ticks (momentum)
  if (best.heat >= minFrequency) {
    // Prediction logic: if it's hot AND has appeared recently, it's a high probability "Repeat"
    if (best.recentCount >= 1) {
      return best.digit;
    }

    // Fallback: If it's EXTREMELY hot (e.g., > 25%), trade it anyway
    if (best.heat > 25) {
      return best.digit;
    }
  }

  return null;
}

async function executeMatch(digit) {
  matchAttempts++;
  lastMatchDigit = digit;
  statusDisplay.innerHTML = `🎯 Trading MATCH on Digit ${digit} (Attempt ${matchAttempts})`;

  try {
    const symbol = document.getElementById("submarket").value;
    const stake = stakeInput.value;

    const resp = await buyContract(symbol, "DIGITMATCH", 1, stake, digit);
    if (resp && resp.buy) {
      showLivePopup(resp.buy.contract_id, {
        tradeType: "DIGITMATCH",
        stake: stake,
        payout: resp.buy.payout
      });
      handleTradeExecution(resp.buy.contract_id);
    } else {
      console.error("Match Buy Failed", resp);
      setTimeout(() => { if (running) awaitingHedge = false; }, 2000);
    }
  } catch (e) {
    console.error(e);
    awaitingHedge = false;
  }
}

async function handleTradeExecution(contractId) {
  awaitingHedge = true;

  const token = getAuthToken();
  if (!token) {
    awaitingHedge = false;
    return;
  }

  const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
  let resolved = false;

  ws.onopen = () => {
    ws.send(JSON.stringify({ authorize: token }));
  };

  ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    if (data.msg_type === 'authorize' && !data.error) {
      ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
    }

    if (data.proposal_open_contract && data.proposal_open_contract.is_sold) {
      const contract = data.proposal_open_contract;
      if (resolved) return;
      resolved = true;
      ws.close();

      if (contract.profit > 0) {
        stopStrategy("✅ WIN - Session Complete");
        sessionWon = true;
      } else {
        statusDisplay.innerHTML = `❌ Match Lost. Deploying HEDGE...`;
        await executeHedge(lastMatchDigit);
      }
    }
  };

  ws.onerror = (err) => {
    console.error("[SuperMatch] Contract monitor error:", err);
    if (!resolved) {
      resolved = true;
      ws.close();
      awaitingHedge = false;
    }
  };

  // Safety timeout: if no result after 60 seconds, unlock
  setTimeout(() => {
    if (!resolved) {
      console.warn("[SuperMatch] Contract monitor timed out.");
      resolved = true;
      ws.close();
      awaitingHedge = false;
    }
  }, 60000);
}

async function executeHedge(digit) {
  try {
    const symbol = document.getElementById("submarket").value;
    const stake = stakeInput.value;

    const resp = await buyContract(symbol, "DIGITDIFF", 1, stake, digit);
    if (resp && resp.buy) {
      showLivePopup(resp.buy.contract_id, {
        tradeType: "DIGITDIFF",
        stake: stake,
        payout: resp.buy.payout
      });

      // After hedge, we continue scanning for the next match
      setTimeout(() => {
        awaitingHedge = false;
        if (running) statusDisplay.textContent = "Scanning for next opportunity...";
      }, 5000);
    }
  } catch (e) {
    console.error(e);
    awaitingHedge = false;
  }
}

function updateUI() {
  // 1. Update Digit Stats Grid (Symmetrical 2x5)
  absenceDisplay.innerHTML = "";
  const minFrequency = Number(absenceInput.value);
  const dataSize = tickHistory.length;

  const scores = Array(10).fill(0);
  tickHistory.forEach((digit, index) => {
    const weight = 0.5 + (index / dataSize);
    scores[digit] += weight;
  });

  const totalScore = scores.reduce((a, b) => a + b, 0) || 1;
  const stats = scores.map((score, digit) => {
    const heat = (score / totalScore) * 100;
    const isRecent = tickHistory.slice(-5).includes(digit);
    return { digit, heat, isRecent };
  });

  stats.forEach(s => {
    const card = document.createElement("div");
    const isHot = s.heat >= minFrequency;
    const hasMomentum = s.isRecent && isHot;

    card.style.cssText = `
            border: 1px solid #eee;
            border-radius: 6px;
            padding: 8px 4px;
            text-align: center;
            background: ${hasMomentum ? '#e8f5e9' : isHot ? '#fffde7' : '#fff'};
            border-bottom: 3px solid ${hasMomentum ? '#4caf50' : isHot ? '#fbc02d' : '#ddd'};
            box-shadow: ${hasMomentum ? 'inset 0 0 5px rgba(76,175,80,0.2)' : 'none'};
            transition: all 0.3s ease;
        `;

    const digitLabel = document.createElement("div");
    digitLabel.style.cssText = `font-weight: bold; font-size: 1.1rem; color: #333; margin-bottom: 2px; ${hasMomentum ? 'text-shadow: 0 0 2px rgba(0,0,0,0.1);' : ''}`;
    digitLabel.textContent = s.digit;

    const freqLabel = document.createElement("div");
    freqLabel.style.cssText = "font-size: 0.75rem; color: #666; font-weight: 500;";
    freqLabel.textContent = s.heat.toFixed(1) + "%";

    card.appendChild(digitLabel);
    card.appendChild(freqLabel);
    absenceDisplay.appendChild(card);
  });

  // 2. Update Tick Stream (Horizontal)
  tickGrid.innerHTML = "";
  // Show only as many as fit (approx 15-20)
  const displayTicks = tickHistory.slice(-25);
  displayTicks.forEach((t, i) => {
    const div = document.createElement("div");
    div.className = "tick-item";
    const isLast = i === displayTicks.length - 1;

    div.style.cssText = `
            min-width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
            border-radius: 4px;
            background: ${isLast ? '#2196f3' : '#fff'};
            color: ${isLast ? '#fff' : '#333'};
            border: 1px solid ${isLast ? '#2196f3' : '#ddd'};
            font-weight: ${isLast ? 'bold' : 'normal'};
            flex-shrink: 0;
        `;
    div.textContent = t;
    tickGrid.appendChild(div);
  });
  // Ensure last tick is visible
  tickGrid.scrollLeft = tickGrid.scrollWidth;
}
