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
let isRecoveryMode = false;

// Martingale State
let lastTradeResult = null; // 'win' or 'loss'

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
        <div class="sr-column" style="flex: 1; padding: 10px; border: 1px solid #eee; border-radius: 8px; background: #f9f9f9; min-width: 150px;">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px;">
                <select class="sr-main-sentiment" id="${idPrefix}-main" style="flex: 1; height: 35px; border-radius: 4px; border: 1px solid #ccc;">
                    ${sentimentOptions.map(opt => `<option value="${opt.toLowerCase()}">${opt}</option>`).join('')}
                </select>
                <input type="checkbox" id="${idPrefix}-active" class="sr-active-check" style="width: 18px; height: 18px;">
            </div>
            <div class="sr-sub-dropdowns">
                <select id="${idPrefix}-sub1" style="width: 100%; height: 30px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #ddd;"></select>
                <select id="${idPrefix}-sub2" style="width: 100%; height: 30px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #ddd;"></select>
                <div id="${idPrefix}-barrier-container" style="display: none;">
                    <label style="font-size: 0.75rem; color: #666;">Barrier Digit:</label>
                    <select id="${idPrefix}-barrier" style="width: 100%; height: 30px; border-radius: 4px; border: 1px solid #ddd;">
                        ${Array.from({ length: 10 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", `
    <div id="sharp-recovery-panel" style="display:none">
      <div class="smart-card" style="max-width: 1000px; margin: 0 auto;">
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
             <h3 style="font-size: 1.1rem; color: #00204a; margin-bottom: 15px; border-left: 4px solid #00bbf0; padding-left: 10px;">Primary Execution Configuration</h3>
             <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px;">
                ${createDropdownGroup('ps1')}
                ${createDropdownGroup('ps2')}
                ${createDropdownGroup('ps3')}
                ${createDropdownGroup('ps4')}
             </div>
             <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                <label class="small-toggle" style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; color: #1976d2;">
                    <input type="checkbox" id="sr-execute-all" style="width: 20px; height: 20px;">
                    <span>Simultaneous Execution (All Checked)</span>
                </label>
             </div>
          </div>

          <div class="recovery-area" style="border-top: 2px dashed #ddd; padding-top: 25px;">
             <h3 style="font-size: 1.1rem; color: #d32f2f; margin-bottom: 15px; border-left: 4px solid #d32f2f; padding-left: 10px;">Recovery Matrix Configuration</h3>
             <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 15px;">
                ${createDropdownGroup('rs1')}
                ${createDropdownGroup('rs2')}
                ${createDropdownGroup('rs3')}
                ${createDropdownGroup('rs4')}
             </div>
             
             <div class="toggle-container" style="background: #fff5f5; border-radius: 8px; border: 1px solid #ffcdd2; margin-top: 15px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                <label class="small-toggle" style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #c62828;">
                    <span>Activate Martingale</span>
                    <input type="checkbox" id="sr-martingale" checked>
                </label>
                <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 5px 12px; border-radius: 20px; border: 1px solid #ffcdd2;">
                    <span style="font-size: 0.85rem; font-weight: 600; color: #555;">Multiplier:</span>
                    <input type="number" id="sr-martingale-multiplier" min="1.0" step="0.1" value="2.1" 
                           style="height: 30px; width: 60px; border: none; font-weight: 800; color: #c62828; text-align: center;">
                </div>
             </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
              <div class="field">
                  <label style="font-weight: 700; color: #333; margin-bottom: 8px;">Base Stake ($)</label>
                  <input type="number" id="sr-stake" min="0.35" step="0.01" value="0.35" style="border-radius: 8px; border: 2px solid #ddd; height: 45px; font-size: 1.1rem; font-weight: 700;">
              </div>
              <div class="field">
                  <label style="font-weight: 700; color: #333; margin-bottom: 8px;">Profit Goal (Trades)</label>
                  <input type="number" id="sr-count" min="1" value="5" style="border-radius: 8px; border: 2px solid #ddd; height: 45px; font-size: 1.1rem; font-weight: 700;">
              </div>
          </div>

          <div class="action-area" style="text-align: center; margin-top: 25px;">
            <button id="run-sr" class="run-btn" style="width: 100%; height: 60px; font-size: 1.4rem; font-weight: 800; border-radius: 30px; background: linear-gradient(135deg, #00bbf0, #00204a); color: white; border: none; cursor: pointer; transition: all 0.3s ease;">RUN SYSTEM</button>
            <div id="sr-results" class="smart-results" style="margin-top: 20px; font-size: 1.1rem; border-top: 1px solid #eee; padding-top: 15px;">System Active • Waiting for scan</div>
          </div>
        </div>
      </div>
    </div>
    `);

    // Initialize dropdowns
    const prefixes = ['ps1', 'ps2', 'ps3', 'ps4', 'rs1', 'rs2', 'rs3', 'rs4'];
    prefixes.forEach(p => {
        const main = document.getElementById(`${p}-main`);
        const sub1 = document.getElementById(`${p}-sub1`);
        const sub2 = document.getElementById(`${p}-sub2`);
        const barrierCont = document.getElementById(`${p}-barrier-container`);

        const updateSubs = () => {
            const val = main.value;
            let options = [];
            if (val === 'even/odd') options = evenOddChoices;
            else if (val === 'over/under') options = overUnderChoices;
            else if (val === 'matches/differs') options = matchesDiffersChoices;
            else if (val === 'rise/fall') options = riseFallChoices;

            sub1.innerHTML = options.map(o => `<option value="${o.toLowerCase()}">${o}</option>`).join('');
            sub2.innerHTML = options.map((o, i) => `<option value="${o.toLowerCase()}" ${i === 1 ? 'selected' : ''}>${o}</option>`).join('');

            if (val === 'over/under' || val === 'matches/differs') {
                barrierCont.style.display = 'block';
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

    startTickStream();
});

function toggleSR() {
    if (running) {
        stopSR("System manual stop");
    } else {
        runSR();
    }
}

function runSR() {
    const token = getAuthToken();
    if (!token) {
        alert("Authorization required. Please login.");
        return;
    }
    running = true;
    tradesCompleted = 0;
    tradeLock = false;
    isRecoveryMode = false;
    baseStake = Number(document.getElementById('sr-stake').value);

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
    document.getElementById("sr-results").textContent = msg || "Ready for scan";
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

                tickHistory.push(digit);
                if (tickHistory.length > HISTORY_LIMIT) tickHistory.shift();

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

    const targetTrades = Number(document.getElementById('sr-count').value);
    if (tradesCompleted >= targetTrades) {
        stopSR("Goal Achieved ✅");
        return;
    }

    const executeAll = document.getElementById('sr-execute-all').checked;
    const prefixSet = isRecoveryMode ? ['rs1', 'rs2', 'rs3', 'rs4'] : ['ps1', 'ps2', 'ps3', 'ps4'];

    const activeStrategies = prefixSet.filter(p => document.getElementById(`${p}-active`).checked);
    if (activeStrategies.length === 0) return;

    const lastDigit = Number(String(quote).slice(-1));
    const direction = tick.quote > (tickHistory[tickHistory.length - 2] || 0) ? 'rise' : 'fall';

    let triggeredActions = [];

    activeStrategies.forEach(p => {
        const type = document.getElementById(`${p}-main`).value;
        const s1 = document.getElementById(`${p}-sub1`).value;
        const barrier = document.getElementById(`${p}-barrier`).value;

        let triggered = false;
        let tradeType = '';
        let prediction = Number(barrier);

        if (type === 'even/odd') {
            // Check trigger: we'll use a simple "any tick" trigger for even/odd if s1 is chosen
            // Or we could wait for a pattern. Let's trigger based on s1 choice.
            triggered = true;
            tradeType = s1 === 'even' ? 'DIGITEVEN' : 'DIGITODD';
        } else if (type === 'over/under') {
            triggered = true;
            tradeType = s1 === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
        } else if (type === 'matches/differs') {
            triggered = true;
            tradeType = s1 === 'matches' ? 'DIGITMATCH' : 'DIGITDIFF';
        } else if (type === 'rise/fall') {
            triggered = true;
            tradeType = s1 === 'rise' ? 'CALL' : 'PUT';
        }

        if (triggered) {
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

        // Wait 2 ticks between trades to allow for settlement and avoid overlap if not simultaneous
        if (!executeAll) {
            setTimeout(() => { tradeLock = false; }, 2000);
        } else {
            tradeLock = false;
        }
    }
}

async function executeTrade(symbol, type, barrier, quote) {
    const stake = document.getElementById('sr-stake').value;
    const resultsBox = document.getElementById("sr-results");
    resultsBox.textContent = `🎯 Executing ${type} @ ${stake}...`;

    const resp = await buyContract(symbol, type, 1, stake, barrier, quote, true);
    if (resp?.buy) {
        showLivePopup(resp.buy.contract_id, { tradeType: type, stake, payout: resp.buy.payout });
        handleSettlement(resp.buy.contract_id);
    } else if (resp?.error) {
        resultsBox.innerHTML = `<span style="color:red">Error: ${resp.error.message}</span>`;
    }
    return resp;
}

async function handleSettlement(contractId) {
    const { waitForSettlement } = await import("./buyContract.mjs");
    const result = await waitForSettlement(contractId);
    if (result) {
        const resultsBox = document.getElementById("sr-results");
        if (result.status === 'won') {
            resultsBox.innerHTML = `✅ Last Trade WON! Continuing scan...`;
            isRecoveryMode = false;
            document.getElementById('sr-stake').value = baseStake;
        } else {
            resultsBox.innerHTML = `❌ Last Trade LOST. Entering Recovery...`;
            isRecoveryMode = true;
            if (document.getElementById('sr-martingale').checked) {
                const mult = Number(document.getElementById('sr-martingale-multiplier').value) || 2.1;
                document.getElementById('sr-stake').value = (Number(document.getElementById('sr-stake').value) * mult).toFixed(2);
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
    tickHistory.forEach(d => counts[d]++);
    counts.forEach((c, i) => {
        const pct = counts.reduce((a, b) => a + b, 0) > 0 ? ((c / tickHistory.length) * 100).toFixed(1) : 0;
        statsBox.insertAdjacentHTML('beforeend', `
            <div style="border: 1px solid #eee; padding: 4px; text-align: center; border-radius: 4px; background: white; min-width: 30px;">
                <div style="font-weight: bold; font-size: 0.8rem;">${i}</div>
                <div style="font-size: 0.6rem; color: #888;">${pct}%</div>
            </div>
        `);
    });

    const lastTick = tickHistory[tickHistory.length - 1];
    gridBox.textContent = lastTick !== undefined ? lastTick : '';
}
