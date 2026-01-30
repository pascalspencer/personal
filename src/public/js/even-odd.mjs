import { buyContract, getAuthToken } from "./buyContract.mjs";
import { showLivePopup } from './livePopup.mjs';

let running = false;
let checkingForEntry = false;
let tickWs = null;
let tickHistory = [];
let tickCountInput, stakeInput, tickGrid, totalTicksDisplay, resultsDisplay;
let completedTrades = 0;
let maxTradesPerSession = 100; // safety cap


document.addEventListener("DOMContentLoaded", () => {
  // Create Even/Odd Panel
  document.body.insertAdjacentHTML("beforeend", `
    <div id="even-odd-panel" style="display: none;">
      <div class="smart-card">
        <div class="smart-header">
          <h2 class="smart-title">Even / Odd Switch</h2>
          <p class="smart-sub">Pattern-based digit trading</p>
        </div>

        <div class="smart-form">
          <div class="tick-display">
            <div class="tick-header">Live Tick Stream (Last 50)</div>
            <div class="tick-grid" id="tick-grid-eo">
              <!-- Ticks will be populated here -->
            </div>
            <div class="tick-count-display">
              Total Ticks: <span id="total-ticks-eo">0</span>
            </div>
          </div>

          <div class="field">
            <label for="tick-count-eo">Number of trades</label>
            <input type="number" id="tick-count-eo" min="1" value="5">
          </div>

          <div class="stake-row">
            <button id="run-even-odd" class="run-btn">RUN</button>
            <div class="field stake-field">
              <label for="stake-eo">(Minimum 0.35)</label>
              <input type="number" id="stake-eo" min="0.35" step="0.01" value="0.35">
            </div>
          </div>

          <div id="even-odd-results" class="smart-results"></div>
        </div>
      </div>
    </div>
  `);

  // Get elements
  tickCountInput = document.getElementById("tick-count-eo");
  stakeInput = document.getElementById("stake-eo");
  tickGrid = document.getElementById("tick-grid-eo");
  totalTicksDisplay = document.getElementById("total-ticks-eo");
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

  // Initialize tick display and start streaming
  updateTickDisplay();
  startTickStream();
});

function updateTickDisplay() {
  tickGrid.innerHTML = '';

  // Get last 50 ticks
  const displayTicks = tickHistory.slice(-50);

  // Create a 5x10 grid (50 cells total) - 5 rows, 10 columns
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const tickIndex = row * 10 + col;
      const tickEl = document.createElement('div');
      tickEl.className = 'tick-item';

      if (tickIndex < displayTicks.length) {
        const tick = displayTicks[tickIndex];
        tickEl.textContent = tick;

        // Color based on even/odd
        if (tick % 2 === 0) {
          tickEl.classList.add('even');
        } else {
          tickEl.classList.add('odd');
        }

        // Add animation for newest tick (last position in grid)
        if (tickIndex === displayTicks.length - 1) {
          tickEl.classList.add('new-tick');
        }
      } else {
        // Empty cell - show as placeholder
        tickEl.classList.add('empty');
      }

      tickGrid.appendChild(tickEl);
    }
  }

  totalTicksDisplay.textContent = tickHistory.length;
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

        updateTickDisplay();

        // Check for pattern if we're actively looking for entry
        if (checkingForEntry && tickHistory.length >= 3) {
          checkForPatternAndTrade();
        }
      }
    } catch (error) {
      console.error("Error processing tick message:", error);
    }
  };

  tickWs.onerror = (error) => {
    console.error("WebSocket error:", error);
    // Clear connection and retry after 3 seconds
    tickWs = null;
    setTimeout(() => {
      startTickStream();
    }, 3000);
  };

  tickWs.onclose = () => {
    console.log("WebSocket closed, attempting to reconnect...");
    // Clear connection and retry after 3 seconds
    tickWs = null;
    setTimeout(() => {
      startTickStream();
    }, 3000);
  };
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

  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Monitoring Even / Odd ticks...";

  if (tickHistory.length >= 3) {
    checkForPatternAndTrade();
  }
}

async function checkForPatternAndTrade() {
  if (!running || !checkingForEntry) return;

  const numTrades = parseInt(tickCountInput.value) || 5;
  if (completedTrades >= numTrades) return finishSession();

  const last3 = tickHistory.slice(-3);
  if (last3.length < 3) return;

  const allEven = last3.every(d => d % 2 === 0);
  const allOdd = last3.every(d => d % 2 !== 0);
  if (!allEven && !allOdd) return;

  checkingForEntry = false;
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
  updateTickDisplay();

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