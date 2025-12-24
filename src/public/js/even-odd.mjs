import { buyContract } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';

let running = false;
let tickWs = null;
let tickHistory = [];
let tickCountInput, stakeInput, tickGrid, totalTicksDisplay, resultsDisplay;

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
          <div class="field">
            <label for="tick-count-eo">Number of ticks</label>
            <input type="number" id="tick-count-eo" min="1" max="50" value="50">
          </div>

          <div class="tick-display">
            <div class="tick-header">Last 50 Ticks</div>
            <div class="tick-grid" id="tick-grid-eo">
              <!-- Ticks will be populated here -->
            </div>
            <div class="tick-count-display">
              Total Ticks: <span id="total-ticks-eo">0</span>
            </div>
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

  // Initialize tick display
  updateTickDisplay();
});

function updateTickDisplay() {
  tickGrid.innerHTML = '';
  
  // Display last 50 ticks (or fewer if we don't have that many yet)
  const displayTicks = tickHistory.slice(-50);
  
  displayTicks.forEach((tick, index) => {
    const tickEl = document.createElement('div');
    tickEl.className = 'tick-item';
    tickEl.textContent = tick;
    
    // Color based on even/odd
    if (tick % 2 === 0) {
      tickEl.classList.add('even');
    } else {
      tickEl.classList.add('odd');
    }
    
    tickGrid.appendChild(tickEl);
  });
  
  totalTicksDisplay.textContent = tickHistory.length;
}

async function runEvenOdd() {
  if (running) {
    stopEvenOdd();
    return;
  }

  const symbol = document.getElementById("submarket")?.value || "R_100";
  const numTrades = parseInt(tickCountInput.value) || 50;
  const stake = stakeInput.value;

  if (tickHistory.length < 5) {
    resultsDisplay.innerHTML = "Collecting ticks... Need at least 5 ticks to analyze";
    await collectTicks(symbol, 50);
  }

  running = true;
  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Analyzing last 5 ticks...";

  // Check last 5 ticks for consecutive even or odd
  const last5Ticks = tickHistory.slice(-5);
  const allEven = last5Ticks.every(tick => tick % 2 === 0);
  const allOdd = last5Ticks.every(tick => tick % 2 !== 0);

  if (!allEven && !allOdd) {
    resultsDisplay.innerHTML = "No consecutive pattern found in last 5 ticks";
    running = false;
    document.getElementById("run-even-odd").textContent = "RUN";
    return;
  }

  const tradeType = allEven ? "DIGITODD" : "DIGITEVEN";
  const pattern = allEven ? "Even" : "Odd";
  
  resultsDisplay.innerHTML = `Found 5 consecutive ${pattern} ticks<br>Placing ${numTrades} ${tradeType} trades...`;

  // Place trades
  const trades = [];
  for (let i = 0; i < numTrades; i++) {
    try {
      const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
      trades.push(result);
      
      // Update results display
      const success = trades.filter(t => !t.error).length;
      const failed = trades.filter(t => t.error).length;
      resultsDisplay.innerHTML = `Placing ${tradeType} trades...<br>Completed: ${success + failed}/${numTrades}<br>Success: ${success}, Failed: ${failed}`;
      
      // Small delay between trades
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Trade failed:', error);
      trades.push({ error: error.message });
    }
  }

  // Final results
  const success = trades.filter(t => !t.error).length;
  const failed = trades.filter(t => t.error).length;
  
  resultsDisplay.innerHTML = `
    <strong>Execution Complete</strong><br>
    Pattern: ${pattern} (5 consecutive)<br>
    Trades: ${tradeType}<br>
    Total: ${numTrades}<br>
    Success: ${success}, Failed: ${failed}
  `;

  popup(`Even/Odd Complete`, `Placed ${numTrades} ${tradeType} trades<br>Success: ${success}, Failed: ${failed}`, 5000);

  running = false;
  document.getElementById("run-even-odd").textContent = "RUN";
}

function stopEvenOdd() {
  running = false;
  if (tickWs) {
    try { tickWs.close(); } catch (e) {}
    tickWs = null;
  }
  document.getElementById("run-even-odd").textContent = "RUN";
  popup("Even/Odd Stopped");
}

async function collectTicks(symbol, count = 50) {
  return new Promise((resolve) => {
    let collected = 0;
    
    try {
      tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
    } catch (err) {
      resolve();
      return;
    }

    tickWs.onopen = () => {
      try { tickWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 })); } catch (e) {}
    };

    tickWs.onmessage = (e) => {
      if (!running && collected >= count) {
        try { tickWs.close(); } catch (e) {}
        resolve();
        return;
      }

      const msg = JSON.parse(e.data);
      if (msg.tick) {
        const quote = msg.tick.quote;
        const digit = Number(String(quote).slice(-1));
        tickHistory.push(digit);
        collected++;
        updateTickDisplay();

        if (collected >= count) {
          try { tickWs.close(); } catch (e) {}
          resolve();
        }
      }
    };

    tickWs.onerror = () => {
      try { tickWs.close(); } catch (e) {}
      resolve();
    };
  });
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
    closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { overlay.remove(); } catch (e) {} });
    popup.appendChild(closeBtn);

    overlay.appendChild(popup);
    try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show popup:', e); }

    if (timeout > 0) setTimeout(() => { try { overlay.remove(); } catch (e) {} }, timeout);
  } catch (e) {
    console.warn('Popup render failed:', e);
  }
}