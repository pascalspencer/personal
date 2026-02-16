import { buyContract, buyContractBulk, getAuthToken, formatQuote } from "./buyContract.mjs";
import { showLivePopup } from './livePopup.mjs';

// Strategy State
let running = false;
let tickHistory = [];
let tradeLock = false;
let tickWs = null;
let tradesCompleted = 0;
let pingInterval = null;
let baseStake = 0;

// Martingale State
let martingaleActive = false;
let lastTrade = null; // { type: "DIGITDIFF", prediction: 5, stake: 0.35 }

let digitSelect, tickCount, stakeInput, singleToggle, bulkToggle;
let resultsBox, digitStatsDisplay, tickGrid;
let martingaleToggle, martingaleMultiplier;

const HISTORY_LIMIT = 100;
const derivAppID = 61696;

document.addEventListener("DOMContentLoaded", () => {
    // UI Injection
    document.body.insertAdjacentHTML("beforeend", `
    <div id="simple-differs-panel" style="display:none">
      <div class="smart-card">
        <div class="smart-header">
          <h2 class="smart-title">Simple Differs</h2>
          <p class="smart-sub">Digit Comparison</p>
        </div>

        <div class="smart-form">
          <div class="analysis-section" style="margin-bottom: 20px;">
            <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
              (Last ${HISTORY_LIMIT} ticks)
            </div>
            
            <div id="sd-digit-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
              <!-- Digits 0-9 indicators -->
            </div>

            <div class="tick-header" style="margin-bottom: 8px; font-size: 0.9rem; color: #666;">Latest Tick</div>
            <div class="tick-grid" id="tick-grid-sd" style="display: flex; gap: 4px; overflow-x: hidden; height: 35px; align-items: center; justify-content: center; background: #f9f9f9; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
              <!-- Latest tick here -->
            </div>
          </div>

          <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="field" style="grid-column: span 2;">
              <label for="sd-digit-input">Digit Differs</label>
              <select id="sd-digit-input" style="width: 100%;">
                ${Array.from({ length: 10 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="sd-tick-count">Target Trades</label>
              <input type="number" id="sd-tick-count" min="1" value="5">
            </div>
            <div class="field">
              <label for="sd-stake">Stake (Min 0.35)</label>
              <input type="number" id="sd-stake" min="0.35" step="0.01" value="0.35">
            </div>

            <!-- Martingale Section -->
            <div class="field" style="grid-column: span 2; display: flex; align-items: center; gap: 10px; background: #fff3e0; padding: 8px; border-radius: 6px;">
              <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; white-space: nowrap;">
                <input type="checkbox" id="martingale-sd" style="width: auto; height: auto;">
                Martingale
              </label>
              <input type="number" id="martingale-multiplier-sd" min="1.0" step="1.0" value="11" style="width: 80px;" placeholder="Mult">
            </div>
            
            <div class="toggle-container" style="grid-column: span 2; display: flex; justify-content: space-around; background: #f5f5f5; padding: 10px; border-radius: 8px; margin-top: 5px;">
              <label class="small-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <span style="font-size: 0.9rem; font-weight: 500;">Single Mode</span>
                <input type="checkbox" id="sd-single-toggle" checked style="width: 18px; height: 18px; cursor: pointer;">
              </label>
              <div style="width: 1px; background: #ddd; height: 20px;"></div>
              <label class="small-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <span style="font-size: 0.9rem; font-weight: 500;">Bulk Mode</span>
                <input type="checkbox" id="sd-bulk-toggle" style="width: 18px; height: 18px; cursor: pointer;">
              </label>
            </div>
          </div>

          <div class="action-area" style="text-align: center;">
            <button id="run-sd" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem;">RUN</button>
            <div id="sd-results" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Ready</div>
          </div>
        </div>
      </div>
    </div>
  `);

    // Get UI elements
    digitSelect = document.getElementById("sd-digit-input");
    tickCount = document.getElementById("sd-tick-count");
    stakeInput = document.getElementById("sd-stake");
    singleToggle = document.getElementById("sd-single-toggle");
    bulkToggle = document.getElementById("sd-bulk-toggle");
    resultsBox = document.getElementById("sd-results");
    digitStatsDisplay = document.getElementById("sd-digit-stats");
    tickGrid = document.getElementById("tick-grid-sd");
    martingaleToggle = document.getElementById("martingale-sd");
    martingaleMultiplier = document.getElementById("martingale-multiplier-sd");

    // Mutually exclusive toggles
    function updateToggles(e) {
        if (e.target === singleToggle && singleToggle.checked) bulkToggle.checked = false;
        if (e.target === bulkToggle && bulkToggle.checked) singleToggle.checked = false;
    }
    singleToggle.addEventListener('change', updateToggles);
    bulkToggle.addEventListener('change', updateToggles);

    document.getElementById("run-sd").onclick = toggleSD;

    // Market listener to restart stream
    const marketSelect = document.getElementById("market");
    const submarketSelect = document.getElementById("submarket");
    if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
    if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

    startTickStream();
});

function toggleSD() {
    if (running) {
        stopSD("Stopped by user");
    } else {
        runSD();
    }
}

function runSD() {
    const token = getAuthToken();
    if (!token) {
        alert("Please login first");
        return;
    }

    running = true;
    tradesCompleted = 0;
    tradeLock = false;
    martingaleActive = martingaleToggle.checked;
    lastTrade = null;
    baseStake = Number(stakeInput.value);

    const btn = document.getElementById("run-sd");
    btn.textContent = "STOP";
    btn.classList.add("stop");
    resultsBox.textContent = "Scanning...";
}

function stopSD(msg) {
    running = false;
    stakeInput.value = baseStake; // Reset stake
    const btn = document.getElementById("run-sd");
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
            console.log(`[SD] Tick stream connected for ${submarket}`);
            tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
            startPing(tickWs);
        };

        tickWs.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.tick) {
                let quote = data.tick.quote;
                if (data.tick.pip_size !== undefined) {
                    quote = Number(quote).toFixed(data.tick.pip_size);
                } else {
                    quote = formatQuote(data.tick.symbol, quote);
                }
                const digit = Number(String(quote).slice(-1));

                tickHistory.push(digit);
                if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

                // --- MARTINGALE LOGIC START ---
                if (running && martingaleActive && lastTrade && !tradeLock) {
                    checkMartingale(digit);
                }
                // --- MARTINGALE LOGIC END ---

                updateUI();

                setTimeout(() => processTick(data.tick), 0);
            }
        };

        tickWs.onclose = () => {
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = null;
            tickWs = null;
            const panel = document.getElementById("simple-differs-panel");
            if (panel && panel.style.display !== "none") {
                setTimeout(startTickStream, 2000);
            }
        };
    } catch (e) {
        console.error("[SD] Failed to start tick stream:", e);
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = null;
        setTimeout(startTickStream, 5000);
    }
}

function checkMartingale(currentDigit) {
    // Differs: Win if currentDigit != prediction. Loss if currentDigit == prediction.
    if (!lastTrade) return;
    const lost = currentDigit === lastTrade.prediction;

    if (!lost) {
        // WIN
        console.log(`[Martingale] WIN! Reset stake to ${baseStake}`);
        stakeInput.value = baseStake;
        resultsBox.innerHTML += ` <span style="color:green">WIN</span>`;
    } else {
        // LOSS
        const mult = Number(martingaleMultiplier.value) || 11; // High default for Differs
        const newStake = (Number(stakeInput.value) * mult).toFixed(2);
        console.log(`[Martingale] LOSS! Increasing stake to ${newStake}`);
        stakeInput.value = newStake;
        resultsBox.innerHTML += ` <span style="color:red">LOSS</span>`;
    }

    lastTrade = null;
}

function startPing(ws) {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ ping: 1 }));
            } catch (e) {
                console.warn("[SD] Ping failed", e);
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

    // If waiting for result (Martingale active), do not trigger new trade yet
    if (martingaleActive && lastTrade) return;

    let quote = tick.quote;
    if (tick.pip_size !== undefined) {
        quote = Number(quote).toFixed(tick.pip_size);
    } else {
        quote = formatQuote(tick.symbol, quote);
    }
    const digit = Number(String(quote).slice(-1));

    if (tradesCompleted >= Number(tickCount.value)) {
        stopSD("Goal Reached");
        return;
    }

    const targetDigit = Number(digitSelect.value);
    if (digit === targetDigit) {
        handleTrigger(quote);
    }
}

async function handleTrigger(quote) {
    const symbol = document.getElementById("submarket").value;

    if (bulkToggle.checked) {
        running = false;
        const count = Number(tickCount.value);
        resultsBox.textContent = `Deploying ${count} Bulk Trades...`;
        const token = getAuthToken();
        try {
            const resp = await buyContractBulk(symbol, "DIGITDIFF", 1, stakeInput.value, digitSelect.value, count, token ? [token] : []);
            if (resp) stopSD("Bulk Complete");
        } catch (e) {
            console.error(e);
            stopSD("Bulk Failed");
        }
        return;
    }

    // Single Mode
    tradeLock = true;
    resultsBox.textContent = `🎯 Triggered DIGITDIFF on ${quote.slice(-1)}`;

    try {
        const resp = await executeTrade(symbol, digitSelect.value, quote);
        tradesCompleted++;

        if (martingaleActive && resp && !resp.error) {
            // Store trade to check NEXT tick
            lastTrade = {
                type: "DIGITDIFF",
                prediction: Number(digitSelect.value),
                stake: Number(stakeInput.value)
            };
        }

        tradeLock = false;
    } catch (e) {
        console.error(e);
        tradeLock = false;
    }
}

async function executeTrade(symbol, barrier = 0, liveQuote = null) {
    const stake = stakeInput.value;
    const resp = await buyContract(symbol, "DIGITDIFF", 1, stake, barrier, liveQuote, true);

    if (resp?.buy) {
        showLivePopup(resp.buy.contract_id, {
            tradeType: "DIGITDIFF",
            stake: stake,
            payout: resp.buy.payout
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
        const isSelected = s.digit === Number(digitSelect.value);
        card.style.cssText = `
            border: 1px solid #eee; border-radius: 6px; padding: 8px 4px; text-align: center;
            background: ${isSelected ? '#e3f2fd' : '#fff'};
            border-bottom: 3px solid ${s.isRecent ? '#2196f3' : isSelected ? '#1976d2' : '#ddd'};
            transition: all 0.3s ease;
        `;
        card.innerHTML = `<div style="font-weight:bold; font-size:1.1rem; color:#333;">${s.digit}</div>
                          <div style="font-size:0.75rem; color:#666;">${s.heat.toFixed(1)}%</div>`;
        digitStatsDisplay.appendChild(card);
    });

    const lastTick = tickHistory.length > 0 ? tickHistory[tickHistory.length - 1] : null;
    tickGrid.innerHTML = "";
    if (lastTick !== null) {
        const div = document.createElement("div");
        div.style.cssText = `
          width: 40px; height: 30px; display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; border-radius: 6px; flex-shrink: 0;
          background: #2196f3; color: #fff; font-weight: bold; border: 1px solid #2196f3;
          margin: 0 auto;
        `;
        div.textContent = lastTick;
        tickGrid.appendChild(div);
        tickGrid.style.justifyContent = "center";
    }
}
