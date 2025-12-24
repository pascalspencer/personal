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

  // Initialize tick display and start streaming
  updateTickDisplay();
  startTickStream();
});

function updateTickDisplay() {
  tickGrid.innerHTML = '';
  
  // Get last 50 ticks and reverse them so newest is at bottom-right
  const displayTicks = tickHistory.slice(-50);
  
  // Create a 10x5 grid (50 cells total)
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const tickIndex = row * 5 + col;
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
        if (tickIndex === displayTicks.length - 1 && tickHistory.length > 50) {
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
  const symbol = document.getElementById("submarket")?.value || "R_100";
  
  try {
    tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
  } catch (err) {
    console.error("Failed to create WebSocket:", err);
    return;
  }

  tickWs.onopen = () => {
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
      }
    } catch (error) {
      console.error("Error processing tick message:", error);
    }
  };

  tickWs.onerror = (error) => {
    console.error("WebSocket error:", error);
    // Try to reconnect after 3 seconds
    setTimeout(() => {
      if (!tickWs || tickWs.readyState === WebSocket.CLOSED) {
        startTickStream();
      }
    }, 3000);
  };

  tickWs.onclose = () => {
    console.log("WebSocket closed, attempting to reconnect...");
    // Try to reconnect after 3 seconds
    setTimeout(() => {
      if (!tickWs || tickWs.readyState === WebSocket.CLOSED) {
        startTickStream();
      }
    }, 3000);
  };
}

async function runEvenOdd() {
  if (running) {
    stopEvenOdd();
    return;
  }

  const symbol = document.getElementById("submarket")?.value || "R_100";
  const numTrades = parseInt(tickCountInput.value) || 5;
  const stake = stakeInput.value;

  // Check if we have enough ticks to analyze
  if (tickHistory.length < 5) {
    resultsDisplay.innerHTML = "Collecting ticks... Need at least 5 ticks to analyze";
    return;
  }

  running = true;
  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Analyzing last 5 ticks for pattern...";

  // Check last 5 ticks for consecutive even or odd
  const last5Ticks = tickHistory.slice(-5);
  const allEven = last5Ticks.every(tick => tick % 2 === 0);
  const allOdd = last5Ticks.every(tick => tick % 2 !== 0);

  if (!allEven && !allOdd) {
    resultsDisplay.innerHTML = "No consecutive pattern found in last 5 ticks<br>Waiting for pattern...";
    running = false;
    document.getElementById("run-even-odd").textContent = "RUN";
    return;
  }

  const tradeType = allEven ? "DIGITODD" : "DIGITEVEN";
  const pattern = allEven ? "Even" : "Odd";
  
  resultsDisplay.innerHTML = `Found 5 consecutive ${pattern} ticks<br>Placing ${numTrades} ${tradeType} trades...`;

  // Place trades - similar to smart over/under logic
  const trades = [];
  for (let i = 0; i < numTrades; i++) {
    try {
      const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
      trades.push(result);
      
      // Update results display
      const success = trades.filter(t => !t.error).length;
      const failed = trades.filter(t => t.error).length;
      resultsDisplay.innerHTML = `Placing ${tradeType} trades...<br>Completed: ${success + failed}/${numTrades}<br>Success: ${success}, Failed: ${failed}`;
      
      // Small delay between trades to avoid rate limiting
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
  // Don't close the WebSocket here as we want to keep streaming ticks
  document.getElementById("run-even-odd").textContent = "RUN";
  popup("Even/Odd Stopped");
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