import { buyContract, buyContractBulk } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';
import { showLivePopup } from './livePopup.mjs';

// Strategy State
let running = false;
let tickHistory = [];
let tradeLock = false;
let tickWs = null;
let baseStake = 0;
let tradesCompleted = 0;

// UI Elements
let overDigit, underDigit, tickCount, stakeInput;
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
          <p class="smart-sub">Digit Analysis & Strategy</p>
        </div>

        <div class="smart-form">
          <div class="analysis-section" style="margin-bottom: 20px;">
            <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
              Digit Heat Map (Weighted last ${HISTORY_LIMIT} ticks)
            </div>
            
            <div id="sou-digit-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
              <!-- Digits 0-9 indicators -->
            </div>

            <div class="tick-header" style="margin-bottom: 8px; font-size: 0.9rem; color: #666;">Live Tick Stream</div>
            <div class="tick-grid" id="tick-grid-sou" style="display: flex; gap: 4px; overflow-x: hidden; height: 35px; align-items: center; background: #f9f9f9; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
              <!-- Ticks flow here -->
            </div>
          </div>

          <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="field">
              <label for="over-digit">Trigger OVER if <</label>
              <select id="over-digit"></select>
            </div>
            <div class="field">
              <label for="under-digit">Trigger UNDER if ></label>
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
            
            <div class="toggle-container" style="grid-column: span 2; display: flex; justify-content: space-around; background: #f5f5f5; padding: 8px; border-radius: 6px;">
              <label class="small-toggle">
                <span>Single (Sequential)</span>
                <input type="checkbox" id="single-toggle-sou" checked>
              </label>
              <label class="small-toggle">
                <span>Bulk (Concurrent)</span>
                <input type="checkbox" id="bulk-toggle-sou">
              </label>
            </div>
          </div>

          <div class="action-area" style="text-align: center;">
            <button id="run-smart" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN STRATEGY</button>
            <div id="smart-results" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Strategy Ready</div>
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
  const token = getCurrentToken();
  if (!token) {
    alert("Please login first");
    return;
  }

  running = true;
  tradesCompleted = 0;
  tradeLock = false;
  baseStake = Number(stakeInput.value);

  const btn = document.getElementById("run-smart");
  btn.textContent = "STOP STRATEGY";
  btn.classList.add("stop");
  resultsBox.textContent = "Strategy Scanning...";
}

function stopSmart(msg) {
  running = false;
  const btn = document.getElementById("run-smart");
  if (btn) {
    btn.textContent = "RUN STRATEGY";
    btn.classList.remove("stop");
  }
  if (resultsBox) resultsBox.textContent = msg || "Strategy Ready";
}

function startTickStream() {
  if (tickWs) return;
  const submarket = document.getElementById("submarket")?.value || "R_100";
  tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
  tickWs.onopen = () => tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
  tickWs.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.tick) processTick(data.tick);
  };
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
  const quote = tick.quote.toString();
  const digit = Number(quote.slice(-1));

  tickHistory.push(digit);
  if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

  updateUI();

  if (!running || tradeLock) return;

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
    try {
      const resp = await buyContractBulk(symbol, isOver ? "DIGITOVER" : "DIGITUNDER", 1, stakeInput.value, isOver ? overDigit.value : underDigit.value, count);
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

    // Martingale
    if (result && result._meta) {
      const profit = Number(result._meta.profit);
      if (profit < 0) {
        stakeInput.value = (Number(stakeInput.value) * 2.1).toFixed(2);
      } else if (profit > 0) {
        stakeInput.value = baseStake;
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    tradeLock = false;
  }
}

async function executeTrade(symbol, type = "DIGITOVER", barrier = 0, liveQuote = null) {
  // 1. Capture Balance (Meta Data)
  let startingBalance = null;
  try {
    const token = getCurrentToken();
    if (token) {
      const tempWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
      const bal = await new Promise(res => {
        tempWs.onopen = () => { tempWs.send(JSON.stringify({ authorize: token })); tempWs.send(JSON.stringify({ balance: 1 })); };
        tempWs.onmessage = (e) => { const m = JSON.parse(e.data); if (m.balance) { tempWs.close(); res(m.balance.balance); } };
        setTimeout(() => { try { tempWs.close(); } catch (e) { } res(null); }, 2000);
      });
      startingBalance = bal;
    }
  } catch (e) { }

  const resp = await buyContract(symbol, type, 1, stakeInput.value, barrier, liveQuote, true);

  if (resp?.buy?.contract_id) {
    showLivePopup(resp.buy.contract_id, {
      tradeType: type,
      stake: stakeInput.value,
      payout: resp.buy.payout,
      balance: startingBalance
    });
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

  tickGrid.innerHTML = "";
  tickHistory.slice(-25).forEach((t, i, arr) => {
    const div = document.createElement("div");
    const isLast = i === arr.length - 1;
    div.style.cssText = `
            min-width: 25px; height: 25px; display: flex; align-items: center; justify-content: center;
            font-size: 0.85rem; border-radius: 4px; flex-shrink: 0;
            background: ${isLast ? '#2196f3' : '#fff'}; color: ${isLast ? '#fff' : '#333'};
            border: 1px solid ${isLast ? '#2196f3' : '#ddd'}; font-weight: ${isLast ? 'bold' : 'normal'};
        `;
    div.textContent = t;
    tickGrid.appendChild(div);
  });
  tickGrid.scrollLeft = tickGrid.scrollWidth;
}