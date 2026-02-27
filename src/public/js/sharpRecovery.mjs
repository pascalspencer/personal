import { buyContract, buyContractBulk, getAuthToken, formatQuote, waitForSettlement } from "./buyContract.mjs";
import { showLivePopup } from './livePopup.mjs';

// Strategy State
let running = false;
let tickHistory = []; // Full tick history (prices)
let digitHistory = []; // Last digit history
let tradeLock = false;
let tickWs = null;
let tradesCompleted = 0;
let pingInterval = null;
let baseStake = 0;
let isRecoveryMode = false;
let currentStake = 0; // Tracks the current active stake (with Martingale)

const HISTORY_LIMIT = 120;
const derivAppID = 61696;

document.addEventListener("DOMContentLoaded", () => {
    // UI Injection
    const sentimentOptions = ['Even/Odd', 'Over/Under', 'Matches/Differs', 'Rise/Fall'];
    const evenOddChoices = ['Even', 'Odd'];
    const overUnderChoices = ['Over', 'Under'];
    const matchesDiffersChoices = ['Matches', 'Differs'];
    const riseFallChoices = ['Rise', 'Fall'];

    const createDropdownGroup = (idPrefix) => `
        <div class="sr-column" style="flex: 1; padding: 10px; border: 1px solid #eee; border-radius: 8px; background: #f9f9f9; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px;">
                <select class="sr-main-sentiment" id="${idPrefix}-main" style="flex: 1; height: 35px; border-radius: 4px; border: 1px solid #ccc;">
                    ${sentimentOptions.map(opt => `<option value="${opt.toLowerCase()}">${opt}</option>`).join('')}
                </select>
                <input type="checkbox" id="${idPrefix}-active" class="sr-active-check" style="width: 18px; height: 18px;">
            </div>
            <div class="sr-sub-dropdowns">
                <select id="${idPrefix}-sub1" style="width: 100%; height: 30px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ddd;"></select>
                
                <!-- Dual Barrier Container -->
                <div id="${idPrefix}-barrier-container" style="display: none;">
                    <div id="${idPrefix}-barrier-box1">
                        <label id="${idPrefix}-label1" style="font-size: 0.75rem; color: #666; display: block; margin-bottom: 2px;">Over Barrier:</label>
                        <select id="${idPrefix}-barrier1" style="width: 100%; height: 30px; border-radius: 4px; border: 1px solid #ddd; margin-bottom: 8px;">
                            ${Array.from({ length: 10 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
                        </select>
                    </div>
                    <div id="${idPrefix}-barrier-box2">
                        <label id="${idPrefix}-label2" style="font-size: 0.75rem; color: #666; display: block; margin-bottom: 2px;">Under Barrier:</label>
                        <select id="${idPrefix}-barrier2" style="width: 100%; height: 30px; border-radius: 4px; border: 1px solid #ddd;">
                            ${Array.from({ length: 10 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", `
    <div id="sharp-recovery-panel" style="display:none">
      <div class="smart-card" style="max-width: 900px; margin: 0 auto;">
        <div class="smart-header" style="background: #00204a; color: white; padding: 15px; border-radius: 12px 12px 0 0;">
          <h2 class="smart-title" style="color: white; margin: 0;">Sharp Recovery</h2>
          <p class="smart-sub" style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0;">Advanced Recovery Strategy</p>
        </div>

        <div class="smart-form" style="padding: 20px; background: white; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
          <div class="analysis-section" style="margin-bottom: 25px; background: #fcfcfc; padding: 15px; border-radius: 8px; border: 1px solid #f0f0f0;">
            <div class="tick-header" style="margin-bottom: 12px; font-weight: 600; color: #444; border-bottom: 1px solid #eee; padding-bottom: 8px;">
              Digit Intensity (Last ${HISTORY_LIMIT} ticks)
            </div>
            <div id="sr-digit-stats" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; margin-bottom: 20px;"></div>
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                <div style="text-align: center;">
                    <div class="tick-header" style="margin-bottom: 5px; font-size: 0.8rem; color: #777;">Latest Tick</div>
                    <div class="tick-grid" id="tick-grid-sr" style="width: 50px; height: 40px; background: #fff; border: 2px solid #00bbf0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; color: #00204a;"></div>
                </div>
            </div>
          </div>

          <div class="strategy-area" style="margin-bottom: 30px;">
             <h3 style="font-size: 1.1rem; color: #00204a; margin-bottom: 15px; border-left: 4px solid #00bbf0; padding-left: 10px;">Primary Strategy (2 Slots)</h3>
             <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px;">
                ${createDropdownGroup('ps1')}
                ${createDropdownGroup('ps2')}
             </div>
             <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                <label class="small-toggle" style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; color: #1976d2;">
                    <input type="checkbox" id="sr-execute-all" style="width: 20px; height: 20px;">
                    <span>Execute both simultaneously if triggered</span>
                </label>
             </div>
          </div>

          <div class="recovery-area" style="border-top: 2px dashed #ddd; padding-top: 25px;">
             <h3 style="font-size: 1.1rem; color: #d32f2f; margin-bottom: 15px; border-left: 4px solid #d32f2f; padding-left: 10px;">Recovery Strategy (2 Slots)</h3>
             <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 15px;">
                ${createDropdownGroup('rs1')}
                ${createDropdownGroup('rs2')}
             </div>
             
             <div class="toggle-container" style="background: #fff5f5; border-radius: 8px; border: 1px solid #ffcdd2; margin-top: 15px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                <label class="small-toggle" style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #c62828;">
                    <span>Activate Martingale</span>
                    <input type="checkbox" id="sr-martingale" checked>
                </label>
                <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 5px 12px; border-radius: 20px; border: 1px solid #ffcdd2;">
                    <span style="font-size: 0.85rem; font-weight: 600; color: #555;">Multiplier:</span>
                    <input type="number" id="sr-martingale-multiplier" min="1.0" step="0.01" value="2.1" 
                           style="height: 30px; width: 60px; border: none; font-weight: 800; color: #c62828; text-align: center;">
                </div>
             </div>
          </div>

          <div class="settings-grid" style="margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
              <div class="field">
                  <label style="font-weight: 700; color: #333; margin-bottom: 8px;">Base Stake ($)</label>
                  <input type="number" id="sr-stake" min="0.35" step="0.01" value="0.35" style="border-radius: 8px; border: 2px solid #ddd; height: 45px; font-size: 1.1rem; font-weight: 700;">
              </div>
              <div class="field">
                  <label style="font-weight: 700; color: #333; margin-bottom: 8px;">Total Trades</label>
                  <input type="number" id="sr-count" min="1" value="5" style="border-radius: 8px; border: 2px solid #ddd; height: 45px; font-size: 1.1rem; font-weight: 700;">
              </div>
          </div>

          <div class="action-area" style="text-align: center; margin-top: 25px;">
            <button id="run-sr" class="run-btn" style="width: 100%; height: 60px; font-size: 1.4rem; font-weight: 800; border-radius: 30px; background: linear-gradient(135deg, #00bbf0, #00204a); color: white; border: none; cursor: pointer; transition: all 0.3s ease;">RUN SYSTEM</button>
            <div id="sr-results" class="smart-results" style="margin-top: 20px; font-size: 1.1rem; border-top: 1px solid #eee; padding-top: 15px;">System Ready</div>
          </div>
        </div>
      </div>
    </div>
    `);

    // Initialize dropdowns
    const prefixes = ['ps1', 'ps2', 'rs1', 'rs2'];
    prefixes.forEach(p => {
        const main = document.getElementById(`${p}-main`);
        const sub1 = document.getElementById(`${p}-sub1`);
        const barrierCont = document.getElementById(`${p}-barrier-container`);
        const label1 = document.getElementById(`${p}-label1`);
        const label2 = document.getElementById(`${p}-label2`);

        const updateSubs = () => {
            const val = main.value;
            let options = [];
            if (val === 'even/odd') options = evenOddChoices;
            else if (val === 'over/under') options = overUnderChoices;
            else if (val === 'matches/differs') options = matchesDiffersChoices;
            else if (val === 'rise/fall') options = riseFallChoices;

            sub1.innerHTML = options.map(o => `<option value="${o.toLowerCase()}">${o}</option>`).join('');

            if (val === 'over/under') {
                barrierCont.style.display = 'block';
                label1.textContent = 'Over Barrier:';
                label2.textContent = 'Under Barrier:';
            } else if (val === 'matches/differs') {
                barrierCont.style.display = 'block';
                label1.textContent = 'Matches Digit:';
                label2.textContent = 'Differs Digit:';
            } else {
                barrierCont.style.display = 'none';
            }
        };

        main.addEventListener('change', updateSubs);
        updateSubs();
    });

    document.getElementById("run-sr").onclick = toggleSR;

    const marketSelect = document.getElementById("market");
    const submarketSelect = document.getElementById("submarket");
    if (marketSelect) marketSelect.addEventListener("change", restartTickStream);
    if (submarketSelect) submarketSelect.addEventListener("change", restartTickStream);

    // Resume stream on tab switch
    window.addEventListener('tabChange', (e) => {
        if (e.detail.tab === 'sharp-recovery') {
            startTickStream();
        }
    });

    startTickStream();
});

function toggleSR() {
    if (running) {
        stopSR("System stopped");
    } else {
        runSR();
    }
}

function runSR() {
    const token = getAuthToken();
    if (!token) {
        alert("Authorization required.");
        return;
    }
    running = true;
    tradesCompleted = 0;
    tradeLock = false;
    isRecoveryMode = false;
    baseStake = Number(document.getElementById('sr-stake').value);
    currentStake = baseStake;

    const btn = document.getElementById("run-sr");
    btn.textContent = "STOP SYSTEM";
    btn.style.background = "linear-gradient(135deg, #d32f2f, #7b1fa2)";
    document.getElementById("sr-results").textContent = "📡 Scanning patterns...";
}

function stopSR(msg) {
    running = false;
    const btn = document.getElementById("run-sr");
    if (btn) {
        btn.textContent = "RUN SYSTEM";
        btn.style.background = "linear-gradient(135deg, #00bbf0, #00204a)";
    }
    document.getElementById("sr-results").textContent = msg || "Ready";
}

function startTickStream() {
    if (tickWs) return;
    const submarket = document.getElementById("submarket")?.value || "R_100";
    try {
        tickWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
        tickWs.onopen = () => {
            tickWs.send(JSON.stringify({ ticks: submarket, subscribe: 1 }));
            startPing(tickWs);
        };
        tickWs.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.tick) {
                let quote = data.tick.quote;
                if (data.tick.pip_size !== undefined) quote = Number(quote).toFixed(data.tick.pip_size);
                else quote = formatQuote(data.tick.symbol, quote);
                const digit = Number(String(quote).slice(-1));

                tickHistory.push(Number(data.tick.quote));
                digitHistory.push(digit);
                if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();
                if (digitHistory.length > HISTORY_LIMIT) digitHistory.shift();

                updateUI();
                processTick(data.tick, quote);
            }
        };
        tickWs.onclose = () => {
            tickWs = null;
            const panel = document.getElementById("sharp-recovery-panel");
            if (panel && panel.style.display !== "none") {
                setTimeout(startTickStream, 2000);
            }
        };
    } catch (e) {
        setTimeout(startTickStream, 5000);
    }
}

function startPing(ws) {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
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

async function processTick(tick, quote) {
    if (!running || tradeLock) return;

    const totalTarget = Number(document.getElementById('sr-count').value);
    if (tradesCompleted >= totalTarget) {
        stopSR("Goal Achieved ✅");
        return;
    }

    const executeAll = document.getElementById('sr-execute-all').checked;
    const prefixSet = isRecoveryMode ? ['rs1', 'rs2'] : ['ps1', 'ps2'];

    const activeStrategies = prefixSet.filter(p => document.getElementById(`${p}-active`).checked);
    if (activeStrategies.length === 0) return;

    const lastDigit = digitHistory[digitHistory.length - 1];
    let triggeredActions = [];

    activeStrategies.forEach(p => {
        const type = document.getElementById(`${p}-main`).value;
        const sub = document.getElementById(`${p}-sub1`).value;
        const b1 = Number(document.getElementById(`${p}-barrier1`).value);
        const b2 = Number(document.getElementById(`${p}-barrier2`).value);

        let tradeType = '';
        let prediction = 0;

        // Alternating Over/Under Logic (Checks both barriers simultaneously)
        if (type === 'over/under') {
            if (lastDigit < b1) {
                tradeType = 'DIGITOVER';
                prediction = b1;
            } else if (lastDigit > b2) {
                tradeType = 'DIGITUNDER';
                prediction = b2;
            }
        }
        // Even/Odd Switch Logic
        else if (type === 'even/odd') {
            if (digitHistory.length >= 4) {
                const last4 = digitHistory.slice(-4);
                const allEven = last4.every(d => d % 2 === 0);
                const allOdd = last4.every(d => d % 2 !== 0);
                if (allEven) tradeType = 'DIGITODD';
                else if (allOdd) tradeType = 'DIGITEVEN';
            }
        }
        // Dynamic Momentum Breakout Rise/Fall Logic
        else if (type === 'rise/fall') {
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

                if (isMax && posChanges >= 4) tradeType = 'CALL';
                else if (isMin && negChanges >= 4) tradeType = 'PUT';
            }
        }
        // Alternating Matches/Differs Logic (Checks both barrier conditions)
        else if (type === 'matches/differs') {
            if (lastDigit === b1) {
                tradeType = 'DIGITMATCH';
                prediction = b1;
            } else if (lastDigit === b2) {
                tradeType = 'DIGITDIFF';
                prediction = b2;
            }
        }

        if (tradeType) {
            triggeredActions.push({ type: tradeType, prediction });
        }
    });

    if (triggeredActions.length > 0) {
        tradeLock = true;
        if (executeAll) {
            for (const t of triggeredActions) {
                await executeTrade(tick.symbol, t.type, t.prediction, quote);
                tradesCompleted++;
            }
        } else {
            const t = triggeredActions[0];
            await executeTrade(tick.symbol, t.type, t.prediction, quote);
            tradesCompleted++;
        }

        // Brief pause after trade to avoid overlapping triggers
        setTimeout(() => { tradeLock = false; }, 3000);
    }
}

async function executeTrade(symbol, type, barrier, quote) {
    const resultsBox = document.getElementById("sr-results");
    resultsBox.textContent = `🎯 Triggered ${type} @ ${currentStake.toFixed(2)}`;

    const resp = await buyContract(symbol, type, 1, currentStake, barrier, quote, true);
    if (resp?.buy) {
        showLivePopup(resp.buy.contract_id, { tradeType: type, stake: currentStake.toFixed(2), payout: resp.buy.payout });
        handleSettlement(resp.buy.contract_id);
    } else if (resp?.error) {
        resultsBox.innerHTML = `<span style="color:red">Error: ${resp.error.message}</span>`;
    }
    return resp;
}

async function handleSettlement(contractId) {
    const result = await waitForSettlement(contractId);
    if (result) {
        const resultsBox = document.getElementById("sr-results");
        if (result.status === 'won') {
            resultsBox.innerHTML = `✅ Winner! System Reset.`;
            isRecoveryMode = false;
            currentStake = baseStake;
        } else {
            resultsBox.innerHTML = `❌ Loss. Maintaining Recovery & Martingale...`;
            isRecoveryMode = true; // Stays true until a win
            if (document.getElementById('sr-martingale').checked) {
                const mult = parseFloat(document.getElementById('sr-martingale-multiplier').value) || 2.1;
                currentStake = currentStake * mult;
            }
        }
    }
}

function updateUI() {
    const statsBox = document.getElementById("sr-digit-stats");
    const gridBox = document.getElementById("tick-grid-sr");
    if (!statsBox || !gridBox) return;

    statsBox.innerHTML = "";
    const counts = Array(10).fill(0);
    digitHistory.forEach(d => counts[d]++);
    counts.forEach((c, i) => {
        const total = digitHistory.length || 1;
        const pct = ((c / total) * 100).toFixed(1);
        statsBox.insertAdjacentHTML('beforeend', `
            <div style="border: 1px solid #eee; padding: 4px; text-align: center; border-radius: 4px; background: white; min-width: 30px;">
                <div style="font-weight: bold; font-size: 0.8rem;">${i}</div>
                <div style="font-size: 0.6rem; color: #888;">${pct}%</div>
            </div>
        `);
    });

    const lastDigit = digitHistory[digitHistory.length - 1];
    gridBox.textContent = lastDigit !== undefined ? lastDigit : '';
}
