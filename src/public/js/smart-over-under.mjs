import { buyContract, buyContractBulk } from "./buyContract.mjs";
import { getCurrentToken } from './popupMessages.mjs';
import { showLivePopup } from './livePopup.mjs';

let running = false;
let ticksSeen = 0;
let tradeLock = false;
let tickWs = null;

let overDigit, underDigit, tickCount, stakeInput;
let singleToggle, bulkToggle, resultsBox;



document.addEventListener("DOMContentLoaded", () => {
  // UI Injection
  document.body.insertAdjacentHTML("beforeend", `
  <div id="smart-over-under" style="display:none">
    <div class="smart-card">
      <div class="smart-header">
        <h2 class="smart-title">Smart Over / Under</h2>
        <p class="smart-sub">Automated digit strategy</p>
      </div>

      <div class="smart-form">
        <div class="row two-cols">
          <div class="field">
            <label for="over-digit">Over</label>
            <select id="over-digit"></select>
          </div>

          <div class="field">
            <label for="under-digit">Under</label>
            <select id="under-digit"></select>
          </div>
        </div>

        <div class="field">
          <label for="tick-count">Number of ticks</label>
          <input type="number" id="tick-count" min="1" value="5">
        </div>

        <div class="toggle-container">
          <label class="small-toggle">
            <span>Single</span>
            <input type="checkbox" id="single-toggle" checked>
          </label>
          <label class="small-toggle">
            <span>Bulk</span>
            <input type="checkbox" id="bulk-toggle">
          </label>
        </div>

        <div class="stake-row">
          <div class="field stake-field">
            <label for="stake">(Minimum 0.35)</label>
            <input type="number" id="stake" min="0.35" step="0.01" value="0.35">
          </div>

          <div class="smart-buttons">
            <button id="run-smart">RUN</button>
            <button id="stop-smart">STOP</button>
          </div>
        </div>

<div id="smart-results" class="smart-results"></div>
      </div>
    </div>
  </div>
`);


  overDigit = document.getElementById("over-digit");
  underDigit = document.getElementById("under-digit");
  tickCount = document.getElementById("tick-count");
  stakeInput = document.getElementById("stake");
  singleToggle = document.getElementById("single-toggle");
  bulkToggle = document.getElementById("bulk-toggle");
  resultsBox = document.getElementById("smart-results");



  for (let i = 0; i <= 9; i++) {
    overDigit.innerHTML += `<option value="${i}">${i}</option>`;
    underDigit.innerHTML += `<option value="${i}">${i}</option>`;
  }
  // Make single and bulk toggles mutually exclusive: when one is checked,
  // disable the other; when unchecked, re-enable the counterpart.
  function updateToggles() {
    if (singleToggle.checked) {
      bulkToggle.checked = false;
      bulkToggle.disabled = true;
    } else {
      bulkToggle.disabled = false;
    }

    if (bulkToggle.checked) {
      singleToggle.checked = false;
      singleToggle.disabled = true;
    } else {
      singleToggle.disabled = false;
    }
  }

  singleToggle.addEventListener('change', updateToggles);
  bulkToggle.addEventListener('change', updateToggles);
  // ensure initial state
  updateToggles();

  // Preserve references to original market/submarket parents so we can
  // restore them when switching back to Auto Analysis.
  const marketEl = document.getElementById("market");
  const submarketEl = document.getElementById("submarket");
  const originalPos = {
    market: marketEl ? { parent: marketEl.parentNode, next: marketEl.nextSibling } : null,
    submarket: submarketEl ? { parent: submarketEl.parentNode, next: submarketEl.nextSibling } : null,
  };

  const smartContainer = document.getElementById("smart-over-under");
  let smartHeadingEl = null;

  // When smart UI is shown, keep only market and submarket from the
  // original interface and rely on CSS (trade.css) for hiding/spacing.
  function showSmartMode() {
    document.body.classList.add('smart-mode');

    // ensure market comes before submarket inside smart container; avoid
    // repeated moves by checking current parent
    if (marketEl && marketEl.parentNode !== smartContainer) {
      smartContainer.insertBefore(marketEl, smartContainer.firstChild);
    }
    if (submarketEl && submarketEl.parentNode !== smartContainer) {
      smartContainer.insertBefore(submarketEl, marketEl && marketEl.parentNode === smartContainer ? marketEl.nextSibling : smartContainer.firstChild);
    }

    // ensure Zodiac heading is present in smart UI (copy original if available)
    if (!smartHeadingEl) {
      const originalHeading = document.getElementById('form-heading');
      smartHeadingEl = document.createElement('h1');
      smartHeadingEl.textContent = (originalHeading && originalHeading.textContent.trim()) || 'Zodiac Algo-trade';
      smartHeadingEl.style.margin = '0 0 8px 0';
    }
    if (smartHeadingEl.parentNode !== smartContainer) smartContainer.insertBefore(smartHeadingEl, smartContainer.firstChild);

    smartContainer.classList.add('visible');
  }

  function hideSmartMode() {
    document.body.classList.remove('smart-mode');

    // move market/submarket back to original positions
    if (originalPos.market && marketEl) {
      originalPos.market.parent.insertBefore(marketEl, originalPos.market.next);
    }
    if (originalPos.submarket && submarketEl) {
      originalPos.submarket.parent.insertBefore(submarketEl, originalPos.submarket.next);
    }

    // remove smart heading from panel
    if (smartHeadingEl && smartHeadingEl.parentNode === smartContainer) smartHeadingEl.remove();

    smartContainer.classList.remove('visible');
  }

  // Lightweight visibility polling to react when `smart-ui.mjs` shows/hides
  // the smart panel. Polling avoids heavy MutationObserver activity that
  // was causing repeated DOM reflows and freezes.
  let lastVisible = window.getComputedStyle(smartContainer).display !== 'none';
  const visibilityPoll = setInterval(() => {
    const visible = window.getComputedStyle(smartContainer).display !== 'none';
    if (visible === lastVisible) return;
    lastVisible = visible;
    if (visible) showSmartMode(); else hideSmartMode();
  }, 250);

  window.addEventListener('beforeunload', () => clearInterval(visibilityPoll));

  document.getElementById("run-smart").onclick = runSmart;
  document.getElementById("stop-smart").onclick = stopSmart;
});

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

async function runSmart() {
  if (running) return;
  running = true;
  ticksSeen = 0;
  tradeLock = false;
  resultsBox.innerHTML = "";

  popup("Checking Entry...");

  const symbol = document.getElementById("submarket")?.value || "R_100";

  if (bulkToggle.checked) {
    await runBulkOnce(symbol);
    running = false;
    return;
  }

  if (singleToggle.checked) {
    // run sequential buys driven by ticks
    await runSingleSequential(symbol);
    running = false;
    return;
  }

  while (running && ticksSeen < tickCount.value) {
    await checkTick(symbol);
    ticksSeen++;
  }

  running = false;
}

// Sequential buys driven by ticks: subscribe and trigger a buy on each incoming tick
async function runSingleSequential(symbol) {
  ticksSeen = 0;
  const baseStake = Number(stakeInput.value); // Store initial stake

  return new Promise((resolve) => {
    try {
      tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
    } catch (err) {
      resolve();
      return;
    }

    tickWs.onopen = () => {
      try { tickWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 })); } catch (e) { }
    };

    tickWs.onmessage = async (e) => {
      if (!running) {
        try { tickWs.close(); } catch (e) { }
        resolve();
        return;
      }

      const msg = JSON.parse(e.data);
      if (!msg.tick) return;

      // determine last digit and decide whether to open a trade
      const quote = msg.tick.quote;
      const digit = Number(String(quote).slice(-1));


      // if a trade is already in progress, skip this tick
      if (tradeLock) return;

      // --- INSTANT BUY EXECUTION ---
      // Check both conditions independently - whichever triggers first executes
      const isOverTrigger = digit < Number(overDigit.value);
      const isUnderTrigger = digit > Number(underDigit.value);

      if (isOverTrigger || isUnderTrigger) {
        tradeLock = true;
        Promise.resolve().then(async () => {
          // Execute the appropriate trade based on which condition was met
          let result;
          if (isOverTrigger && !isUnderTrigger) {
            result = await executeTrade(symbol, "DIGITOVER", overDigit.value, quote);
          } else if (isUnderTrigger && !isOverTrigger) {
            result = await executeTrade(symbol, "DIGITUNDER", underDigit.value, quote);
          } else if (isOverTrigger && isUnderTrigger) {
            // Both conditions met - execute based on which is actually triggered by this specific digit
            // This should rarely happen unless ranges overlap
            result = await executeTrade(symbol, "DIGITOVER", overDigit.value, quote);
          }

          // Martingale Logic
          if (result && result._meta) {
            const profit = Number(result._meta.profit);
            if (profit < 0) {
              const newStake = (Number(stakeInput.value) * 2.1).toFixed(2);
              stakeInput.value = newStake;
            } else if (profit > 0) {
              stakeInput.value = baseStake;
            }
          }

          tradeLock = false;
          ticksSeen++;
        });
      }

      if (ticksSeen >= Number(tickCount.value) || !running) {
        try { tickWs.close(); } catch (e) { }
        resolve();
      }
    };

    tickWs.onerror = () => {
      try { tickWs.close(); } catch (e) { }
      resolve();
    };
  });
}

// Bulk mode: wait for the first tick that matches strategy, then place
// `tickCount` buys concurrently (all at the same time).
async function runBulkOnce(symbol) {
  return new Promise((resolve) => {
    ticksSeen = 0;
    try {
      tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
    } catch (err) {
      resolve();
      return;
    }

    tickWs.onopen = () => {
      try { tickWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 })); } catch (e) { }
    };

    tickWs.onmessage = async (e) => {
      if (!running) {
        try { tickWs.close(); } catch (e) { }
        resolve();
        return;
      }

      const msg = JSON.parse(e.data);
      if (!msg.tick) return;

      const quote = msg.tick.quote;
      const digit = Number(String(quote).slice(-1));

      if (tradeLock) return;

      // Check both conditions independently and simultaneously
      // Whichever condition is met first triggers the appropriate trade
      const isOverTrigger = digit < Number(overDigit.value);
      const isUnderTrigger = digit > Number(underDigit.value);

      let tradeType = null;
      let barrier = 0;

      // Check which condition is actually met by this digit
      if (isOverTrigger && !isUnderTrigger) {
        tradeType = "DIGITOVER";
        barrier = overDigit.value;
      } else if (isUnderTrigger && !isOverTrigger) {
        tradeType = "DIGITUNDER";
        barrier = underDigit.value;
      } else if (isOverTrigger && isUnderTrigger) {
        // Both conditions met (overlapping ranges) - execute OVER
        tradeType = "DIGITOVER";
        barrier = overDigit.value;
      }

      if (!tradeType) return; // no trigger on this tick

      // --- SINGLE PROPOSAL, MULTIPLE BUYS ---
      // --- SINGLE PROPOSAL NOT NEEDED FOR BULK API (it generates them) ---
      tradeLock = true;
      const n = Math.max(1, Number(tickCount.value) || 1);
      const stake = stakeInput.value;

      // Get current token to repeat n times
      let token = localStorage.getItem('active_token');
      if (!token && getCurrentToken) {
        token = getCurrentToken();
      }
      if (!token) {
        popup('Error', 'No active token found', 3000);
        tradeLock = false;
        return;
      }

      const tokens = Array(n).fill(token);

      // Execute Bulk API Call
      const bulkResp = await buyContractBulk(symbol, tradeType, 1, stake, barrier, n, tokens);

      let success = 0, failed = 0;
      console.log("Bulk response debug:", bulkResp);
      if (bulkResp && bulkResp.buy_contract_for_multiple_accounts) {
        const results = bulkResp.buy_contract_for_multiple_accounts.result || [];
        results.forEach(r => {
          if (r.error) failed++;
          else success++;
        });
      } else {
        failed = n;
      }

      const details = `Executed ${n} bulk trades:<br><strong>${success} succeeded</strong>, <strong>${failed} failed</strong>`;
      popup('Bulk Trade executed', details, 6000);
      tradeLock = false;

      try { tickWs.close(); } catch (e) { }
      resolve();
    };


    tickWs.onerror = () => {
      try { tickWs.close(); } catch (e) { }
      resolve();
    };
  });
}

async function checkTick(symbol) {
  if (tradeLock) return;

  const tick = await new Promise(resolve => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
    ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.tick) {
        ws.close();
        resolve(msg.tick.quote);
      }
    };
  });

  const digit = Number(String(tick).slice(-1));

  if (digit < Number(overDigit.value)) {
    if (!tradeLock) {
      tradeLock = true;
      await executeTrade(symbol, "DIGITOVER", overDigit.value, tick);
      tradeLock = false;
    }
  }

  if (digit > Number(underDigit.value)) {
    if (!tradeLock) {
      tradeLock = true;
      await executeTrade(symbol, "DIGITUNDER", underDigit.value, tick);
      tradeLock = false; // ensure lock is released
    }
  }

  // tradeLock = false; // logic moved inside to specific blocks to avoid premature unlock or overwrite
}

async function executeTrade(symbol, type = "DIGITOVER", barrier = 0, liveQuote = null) {
  // helpers for numeric parsing and balance fetch (used to compute final profit)
  const parseNumeric = (v) => {
    if (v === null || typeof v === 'undefined') return null;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  const firstNumeric = (arr) => {
    for (const v of arr) {
      const p = parseNumeric(v);
      if (p !== null) return p;
    }
    return null;
  };

  async function fetchBalanceOnce(timeoutMs = 3000) {
    return new Promise((resolve) => {
      let resolved = false;
      let ws;
      const timer = setTimeout(() => {
        try { if (ws) ws.close(); } catch (e) { }
        if (!resolved) { resolved = true; resolve(null); }
      }, timeoutMs);

      try {
        ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=61696`);
      } catch (e) {
        clearTimeout(timer);
        return resolve(null);
      }

      ws.onopen = () => {
        const token = getCurrentToken();
        if (token) {
          try { ws.send(JSON.stringify({ authorize: token })); } catch (e) { }
        }
        try { ws.send(JSON.stringify({ balance: 1 })); } catch (e) { }
      };

      ws.onmessage = (ev) => {
        if (resolved) return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && (msg.balance !== undefined || msg.account_balance !== undefined)) {
          clearTimeout(timer);
          try { ws.close(); } catch (e) { }
          resolved = true;
          resolve(msg);
        }
      };

      ws.onerror = () => {
        if (!resolved) {
          clearTimeout(timer);
          try { ws.close(); } catch (e) { }
          resolved = true;
          resolve(null);
        }
      };
    });
  }

  // capture starting balance before buy to compute true delta
  let startingBalance = null;
  try {
    const balBefore = await fetchBalanceOnce(500);
    if (balBefore) startingBalance = firstNumeric([balBefore.balance?.balance, balBefore.account_balance, balBefore.balance_after, balBefore.buy?.balance]);
  } catch (e) {
    startingBalance = null;
  }

  const resp = await buyContract(
    symbol,
    type,
    1,
    stakeInput.value,
    barrier,
    liveQuote,
    true
  );
  // Build unified popup details similar to buyContract.mjs logic
  if (resp?.error) {
    const details = (resp.error && resp.error.message) ? resp.error.message : 'Trade failed';
    popup('Trade failed', details, 6000);
    return resp;
  }

  // Show LIVE popup with real-time updates (using metadata from buyContract)
  try {
    const meta = resp && resp._meta ? resp._meta : null;
    const buyInfo = resp.buy || resp || {};

    if (meta && buyInfo.contract_id) {
      // Use live popup for real-time updates
      showLivePopup(buyInfo.contract_id, {
        tradeType: type,
        stake: Number(meta.stakeAmount || stakeInput.value || 0),
        buyPrice: Number(meta.buyPrice || 0),
        payout: Number(meta.payout || 0),
        balance: meta.endingBalance || meta.startingBalance
      });
    } else if (buyInfo.contract_id) {
      // Fallback: use live popup with basic data
      showLivePopup(buyInfo.contract_id, {
        tradeType: type,
        stake: Number(stakeInput.value || 0),
        buyPrice: Number(buyInfo.buy_price || buyInfo.price || 0),
        payout: Number(buyInfo.payout || 0),
        balance: null
      });
    }
  } catch (e) {
    console.warn('Failed to show live popup:', e);
  }

  return resp;
}

function stopSmart() {
  running = false;
  tradeLock = false;
  if (tickWs) {
    try { tickWs.close(); } catch (e) { }
    tickWs = null;
  }
  popup("Stopped");
}



function updateTickDisplay() {
  tickGridEO.innerHTML = '';

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

    tickGridEO.appendChild(tickEl);
  });

  totalTicksEO.textContent = tickHistory.length;
}

async function runEvenOdd() {
  if (runningEO) {
    stopEvenOdd();
    return;
  }

  const symbol = document.getElementById("submarket")?.value || "R_100";
  const numTrades = parseInt(tickCountEO.value) || 50;
  const stake = stakeInputEO.value;

  if (tickHistory.length < 5) {
    popup("Collecting ticks...", "Need at least 5 ticks to analyze", 2000);
    await collectTicks(symbol, 50);
  }

  runningEO = true;
  document.getElementById("run-even-odd").textContent = "STOP";
  evenOddResults.innerHTML = "Analyzing last 5 ticks...";

  // Check last 5 ticks for consecutive even or odd
  const last5Ticks = tickHistory.slice(-5);
  const allEven = last5Ticks.every(tick => tick % 2 === 0);
  const allOdd = last5Ticks.every(tick => tick % 2 !== 0);

  if (!allEven && !allOdd) {
    evenOddResults.innerHTML = "No consecutive pattern found in last 5 ticks";
    runningEO = false;
    document.getElementById("run-even-odd").textContent = "RUN";
    return;
  }

  const tradeType = allEven ? "DIGITODD" : "DIGITEVEN";
  const pattern = allEven ? "Even" : "Odd";

  evenOddResults.innerHTML = `Found 5 consecutive ${pattern} ticks<br>Placing ${numTrades} ${tradeType} trades...`;

  // Place the trades
  const trades = [];
  for (let i = 0; i < numTrades; i++) {
    try {
      const result = await buyContract(symbol, tradeType, 1, stake, null, null, true);
      trades.push(result);

      // Update results display
      const success = trades.filter(t => !t.error).length;
      const failed = trades.filter(t => t.error).length;
      evenOddResults.innerHTML = `Placing ${tradeType} trades...<br>Completed: ${success + failed}/${numTrades}<br>Success: ${success}, Failed: ${failed}`;

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

  evenOddResults.innerHTML = `
    <strong>Execution Complete</strong><br>
    Pattern: ${pattern} (5 consecutive)<br>
    Trades: ${tradeType}<br>
    Total: ${numTrades}<br>
    Success: ${success}, Failed: ${failed}
  `;

  popup(`Even/Odd Complete`, `Placed ${numTrades} ${tradeType} trades<br>Success: ${success}, Failed: ${failed}`, 5000);

  runningEO = false;
  document.getElementById("run-even-odd").textContent = "RUN";
}

function stopEvenOdd() {
  runningEO = false;
  if (tickWsEO) {
    try { tickWsEO.close(); } catch (e) { }
    tickWsEO = null;
  }
  document.getElementById("run-even-odd").textContent = "RUN";
  popup("Even/Odd Stopped");
}

async function collectTicks(symbol, count = 50) {
  return new Promise((resolve) => {
    let collected = 0;

    try {
      tickWsEO = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");
    } catch (err) {
      resolve();
      return;
    }

    tickWsEO.onopen = () => {
      try { tickWsEO.send(JSON.stringify({ ticks: symbol, subscribe: 1 })); } catch (e) { }
    };

    tickWsEO.onmessage = (e) => {
      if (!runningEO && collected >= count) {
        try { tickWsEO.close(); } catch (e) { }
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
          try { tickWsEO.close(); } catch (e) { }
          resolve();
        }
      }
    };

    tickWsEO.onerror = () => {
      try { tickWsEO.close(); } catch (e) { }
      resolve();
    };
  });
}