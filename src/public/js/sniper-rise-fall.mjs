import { buyContract, buyContractBulk, getAuthToken, waitForSettlement } from "./buyContract.mjs";

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

// UI Elements
let tickCount, stakeInput, martingaleToggle, martingaleMultiplier;
let resultsBox, tickDisplay, chartCanvas, chartCtx;

const HISTORY_LIMIT = 50;
const CHART_POINTS = 30; // Number of points to show on chart
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
            
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; margin-bottom: 20px;">
                <!-- Price Chart -->
                <div style="width: 100%; height: 120px; background: #fcfcfc; border: 1px solid #efefef; border-radius: 8px; position: relative; overflow: hidden;">
                  <canvas id="sniper-chart" style="width: 100%; height: 100%; display: block;"></canvas>
                </div>

                <div style="text-align: center;">
                    <div class="tick-grid" id="tick-display-srf" style="min-width: 140px; height: 50px; background: #fff; border: 2px solid #00bbf0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: #00204a; padding: 0 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                      Waiting...
                    </div>
                </div>
            </div>
          </div>

          <div class="settings-grid" style="gap: 15px; margin-bottom: 20px;">
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
                <input type="number" id="martingale-multiplier-srf" min="1.0" step="0.1" value="2.1" 
                       style="height: 30px; width: 65px; padding: 0 5px; font-weight: bold; border: 1px solid #ddd; background: #fff;">
              </div>
            </div>

            <!-- Single/Bulk Selection -->
            <div class="toggle-container" style="grid-column: span 2; margin-top: 5px; background: #e3f2fd; border: 1px solid #bbdefb; padding: 10px; border-radius: 8px; display: flex; gap: 10px;">
              <label class="small-toggle" style="flex: 1; background: #fff; justify-content: space-between;">
                <span>Single</span>
                <input type="checkbox" id="mode-single-srf" checked>
              </label>
              <label class="small-toggle" style="flex: 1; background: #fff; justify-content: space-between;">
                <span>Bulk</span>
                <input type="checkbox" id="mode-bulk-srf">
              </label>
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

    const singleToggle = document.getElementById("mode-single-srf");
    const bulkToggle = document.getElementById("mode-bulk-srf");

    singleToggle.onchange = () => { if (singleToggle.checked) bulkToggle.checked = false; else singleToggle.checked = true; };
    bulkToggle.onchange = () => { if (bulkToggle.checked) singleToggle.checked = false; else bulkToggle.checked = true; };
    resultsBox = document.getElementById("sniper-results");
    tickDisplay = document.getElementById("tick-display-srf");
    chartCanvas = document.getElementById("sniper-chart");

    if (chartCanvas) {
        chartCtx = chartCanvas.getContext("2d");
        initChart();
        window.addEventListener('resize', initChart);
    }

    document.getElementById("run-sniper").onclick = toggleSniper;

    // Market listener to restart stream
    const marketSelect = document.getElementById("market");
    const submarketSelect = document.getElementById("submarket");
    if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
    if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

    // Resume stream on tab switch
    window.addEventListener('tabChange', (e) => {
        if (e.detail.tab === 'sniper-rise-fall') {
            startTickStream();
        }
    });

    startTickStream();
});

function initChart() {
    if (!chartCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    chartCanvas.style.width = rect.width + 'px';
    chartCanvas.style.height = rect.height + 'px';
    chartCtx.scale(dpr, dpr);
    drawChart();
}

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
                drawChart();
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

function drawChart() {
    if (!chartCtx || tickHistory.length < 2) return;

    const width = chartCanvas.offsetWidth;
    const height = chartCanvas.offsetHeight;
    chartCtx.clearRect(0, 0, width, height);

    const history = tickHistory.slice(-CHART_POINTS);
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = (max - min) || (max * 0.0001); // Avoid division by zero
    const padding = 20;

    const getY = (val) => height - padding - ((val - min) / range) * (height - 2 * padding);
    const getX = (idx) => (idx / (history.length - 1)) * width;

    // Line Path
    chartCtx.beginPath();
    chartCtx.strokeStyle = "#00bbf0";
    chartCtx.lineWidth = 2;
    chartCtx.lineJoin = "round";
    chartCtx.moveTo(getX(0), getY(history[0]));

    for (let i = 1; i < history.length; i++) {
        chartCtx.lineTo(getX(i), getY(history[i]));
    }
    chartCtx.stroke();

    // Fill Area
    const fillPath = new Path2D();
    fillPath.moveTo(getX(0), getY(history[0]));
    for (let i = 1; i < history.length; i++) {
        fillPath.lineTo(getX(i), getY(history[i]));
    }
    fillPath.lineTo(getX(history.length - 1), height);
    fillPath.lineTo(getX(0), height);
    fillPath.closePath();

    const gradient = chartCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 187, 240, 0.2)");
    gradient.addColorStop(1, "rgba(0, 187, 240, 0)");
    chartCtx.fillStyle = gradient;
    chartCtx.fill(fillPath);

    // Latest Point
    const lastX = getX(history.length - 1);
    const lastY = getY(history[history.length - 1]);
    chartCtx.beginPath();
    chartCtx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    chartCtx.fillStyle = "#00bbf0";
    chartCtx.fill();
    chartCtx.strokeStyle = "#fff";
    chartCtx.lineWidth = 1.5;
    chartCtx.stroke();
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
    // Clear history and reset UI for instant update
    tickHistory = [];
    if (tickDisplay) tickDisplay.textContent = "Waiting...";
    drawChart();

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

    // Dynamic Momentum Breakout Logic
    if (tickHistory.length >= 6) {
        const history = tickHistory.slice(-6);
        const cur = history[5];
        const isMax = cur === Math.max(...history);
        const isMin = cur === Math.min(...history);

        // Price changes (5 changes for 6 ticks)
        let posChanges = 0;
        let negChanges = 0;
        for (let i = 1; i < history.length; i++) {
            if (history[i] > history[i - 1]) posChanges++;
            else if (history[i] < history[i - 1]) negChanges++;
        }

        let tradeType = '';
        if (isMax && posChanges >= 4) tradeType = 'CALL';
        else if (isMin && negChanges >= 4) tradeType = 'PUT';

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

    const isBulk = document.getElementById("mode-bulk-srf").checked;
    const numTrades = Number(tickCount.value);

    try {
        if (isBulk) {
            const token = getAuthToken();
            const tokens = [token];
            const resp = await buyContractBulk(symbol, type, 1, currentStake, null, numTrades, tokens);
            if (resp?.error) {
                resultsBox.innerHTML = `<span style="color:red">Bulk Error: ${resp.error.message}</span>`;
                tradeLock = false;
                stopSniper();
                return;
            }
            resultsBox.innerHTML = `<span style="color:green">Bulk Trades Placed!</span> Goal Reached.`;
            return stopSniper("Goal Reached");
        }

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
