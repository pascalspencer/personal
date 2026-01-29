import { buyContract } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';
import { showLivePopup } from './livePopup.mjs';

let running = false;
let tickWs = null;
let tickHistory = [];
let lastMatchDigit = null;
let awaitingHedge = false;
let matchAttempts = 0;
let sessionWon = false;

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
                    <p class="smart-sub">Digit Match + Hedge Strategy</p>
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
                        <button id="run-super-matches" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN STRATEGY</button>
                        <div id="sm-status" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Strategy Ready</div>
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
  const token = getCurrentToken();
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
  statusDisplay.textContent = "Strategy Scanning...";
}

function stopStrategy(msg) {
  running = false;
  document.getElementById("run-super-matches").textContent = "RUN";
  document.getElementById("run-super-matches").classList.remove("stop");
  statusDisplay.textContent = msg || "Strategy Ready";
}

function startTickStream() {
  if (tickWs) return;

  const submarket = document.getElementById("submarket").value;
  if (!submarket) return;

  tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

  tickWs.onopen = () => {
    tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
  };

  tickWs.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.tick) {
      processTick(data.tick);
    }
  };

  tickWs.onclose = () => {
    tickWs = null;
    if (document.getElementById("super-matches-panel").style.display !== "none") {
      setTimeout(startTickStream, 2000);
    }
  };
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
  if (tickHistory.length < 50) return null; // Wait for some data

  const stats = [...Array(10).keys()].map(d => {
    const count = tickHistory.filter(x => x === d).length;
    const freq = (count / tickHistory.length) * 100;
    return { digit: d, freq };
  });

  // Sort by frequency descending
  stats.sort((a, b) => b.freq - a.freq);

  const best = stats[0];

  // Return best if it meets the frequency threshold
  if (best.freq >= minFrequency) {
    return best.digit;
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

  // Simplified result check for strategy flow
  // In a real scenario, we'd listen to the WS from buyContract or livePopup
  // For this pattern, we'll poll proposal_open_contract once

  const checkStatus = setInterval(async () => {
    const token = getCurrentToken();
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
      ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.proposal_open_contract && data.proposal_open_contract.is_sold) {
        const contract = data.proposal_open_contract;
        clearInterval(checkStatus);
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
  }, 2000);
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

  const stats = [...Array(10).keys()].map(d => {
    const count = tickHistory.filter(x => x === d).length;
    const freq = tickHistory.length > 0 ? (count / tickHistory.length) * 100 : 0;
    return { digit: d, freq };
  });

  stats.forEach(s => {
    const card = document.createElement("div");
    card.style.cssText = `
            border: 1px solid #eee;
            border-radius: 6px;
            padding: 8px 4px;
            text-align: center;
            background: ${s.freq >= minFrequency ? '#e8f5e9' : '#fff'};
            border-bottom: 3px solid ${s.freq >= minFrequency ? '#4caf50' : '#ddd'};
            transition: all 0.3s ease;
        `;

    const digitLabel = document.createElement("div");
    digitLabel.style.cssText = "font-weight: bold; font-size: 1.1rem; color: #333; margin-bottom: 2px;";
    digitLabel.textContent = s.digit;

    const freqLabel = document.createElement("div");
    freqLabel.style.cssText = "font-size: 0.75rem; color: #666;";
    freqLabel.textContent = s.freq.toFixed(1) + "%";

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
