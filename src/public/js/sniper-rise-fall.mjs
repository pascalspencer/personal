import { buyContract, getAuthToken, waitForSettlement } from "./buyContract.mjs";

// Strategy State
let running = false;
let tickHistory = []; // Tracks prices for Rise/Fall
let tradeLock = false;
let tickWs = null;
let baseStake = 0;
let tradesCompleted = 0;
let pingInterval = null;

// Martingale State
let martingaleActive = false;
let lastTradeStatus = null; // { won: boolean, stake: number }

// UI Elements
let tickCount, stakeInput, martingaleToggle, martingaleMultiplier;
let resultsBox, tickDisplay;

const HISTORY_LIMIT = 50;
const derivAppID = 61696;

document.addEventListener("DOMContentLoaded", () => {
    // UI Injection (Copy of Smart Over/Under style)
    document.body.insertAdjacentHTML("beforeend", `
    <div id="sniper-rise-fall-panel" style="display:none">
      <div class="smart-card">
        <div class="smart-header">
          <h2 class="smart-title">Sniper Rise / Fall</h2>
          <p class="smart-sub">Price Direction Analysis</p>
        </div>

        <div class="smart-form">
          <div class="analysis-section" style="margin-bottom: 20px;">
            <div class="tick-header" style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
              Live Price Action
            </div>
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px;">
                <div style="text-align: center;">
                    <div class="tick-grid" id="tick-display-srf" style="min-width: 120px; height: 50px; background: #fff; border: 2px solid #00bbf0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: #00204a; padding: 0 15px;">
                      Waiting...
                    </div>
                </div>
            </div>
          </div>

          <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="field">
              <label for="tick-count-srf">Target Trades</label>
              <input type="number" id="tick-count-srf" min="1" value="5">
            </div>
            <div class="field">
              <label for="stake-srf">Stake (Min 0.35)</label>
              <input type="number" id="stake-srf" min="0.35" step="0.01" value="0.35">
            </div>

            <!-- Martingale Section -->
            <div class="toggle-container" style="grid-column: span 2; margin-top: 5px;">
              <label class="small-toggle">
                <span>Martingale</span>
                <input type="checkbox" id="martingale-srf">
              </label>
              <div class="small-toggle" style="flex: 1.5; justify-content: flex-start; gap: 10px;">
                <span style="font-size: 0.8rem; color: #666;">Multiplier</span>
                <input type="number" id="martingale-multiplier-srf" min="1.0" step="1.0" value="2.1" 
                       style="height: 30px; width: 65px; padding: 0 5px; font-weight: bold; border: 1px solid #ddd; background: #fff;">
              </div>
            </div>
          </div>

          <div class="action-area" style="text-align: center;">
            <button id="run-sniper" class="run-btn" style="width: 100%; height: 50px; font-size: 1.2rem; background: linear-gradient(135deg, #00bbf0, #00204a); color: white; border: none; border-radius: 8px; cursor: pointer;">RUN</button>
            <div id="sniper-results" class="smart-results" style="margin-top: 15px; font-weight: bold; min-height: 24px;">Ready</div>
          </div>
        </div>
      </div>
    </div>
  `);

    // Get UI elements
    tickCount = document.getElementById("tick-count-srf");
    stakeInput = document.getElementById("stake-srf");
    martingaleToggle = document.getElementById("martingale-srf");
    martingaleMultiplier = document.getElementById("martingale-multiplier-srf");
    resultsBox = document.getElementById("sniper-results");
    tickDisplay = document.getElementById("tick-display-srf");

    document.getElementById("run-sniper").onclick = toggleSniper;

    // Market listener to restart stream
    const marketSelect = document.getElementById("market");
    const submarketSelect = document.getElementById("submarket");
    if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
    if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

    startTickStream();
});

function toggleSniper() {
    if (running) {
        stopSniper("Stopped by user");
    } else {
        runSniper();
    }
}

function runSniper() {
    const token = getAuthToken();
    if (!token) {
        alert("Please login first");
        return;
    }

    running = true;
    tradesCompleted = 0;
    tradeLock = false;
    martingaleActive = martingaleToggle.checked;
    lastTradeStatus = null;
    baseStake = Number(stakeInput.value);

    const btn = document.getElementById("run-sniper");
    btn.textContent = "STOP";
    btn.style.background = "linear-gradient(135deg, #d32f2f, #7b1fa2)";
    resultsBox.textContent = "Scanning patterns...";
}

function stopSniper(msg) {
    running = false;
    stakeInput.value = baseStake; // Reset stake on stop
    const btn = document.getElementById("run-sniper");
    if (btn) {
        btn.textContent = "RUN";
        btn.style.background = "linear-gradient(135deg, #00bbf0, #00204a)";
    }
    if (resultsBox) resultsBox.textContent = msg || "Ready";
}

function startTickStream() {
    if (tickWs) return;
    const submarket = document.getElementById("submarket")?.value || "R_100";

    try {
        tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

        tickWs.onopen = () => {
            console.log(`[Sniper] Tick stream connected for ${submarket}`);
            tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
            startPing(tickWs);
        };

        tickWs.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.tick) {
                const quote = Number(data.tick.quote);
                tickHistory.push(quote);
                if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

                updateUI(quote);
                if (running && !tradeLock) {
                    processTick();
                }
            }
        };

        tickWs.onclose = () => {
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = null;
            tickWs = null;
            const panel = document.getElementById("sniper-rise-fall-panel");
            if (panel && panel.style.display !== "none") {
                setTimeout(startTickStream, 2000);
            }
        };
    } catch (e) {
        console.error("[Sniper] Failed to start tick stream:", e);
        setTimeout(startTickStream, 5000);
    }
}

function updateUI(quote) {
    if (!tickDisplay) return;
    const prevQuote = tickHistory.length > 1 ? tickHistory[tickHistory.length - 2] : quote;
    tickDisplay.textContent = quote;
    tickDisplay.style.color = quote > prevQuote ? "#2e7d32" : quote < prevQuote ? "#d32f2f" : "#00204a";
}

function startPing(ws) {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ ping: 1 }));
            } catch (e) {
                console.warn("[Sniper] Ping failed", e);
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

async function processTick() {
    if (tradesCompleted >= Number(tickCount.value)) {
        stopSniper("Goal Reached");
        return;
    }

    // Strategy: 3 ticks in same direction (from Sharp Recovery)
    if (tickHistory.length >= 3) {
        const cur = tickHistory[tickHistory.length - 1];
        const p1 = tickHistory[tickHistory.length - 2];
        const p2 = tickHistory[tickHistory.length - 3];

        let tradeType = '';
        if (cur > p1 && p1 > p2) tradeType = 'CALL';
        else if (cur < p1 && p1 < p2) tradeType = 'PUT';

        if (tradeType) {
            handleTrigger(tradeType);
        }
    }
}

async function handleTrigger(type) {
    tradeLock = true;
    const symbol = document.getElementById("submarket").value;
    const currentStake = Number(stakeInput.value);

    resultsBox.textContent = `🎯 Triggered ${type} @ ${currentStake.toFixed(2)}`;

    try {
        const resp = await buyContract(symbol, type, 1, currentStake, null, null, true);
        if (resp?.buy) {
            tradesCompleted++;
            const result = await waitForSettlement(resp.buy.contract_id);
            if (result) {
                handleResult(result.status === 'won');
            }
        } else if (resp?.error) {
            resultsBox.innerHTML = `<span style="color:red">Error: ${resp.error.message}</span>`;
            tradeLock = false;
        }
    } catch (e) {
        console.error(e);
        tradeLock = false;
    }
}

function handleResult(won) {
    if (won) {
        resultsBox.innerHTML = `<span style="color:green">WIN!</span> System Reset.`;
        stakeInput.value = baseStake;
    } else {
        resultsBox.innerHTML = `<span style="color:red">LOSS.</span> Recovery active.`;
        if (martingaleActive) {
            const mult = parseFloat(martingaleMultiplier.value) || 2.1;
            stakeInput.value = (Number(stakeInput.value) * mult).toFixed(2);
        }
    }

    // Brief pause to avoid immediate re-trigger
    setTimeout(() => {
        tradeLock = false;
        if (running) resultsBox.textContent = "Scanning patterns...";
    }, 3000);
}
