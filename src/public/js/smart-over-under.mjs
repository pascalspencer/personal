import { buyContract, buyContractBulk, getAuthToken, waitForSettlement } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';
import { showLivePopup } from './livePopup.mjs';

// Strategy State
let running = false;
let tickHistory = [];
let tradeLock = false;
let tickWs = null;
let baseStake = 0;
let tradesCompleted = 0;
let sessionStats = { wins: 0, losses: 0 };
let awaitingRecovery = false;
let pingInterval = null;

// UI Elements
let overDigit, underDigit, tickCount, stakeInput, martingaleToggle, martingaleFactor;
let singleToggle, bulkToggle, resultsBox;
let digitStatsDisplay, tickGrid;

const HISTORY_LIMIT = 120;
const derivAppID = 61696;

document.addEventListener("DOMContentLoaded", () => {
  // UI Injection
  document.body.insertAdjacentHTML("beforeend", `
    <div id="smart-over-under" style="display:none">
      <div class="smart-card">
        <div class="smart-header">
          <h2 class="smart-title">Smart Over / Under</h2>
          <p class="smart-sub">Digit Analysis</p>
        </div>

        <div class="smart-form">
          <div class="analysis-section" style="margin-bottom: 20px;">
            <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
              (Last ${HISTORY_LIMIT} ticks)
            </div>
            
            <div id="sou-digit-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
              <!-- Digits 0-9 indicators -->
            </div>

            <div class="tick-header" style="margin-bottom: 8px; font-size: 0.9rem; color: #666;">Latest Tick</div>
            <div class="tick-grid" id="tick-grid-sou" style="display: flex; gap: 4px; overflow-x: hidden; height: 35px; align-items: center; justify-content: center; background: #f9f9f9; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
              <!-- Latest tick here -->
            </div>
          </div>

          <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="field">
              <label for="over-digit">OVER <</label>
              <select id="over-digit"></select>
            </div>
            <div class="field">
              <label for="under-digit">UNDER ></label>
              <select id="under-digit"></select>
            </div>
            <div class="field">
              <label for="tick-count-sou">Target Trades</label>
              <input type="number" id="tick-count-sou" min="1" value="5">
            </div>
            <div class="field">
              <label for="stake-sou">Stake (Min 0.35)</label>
              <input type="number" id="stake-sou" min="0.35" step="0.01" value="0.35">
            </div>
            
            <div class="toggle-container" style="grid-column: span 2; display: flex; justify-content: space-around; background: #f5f5f5; padding: 8px; border-radius: 6px; margin-bottom: 10px;">
              <label class="small-toggle">
                <span>Single</span>
                <input type="checkbox" id="single-toggle-sou" checked>
              </label>
              <label class="small-toggle">
                <span>Bulk</span>
                <input type="checkbox" id="bulk-toggle-sou">
              </label>
            </div>
          </div>

          <div class="action-area" style="text-align: center;">
            <button id="run-smart" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN</button>
            <div id="smart-results" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Ready</div>
          </div>

            <div id="martingale-config-sou" style="margin-top: 15px; padding: 12px; background: #f0f7ff; border: 1px solid #d0e3ff; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.85rem; font-weight: bold; color: #0056b3; text-transform: uppercase; letter-spacing: 0.5px;">Martingale Setup</div>
              <div id="sou-stats-display" style="font-size: 0.75rem; color: #0056b3; font-weight: bold;">W: 0 | L: 0</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: center;">
              <label class="small-toggle" style="background: white; border: 1px solid #d0e3ff; box-shadow: none;">
                <span>Auto-Recovery</span>
                <input type="checkbox" id="martingale-sou">
              </label>
              <div class="field" style="margin-bottom: 0;">
                <label for="martingale-factor-sou" style="font-size: 0.75rem; color: #666;">Multiplier</label>
                <input type="number" id="martingale-factor-sou" min="1.1" step="0.1" value="2.0" style="height: 32px; font-size: 0.85rem;">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  // Get UI elements
  overDigit = document.getElementById("over-digit");
  underDigit = document.getElementById("under-digit");
  tickCount = document.getElementById("tick-count-sou");
  stakeInput = document.getElementById("stake-sou");
  singleToggle = document.getElementById("single-toggle-sou");
  bulkToggle = document.getElementById("bulk-toggle-sou");
  resultsBox = document.getElementById("smart-results");
  digitStatsDisplay = document.getElementById("sou-digit-stats");
  tickGrid = document.getElementById("tick-grid-sou");
  martingaleToggle = document.getElementById("martingale-sou");
  martingaleFactor = document.getElementById("martingale-factor-sou");

  // Populate selects
  for (let i = 0; i <= 9; i++) {
    overDigit.innerHTML += `<option value="${i}">${i}</option>`;
    underDigit.innerHTML += `<option value="${i}">${i}</option>`;
  }
  overDigit.value = 5;
  underDigit.value = 4;

  // Mutually exclusive toggles
  function updateToggles(e) {
    if (e.target === singleToggle && singleToggle.checked) bulkToggle.checked = false;
    if (e.target === bulkToggle && bulkToggle.checked) singleToggle.checked = false;
  }
  singleToggle.addEventListener('change', updateToggles);
  bulkToggle.addEventListener('change', updateToggles);

  document.getElementById("run-smart").onclick = toggleSmart;

  // Market listener to restart stream
  const marketSelect = document.getElementById("market");
  const submarketSelect = document.getElementById("submarket");
  if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
  if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

  startTickStream();
});

function toggleSmart() {
  if (running) {
    stopSmart("Stopped by user");
  } else {
    runSmart();
  }
}

function runSmart() {
  const token = getAuthToken();
  if (!token) {
    alert("Please login first");
    return;
  }

  running = true;
  tradesCompleted = 0;
  tradeLock = false;
  baseStake = Number(stakeInput.value);
  sessionStats = { wins: 0, losses: 0 };
  updateStatsUI();

  const btn = document.getElementById("run-smart");
  btn.textContent = "STOP";
  btn.classList.add("stop");
  resultsBox.textContent = "Scanning...";
}

function stopSmart(msg) {
  running = false;
  const btn = document.getElementById("run-smart");
  if (btn) {
    btn.textContent = "RUN";
    btn.classList.remove("stop");
  }
  if (resultsBox) resultsBox.textContent = msg || "Ready";
}

function startTickStream() {
  if (tickWs) return;
  const submarket = document.getElementById("submarket")?.value || "R_100";

  try {
    tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

    tickWs.onopen = () => {
      console.log(`[Smart] Tick stream connected for ${submarket}`);
      tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
      startPing(tickWs);
    };

    tickWs.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.tick) {
        const quote = data.tick.quote.toString();
        const digit = Number(quote.slice(-1));

        // IMMEDIATE SYNCHRONOUS UPDATE for digit tracking accuracy
        tickHistory.push(digit);
        if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();
        updateUI();

        // ASYNC TRIGGERING to prevent event loop lag
        setTimeout(() => processTick(data.tick), 0);
      }
    };

    tickWs.onerror = (err) => {
      console.error("[Smart] Tick stream error:", err);
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = null;
    };

    tickWs.onclose = () => {
      console.warn(`[Smart] Tick stream closed. Reconnecting...
        Walkthrough:
        - [x] Fix WebSocket "freeze" issue with robust reconnection
        - [x] Fix "No token provided" error for bulk trades
        - [x] Verify bulk trade execution with token handling
        - [x] Optimize single trade speed for sub-second execution ("Direct Buy")`);

      if (pingInterval) clearInterval(pingInterval);
      pingInterval = null;
      tickWs = null;
      // Only reconnect if the panel is visible or strategy is running
      const panel = document.getElementById("smart-over-under");
      if (panel && panel.style.display !== "none") {
        setTimeout(startTickStream, 2000);
      }
    };
  } catch (e) {
    console.error("[Smart] Failed to start tick stream:", e);
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
        console.warn("[Smart] Ping failed", e);
      }
    }
  }, 20000);
}

function restartTickStream() {
  if (tickWs) {
    tickWs.onclose = () => { tickWs = null; startTickStream(); };
    tickWs.close();
  } else {
    startTickStream();
  }
}

function processTick(tick) {
  if (!running || tradeLock) return;

  const quote = tick.quote.toString();
  const digit = Number(quote.slice(-1));

  if (tradesCompleted >= Number(tickCount.value)) {
    stopSmart("Goal Reached");
    return;
  }

  const isOverTrigger = digit < Number(overDigit.value);
  const isUnderTrigger = digit > Number(underDigit.value);

  if (isOverTrigger || isUnderTrigger) {
    handleTrigger(quote, isOverTrigger, isUnderTrigger);
  }
}

async function handleTrigger(quote, isOver, isUnder) {
  const symbol = document.getElementById("submarket").value;

  if (bulkToggle.checked) {
    running = false; // Bulk runs once
    const count = Number(tickCount.value);
    resultsBox.textContent = `Deploying ${count} Bulk Trades...`;
    const token = getAuthToken();
    try {
      const resp = await buyContractBulk(symbol, isOver ? "DIGITOVER" : "DIGITUNDER", 1, stakeInput.value, isOver ? overDigit.value : underDigit.value, count, token ? [token] : []);
      if (resp) stopSmart("Bulk Complete");
    } catch (e) {
      console.error(e);
      stopSmart("Bulk Failed");
    }
    return;
  }

  // Single Mode
  tradeLock = true;
  const type = isOver ? "DIGITOVER" : "DIGITUNDER";
  const prediction = isOver ? overDigit.value : underDigit.value;
  resultsBox.textContent = `🎯 Triggered ${type} on ${quote.slice(-1)}`;

  try {
    const result = await executeTrade(symbol, type, prediction, quote);
    tradesCompleted++;

    // IMMEDIATELY UNLOCK so scanning continues while we wait for result in background
    tradeLock = false;

    // SuperMatches-style Tracking: Fast and Accurate background monitoring
    if (result && result.buy && martingaleToggle.checked) {
      monitorContractResults(result.buy.contract_id);
    }
  } catch (e) {
    console.error(e);
    tradeLock = false;
  }
}

function updateStatsUI() {
  const display = document.getElementById("sou-stats-display");
  if (display) {
    display.textContent = `W: ${sessionStats.wins} | L: ${sessionStats.losses}`;
  }
}

async function monitorContractResults(contractId) {
  awaitingRecovery = true;
  const token = getAuthToken();
  if (!token) {
    awaitingRecovery = false;
    return;
  }

  const martingaleBox = document.getElementById("martingale-config-sou");
  if (martingaleBox) martingaleBox.style.boxShadow = "0 0 10px rgba(0, 187, 240, 0.4)";

  const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
  let resolved = false;

  ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

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

      if (martingaleBox) martingaleBox.style.boxShadow = "none";

      if (contract.profit > 0) {
        sessionStats.wins++;
        stakeInput.value = baseStake;
      } else {
        sessionStats.losses++;
        const factor = Number(martingaleFactor.value) || 2.0;
        stakeInput.value = (Number(stakeInput.value) * factor).toFixed(2);
      }

      updateStatsUI();
      awaitingRecovery = false;
    }
  };

  ws.onerror = () => {
    if (!resolved) {
      resolved = true;
      ws.close();
      awaitingRecovery = false;
      if (martingaleBox) martingaleBox.style.boxShadow = "none";
    }
  };

  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      ws.close();
      awaitingRecovery = false;
      if (martingaleBox) martingaleBox.style.boxShadow = "none";
    }
  }, 60000);
}

async function executeTrade(symbol, type = "DIGITOVER", barrier = 0, liveQuote = null) {
  const stake = stakeInput.value;
  const resp = await buyContract(symbol, type, 1, stake, barrier, liveQuote, true);

  if (resp?.buy?.contract_id) {
    // Note: buyContract now handles its own livePopup trigger for parity
  } else if (resp?.error) {
    resultsBox.innerHTML = `<span style="color:red">Error: ${resp.error.message}</span>`;
  }

  return resp;
}

function updateUI() {
  if (!digitStatsDisplay) return;
  digitStatsDisplay.innerHTML = "";
  const dataSize = tickHistory.length;

  const scores = Array(10).fill(0);
  tickHistory.forEach((digit, index) => {
    const weight = 0.5 + (index / dataSize);
    scores[digit] += weight;
  });

  const totalScore = scores.reduce((a, b) => a + b, 0) || 1;
  const stats = scores.map((score, digit) => ({
    digit,
    heat: (score / totalScore) * 100,
    isRecent: tickHistory.slice(-5).includes(digit)
  }));

  stats.forEach(s => {
    const card = document.createElement("div");
    const isTrigger = (s.digit < Number(overDigit.value)) || (s.digit > Number(underDigit.value));
    card.style.cssText = `
            border: 1px solid #eee; border-radius: 6px; padding: 8px 4px; text-align: center;
            background: ${isTrigger ? '#fffde7' : '#fff'};
            border-bottom: 3px solid ${s.isRecent ? '#2196f3' : isTrigger ? '#fbc02d' : '#ddd'};
            transition: all 0.3s ease;
        `;
    card.innerHTML = `<div style="font-weight:bold; font-size:1.1rem; color:#333;">${s.digit}</div>
                          <div style="font-size:0.75rem; color:#666;">${s.heat.toFixed(1)}%</div>`;
    digitStatsDisplay.appendChild(card);
  });

  // 2. Update Latest Tick Display (Single prominent slot)
  const lastTick = tickHistory.length > 0 ? tickHistory[tickHistory.length - 1] : null;

  tickGrid.innerHTML = "";
  if (lastTick !== null) {
    const div = document.createElement("div");
    div.style.cssText = `
      width: 40px; height: 30px; display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; border-radius: 6px; flex-shrink: 0;
      background: #2196f3; color: #fff; font-weight: bold; border: 1px solid #2196f3;
      margin: 0 auto; transition: transform 0.1s ease;
    `;
    div.textContent = lastTick;
    tickGrid.appendChild(div);

    // Ensure the container centers the single item
    tickGrid.style.justifyContent = "center";
  }
}