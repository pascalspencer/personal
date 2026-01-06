import { buyContract } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';

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

  completedTrades = 0;
  running = true;
  checkingForEntry = true;

  resultsDisplay.dataset.success = "0";
  resultsDisplay.dataset.failed = "0";

  document.getElementById("run-even-odd").textContent = "STOP";
  resultsDisplay.innerHTML = "Monitoring Even / Odd ticks...";

  popup("Checking Stream", "Waiting for entry pattern", 1500);

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
  const allOdd  = last3.every(d => d % 2 !== 0);
  if (!allEven && !allOdd) return;

  checkingForEntry = false;

  const tradeType = allEven ? "DIGITEVEN" : "DIGITODD";
  const pattern   = allEven ? "Even" : "Odd";
  const stake     = Number(stakeInput.value);
  const symbol    = document.getElementById("submarket")?.value || "R_100";
  const lastDigit = last3[2];

  resultsDisplay.innerHTML = `Pattern detected: <b>${pattern}</b><br>Executing trade...`;

  try {
    const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
    const payout = Number(result?.buy?.payout || 0);
    const win    = payout > stake;

    completedTrades++;

    resultsDisplay.dataset.success = String(
      Number(resultsDisplay.dataset.success) + (win ? 1 : 0)
    );
    resultsDisplay.dataset.failed = String(
      Number(resultsDisplay.dataset.failed) + (win ? 0 : 1)
    );

    popup(
      "Trade Executed",
      `Type: ${tradeType}<br>Stake: $${stake.toFixed(2)}<br>Last Digit: ${lastDigit}`,
      1500
    );

    resultsDisplay.innerHTML = `
      <strong>Trading Active</strong><br>
      Pattern: ${pattern}<br>
      Completed: ${completedTrades}/${numTrades}<br>
      Wins: ${resultsDisplay.dataset.success}, Losses: ${resultsDisplay.dataset.failed}
    `;

  } catch (err) {
    completedTrades++;
    popup("Trade Error", err.message, 3000);
  }

  if (completedTrades < numTrades && completedTrades < maxTradesPerSession) {
    setTimeout(() => {
      checkingForEntry = true;
    }, 300);
  } else {
    finishSession();
  }
}

function finishSession() {
  running = false;
  checkingForEntry = false;
  document.getElementById("run-even-odd").textContent = "RUN";

  popup(
    "Even / Odd Complete",
    `Trades: ${completedTrades}<br>
     Wins: ${resultsDisplay.dataset.success}<br>
     Losses: ${resultsDisplay.dataset.failed}`,
    4000
  );
}

  // Check last 3 ticks for consecutive even or odd
  const last3Ticks = tickHistory.slice(-3);
  const allEven = last3Ticks.every(tick => tick % 2 === 0);
  const tradeType = allEven ? "DIGITODD" : "DIGITEVEN";
  const pattern = allEven ? "Odd" : "Even";
  
  // Close checking popup
  const checkingPopup = document.querySelector('.trade-popup-overlay');
  if (checkingPopup) {
    checkingPopup.remove();
  }
  
  // Initialize results tracking
  if (!resultsDisplay.dataset.success) resultsDisplay.dataset.success = "0";
  if (!resultsDisplay.dataset.failed) resultsDisplay.dataset.failed = "0";
  
  resultsDisplay.innerHTML = `Found entry for ${pattern} ticks<br>Placing ${tradeType} trades...`;

  // Place single trade and check pattern again before next trade
  try {
    const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
    
    // Get the last digit for popup display
    const lastDigit = last3Ticks[last3Ticks.length - 1];
    const digitType = lastDigit % 2 === 0 ? "Even" : "Odd";
    
    // Show trade confirmation popup with stake and digit type
    let tradeResult = 'Failed';
    if (!result.error) {
      const buyInfo = result.buy || result;
      const payout = Number(buyInfo?.payout ?? buyInfo?.payout_amount ?? 0) || 0;
      const stakeAmt = Number(stake) || 0;
      
      if (payout > stakeAmt) {
        tradeResult = 'Won';
      } else {
        tradeResult = 'Lost';
      }
    }
    
    popup(`Trade Executed`, `Type: ${tradeType}<br>Stake: $${Number(stake).toFixed(2)}<br>Last Digit: ${lastDigit} (${digitType})<br>Result: ${tradeResult}`, 2000);
    
    // Update results
    const currentSuccess = parseInt(resultsDisplay.dataset.success) || 0;
    const currentFailed = parseInt(resultsDisplay.dataset.failed) || 0;
    const newSuccess = !result.error ? currentSuccess + 1 : currentSuccess;
    const newFailed = result.error ? currentFailed + 1 : currentFailed;
    
    resultsDisplay.dataset.success = newSuccess;
    resultsDisplay.dataset.failed = newFailed;
    
    resultsDisplay.innerHTML = `
      <strong>Trading Active</strong><br>
      Pattern: ${pattern} (3 consecutive)<br>
      Trades: ${tradeType}<br>
      Completed: ${newSuccess + newFailed}/${numTrades}<br>
      Success: ${newSuccess}, Failed: ${newFailed}
    `;
    
    // Check if we need more trades
    if (newSuccess + newFailed < numTrades) {
      // Reduced delay for faster execution
      setTimeout(() => {
        if (checkingForEntry) {
          checkForPatternAndTrade();
        }
      }, 500);
    } else {
      // All trades completed
      checkingForEntry = false;
      running = false;
      document.getElementById("run-even-odd").textContent = "RUN";
      
      popup(`Even/Odd Complete`, `Completed ${numTrades} trades<br>Success: ${newSuccess}, Failed: ${newFailed}`, 5000);
    }
    
  } catch (error) {
    console.error('Trade failed:', error);
    
    const lastDigit = last3Ticks[last3Ticks.length - 1];
    const digitType = lastDigit % 2 === 0 ? "Even" : "Odd";
    
    popup(`Trade Failed`, `Type: ${tradeType}<br>Stake: $${Number(stake).toFixed(2)}<br>Last Digit: ${lastDigit} (${digitType})<br>Error: ${error.message}`, 3000);
    
    // Continue with next trade if needed
    const currentFailed = parseInt(resultsDisplay.dataset.failed) || 0;
    const currentSuccess = parseInt(resultsDisplay.dataset.success) || 0;
    const totalTrades = currentSuccess + currentFailed + 1;
    
    if (totalTrades < numTrades) {
      // Reduced delay for faster execution
      setTimeout(() => {
        if (checkingForEntry) {
          checkForPatternAndTrade();
        }
      }, 500);
    } else {
      checkingForEntry = false;
      running = false;
      document.getElementById("run-even-odd").textContent = "RUN";
    }
}

function stopEvenOdd() {
  running = false;
  checkingForEntry = false;

  document.querySelector('.trade-popup-overlay')?.remove();
  document.getElementById("run-even-odd").textContent = "RUN";

  popup("Even / Odd Stopped");
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
    closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { overlay.remove(); } catch (e) {} });
    popup.appendChild(closeBtn);

    overlay.appendChild(popup);
    try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show popup:', e); }

    if (timeout > 0) setTimeout(() => { try { overlay.remove(); } catch (e) {} }, timeout);
  } catch (e) {
    console.warn('Popup render failed:', e);
  }
}