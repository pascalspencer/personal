import { buyContract, getAuthToken } from "./buyContract.mjs";
import { showLivePopup } from './livePopup.mjs';

let running = false;
let checkingForEntry = false;
let tickWs = null;
let tickHistory = [];
let completedTrades = 0;
let maxTradesPerSession = 100; // safety cap
let lastTradeTickIndex = -1;
let pingInterval = null;

let digitStatsDisplay; // For the 2x5 grid


document.addEventListener("DOMContentLoaded", () => {
  // Inject Refined Even/Odd UI
  document.body.insertAdjacentHTML("beforeend", `
    <div id="even-odd-panel" style="display: none;">
      <div class="smart-card">
        <div class="smart-header">
          <h2 class="smart-title">Even / Odd Switch</h2>
          <p class="smart-sub">Digit Reversal Strategy</p>
        </div>

        <div class="smart-form">
          <div class="analysis-section" style="margin-bottom: 20px;">
            <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
              Digit Analysis (Last 100 ticks)
            </div>
            
            <!-- Digit Statistics Grid (Symmetrical 2x5) -->
            <div id="eo-digit-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; min-height: 100px;">
              <!-- Digits 0-9 indicators -->
            </div>

            <div class="tick-header" style="margin-bottom: 8px; font-size: 0.9rem; color: #666;">Live Tick Stream</div>
            <div class="tick-grid" id="tick-grid-eo" style="display: flex; gap: 4px; overflow-x: hidden; height: 35px; align-items: center; background: #f9f9f9; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
              <!-- Ticks flow here -->
            </div>
          </div>

          <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="field">
              <label for="tick-count-eo">Number of Trades</label>
              <input type="number" id="tick-count-eo" min="1" value="5">
            </div>
            <div class="field">
              <label for="stake-eo">Stake (Min 0.35)</label>
              <input type="number" id="stake-eo" min="0.35" step="0.01" value="0.35">
            </div>
          </div>

          <div class="action-area" style="text-align: center;">
            <button id="run-even-odd" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN</button>
            <div id="even-odd-results" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Ready</div>
          </div>
        </div>
      </div>
    </div>
  `);

  // Get elements
  tickCountInput = document.getElementById("tick-count-eo");
  stakeInput = document.getElementById("stake-eo");
  tickGrid = document.getElementById("tick-grid-eo");
  digitStatsDisplay = document.getElementById("eo-digit-stats");
  resultsDisplay = document.getElementById("even-odd-results");

  // Event listeners
  document.getElementById("run-even-odd").onclick = runEvenOdd;

  // Add market and submarket change listeners
  const marketSelect = document.getElementById("market");
  const submarketSelect = document.getElementById("submarket");

  if (marketSelect) {
    marketSelect.addEventListener("change", () => {
      console.log("Market changed, restarting stream...");
      restartTickStream();
    });
  }

  if (submarketSelect) {
    submarketSelect.addEventListener("change", () => {
      console.log("Submarket changed, restarting stream...");
      restartTickStream();
    });
  }

  // Initialize UI
  updateUI();
  startTickStream();
});

function updateUI() {
  if (!digitStatsDisplay || !tickGrid) return;

  const dataSize = tickHistory.length;
  const historyLimit = 100;

  // 1. Update Digit Stats Grid (Symmetrical 2x5)
  digitStatsDisplay.innerHTML = "";
  const scores = Array(10).fill(0);
  tickHistory.forEach((digit, index) => {
    // Weighted heat: newer ticks matter more
    const weight = 0.5 + (index / Math.max(1, dataSize));
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
    // Visually highlight even/odd types for quicker scanning
    const isEven = s.digit % 2 === 0;

    card.style.cssText = `
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 8px 4px;
      text-align: center;
      background: #fff;
      border-bottom: 3px solid ${s.isRecent ? '#2196f3' : isEven ? '#e1f5fe' : '#fff3e0'};
      transition: all 0.3s ease;
    `;

    card.innerHTML = `
      <div style="font-weight:bold; font-size:1.1rem; color:#333;">${s.digit}</div>
      <div style="font-size:0.75rem; color:#666;">${s.heat.toFixed(1)}%</div>
    `;
    digitStatsDisplay.appendChild(card);
  });

  // 2. Update Tick Stream (Horizontal)
  tickGrid.innerHTML = "";
  const displayTicks = tickHistory.slice(-25);
  displayTicks.forEach((t, i) => {
    const div = document.createElement("div");
    div.className = "tick-item";
    const isLast = i === displayTicks.length - 1;
    const isEven = t % 2 === 0;

    div.style.cssText = `
      min-width: 25px;
      height: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      border-radius: 4px;
      background: ${isLast ? '#2196f3' : isEven ? '#e3f2fd' : '#fff3e0'};
      color: ${isLast ? '#fff' : '#333'};
      border: 1px solid ${isLast ? '#2196f3' : '#ddd'};
      font-weight: ${isLast ? 'bold' : 'normal'};
      flex-shrink: 0;
    `;
    div.textContent = t;
    tickGrid.appendChild(div);
  });

  // Auto-scroll to end
  tickGrid.scrollLeft = tickGrid.scrollWidth;
}

function startTickStream() {
  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;

  // Wait for both market and submarket to be selected
  if (!market) {
    console.log("Waiting for market selection...");
    setTimeout(startTickStream, 1000);
    return;
  }

  if (!submarket) {
    console.log("Waiting for submarket selection...");
    setTimeout(startTickStream, 1000);
    return;
  }

  const symbol = submarket;

  // Only create new WebSocket if one doesn't exist or is closed
  if (!tickWs || tickWs.readyState === WebSocket.CLOSED) {
    try {
      tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
      console.log("Creating new WebSocket for symbol:", symbol);
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setTimeout(startTickStream, 3000);
      return;
    }
  }

  tickWs.onopen = () => {
    console.log("WebSocket connected for symbol:", symbol);
    try {
      tickWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      startPing(tickWs);
    } catch (e) {
      console.error("Failed to send subscription:", e);
    }
  };

  tickWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.tick) {
        const quote = msg.tick.quote;
        const digit = Number(String(quote).slice(-1));
        tickHistory.push(digit);

        // Keep only last 100 in memory to prevent memory issues
        if (tickHistory.length > 100) {
          tickHistory = tickHistory.slice(-100);
        }

        updateUI();

        // Check for pattern if we're actively looking for entry
        if (checkingForEntry && tickHistory.length >= 4) {
          checkForPatternAndTrade();
        }
      }
    } catch (error) {
      console.error("Error processing tick message:", error);
    }
  };

  tickWs.onerror = (error) => {
    console.error("WebSocket error:", error);
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = null;
    // Clear connection and retry after 3 seconds
    tickWs = null;
    setTimeout(() => {
      startTickStream();
    }, 3000);
  };

  tickWs.onclose = () => {
    console.log("WebSocket closed, attempting to reconnect...");
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = null;
    // Clear connection and retry after 3 seconds
    tickWs = null;
    setTimeout(() => {
      startTickStream();
    }, 3000);
  };
}

function startPing(ws) {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ ping: 1 }));
      } catch (e) {
        console.warn("[EvenOdd] Ping failed", e);
      }
    }
  }, 20000);
}

async function runEvenOdd() {
  if (running) {
    stopEvenOdd();
    return;
  }

  const token = getAuthToken();
  if (!token) {
    alert("Please login first");
    return;
  }

  completedTrades = 0;
  running = true;
  checkingForEntry = true;

  resultsDisplay.dataset.success = "0";
  resultsDisplay.dataset.failed = "0";
  lastTradeTickIndex = -1;

  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Monitoring Even / Odd ticks...";

  if (tickHistory.length >= 4) {
    checkForPatternAndTrade();
  }
}

async function checkForPatternAndTrade() {
  if (!running || !checkingForEntry) return;

  const numTrades = parseInt(tickCountInput.value) || 5;
  if (completedTrades >= numTrades) return finishSession();

  // Ensure "once for every check" (at least 4 new ticks since last trade)
  if (lastTradeTickIndex !== -1 && tickHistory.length < lastTradeTickIndex + 4) return;

  const last4 = tickHistory.slice(-4);
  if (last4.length < 4) return;

  const allEven = last4.every(d => d % 2 === 0);
  const allOdd = last4.every(d => d % 2 !== 0);
  if (!allEven && !allOdd) return;

  checkingForEntry = false;
  lastTradeTickIndex = tickHistory.length;
  const tradeType = allEven ? "DIGITODD" : "DIGITEVEN";
  const pattern = allEven ? "Even" : "Odd";
  const stake = Number(stakeInput.value);
  const symbol = document.getElementById("submarket")?.value || "R_100";

  resultsDisplay.innerHTML = `Pattern detected: <b>${pattern}</b><br>Executing trade...`;

  try {
    const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
    const payout = Number(result?.buy?.payout || 0);
    const win = payout > stake;

    completedTrades++;
    resultsDisplay.dataset.success = String(Number(resultsDisplay.dataset.success) + (win ? 1 : 0));
    resultsDisplay.dataset.failed = String(Number(resultsDisplay.dataset.failed) + (win ? 0 : 1));

    if (completedTrades < numTrades && completedTrades < maxTradesPerSession) {
      checkingForEntry = true;
      resultsDisplay.innerHTML = `
        <strong>Trading Active</strong><br>
        Pattern: ${pattern}<br>
        Completed: ${completedTrades}/${numTrades}<br>
        Success: ${resultsDisplay.dataset.success}, Failed: ${resultsDisplay.dataset.failed}
      `;
    } else {
      finishSession();
    }
  } catch (err) {
    console.error("Trade failed:", err);
    completedTrades++;
    checkingForEntry = true; // Attempt to recover
  }
}

function finishSession() {
  running = false;
  checkingForEntry = false;
  document.getElementById("run-even-odd").textContent = "RUN";
  resultsDisplay.innerHTML = `<strong>Session Complete</strong><br>Trades: ${completedTrades}<br>Wins: ${resultsDisplay.dataset.success}, Losses: ${resultsDisplay.dataset.failed}`;
}

function stopEvenOdd() {
  running = false;
  checkingForEntry = false;
  document.getElementById("run-even-odd").textContent = "RUN";
  resultsDisplay.innerHTML = "Stopped.";
}

function restartTickStream() {
  // Clear existing connection
  if (tickWs) {
    try {
      tickWs.close();
    } catch (e) {
      console.error("Error closing WebSocket:", e);
    }
    tickWs = null;
  }

  // Reset tick history when symbol changes
  tickHistory = [];
  updateUI();

  // Wait a moment before starting new stream
  setTimeout(() => {
    if (!tickWs) {
      startTickStream();
    }
  }, 1000);
}

function popup(msg, details = null, timeout = 2000) {
  try {
    const overlay = document.createElement('div');
    overlay.className = 'trade-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'trade-popup';

    const title = document.createElement('h3');
    title.textContent = msg;
    popup.appendChild(title);

    if (details) {
      const p = document.createElement('p');
      p.innerHTML = details;
      popup.appendChild(p);
    }

    const closeBtn = document.createElement('a');
    closeBtn.className = 'close-btn';
    closeBtn.href = '#';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { overlay.remove(); } catch (e) { } });
    popup.appendChild(closeBtn);

    overlay.appendChild(popup);
    try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show popup:', e); }

    if (timeout > 0) setTimeout(() => { try { overlay.remove(); } catch (e) { } }, timeout);
  } catch (e) {
    console.warn('Popup render failed:', e);
  }
}