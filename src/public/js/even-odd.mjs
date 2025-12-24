import { buyContract } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';

let running = false;
let checkingForEntry = false;
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
  
  try {
    tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
  } catch (err) {
    console.error("Failed to create WebSocket:", err);
    setTimeout(startTickStream, 3000); // Retry after 3 seconds
    return;
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
        if (checkingForEntry && tickHistory.length >= 5) {
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

  const symbol = document.getElementById("submarket")?.value || "R_100";
  const numTrades = parseInt(tickCountInput.value) || 5;
  const stake = stakeInput.value;

  running = true;
  checkingForEntry = true;
  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Monitoring for entry pattern...";
  
  // Show checking popup
  const checkingPopup = popup("Checking Stream for entry", "Looking for 5 consecutive even or odd ticks", 0);

  // Check immediately if we already have a pattern
  if (tickHistory.length >= 5) {
    checkForPatternAndTrade();
  }
}

async function checkForPatternAndTrade() {
  const symbol = document.getElementById("submarket")?.value || "R_100";
  const numTrades = parseInt(tickCountInput.value) || 5;
  const stake = stakeInput.value;

  // Check last 5 ticks for consecutive even or odd
  const last5Ticks = tickHistory.slice(-5);
  const allEven = last5Ticks.every(tick => tick % 2 === 0);
  const allOdd = last5Ticks.every(tick => tick % 2 !== 0);

  if (!allEven && !allOdd) {
    // No pattern found, continue monitoring
    return;
  }

  // Pattern found - stop checking and place trades
  checkingForEntry = false;
  
  // Close checking popup
  const checkingPopup = document.querySelector('.trade-popup-overlay');
  if (checkingPopup) {
    checkingPopup.remove();
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
      
      // Show trade confirmation popup like smart over/under
      const tradeNumber = i + 1;
      let tradeResult = 'Failed';
      if (!result.error) {
        // Try to extract profit info
        const buyInfo = result.buy || result;
        const stakeAmt = Number(stake) || 0;
        const payout = Number(buyInfo?.payout ?? buyInfo?.payout_amount ?? 0) || 0;
        
        if (payout > stakeAmt) {
          tradeResult = `Profit: $${(payout - stakeAmt).toFixed(2)}`;
        } else if (payout > 0) {
          tradeResult = `Loss: $${(stakeAmt - payout).toFixed(2)}`;
        } else {
          tradeResult = 'Lost';
        }
      }
      
      popup(`Trade ${tradeNumber}/${numTrades}`, `Type: ${tradeType}<br>Stake: $${Number(stake).toFixed(2)}<br>${tradeResult}`, 3000);
      
      // Small delay between trades to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Trade failed:', error);
      trades.push({ error: error.message });
      
      // Show error popup
      popup(`Trade ${i + 1}/${numTrades}`, `Type: ${tradeType}<br>Stake: $${Number(stake).toFixed(2)}<br>Error: ${error.message}`, 3000);
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
  checkingForEntry = false;
  
  // Close any checking popup
  const checkingPopup = document.querySelector('.trade-popup-overlay');
  if (checkingPopup) {
    checkingPopup.remove();
  }
  
  // Don't close WebSocket here as we want to keep streaming ticks
  document.getElementById("run-even-odd").textContent = "RUN";
  popup("Even/Odd Stopped");
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
  
  // Start new stream with updated symbol
  setTimeout(startTickStream, 1000);
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