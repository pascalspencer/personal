import { buyContract } from "./buyContract.mjs";
import { getCurrentToken } from "./popupMessages.mjs";

let running = false;
let ticksSeen = 0;
let tradeLock = false;
let tickWs = null;

let overDigit, underDigit, tickCount, stakeInput;
let singleToggle, bulkToggle, resultsBox;

/* --------------------------------------------------
   DOM READY + UI
-------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
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

  const syncToggles = () => {
    bulkToggle.disabled = singleToggle.checked;
    singleToggle.disabled = bulkToggle.checked;
    if (singleToggle.checked) bulkToggle.checked = false;
    if (bulkToggle.checked) singleToggle.checked = false;
  };
  singleToggle.onchange = bulkToggle.onchange = syncToggles;
  syncToggles();

  document.getElementById("run-smart").onclick = runSmart;
  document.getElementById("stop-smart").onclick = stopSmart;
});

/* --------------------------------------------------
   POPUP
-------------------------------------------------- */
function popup(title, html, timeout = 3000) {
  const overlay = document.createElement("div");
  overlay.className = "trade-popup-overlay";

  const box = document.createElement("div");
  box.className = "trade-popup";

  box.innerHTML = `<h3>${title}</h3>${html ? `<p>${html}</p>` : ""}`;

  const close = document.createElement("a");
  close.textContent = "Close";
  close.className = "close-btn";
  close.onclick = e => { e.preventDefault(); overlay.remove(); };

  box.appendChild(close);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  if (timeout) setTimeout(() => overlay.remove(), timeout);
}

/* --------------------------------------------------
   RUNNER
-------------------------------------------------- */
async function runSmart() {
  if (running) return;
  running = true;
  tradeLock = false;
  ticksSeen = 0;

  popup("Checking Entry...");

  const symbol = document.getElementById("submarket")?.value || "R_100";

  if (bulkToggle.checked) {
    await runBulkOnce(symbol);
    running = false;
    return;
  }

  await runSingleSequential(symbol);
  running = false;
}

/* --------------------------------------------------
   TICK LOGIC
-------------------------------------------------- */
async function runSingleSequential(symbol) {
  return new Promise(resolve => {
    tickWs = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");

    tickWs.onopen = () =>
      tickWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));

    tickWs.onmessage = async e => {
      if (!running || tradeLock) return;

      const tick = JSON.parse(e.data)?.tick;
      if (!tick) return;

      const digit = Number(String(tick.quote).slice(-1));

      if (digit < Number(overDigit.value)) {
        tradeLock = true;
        await executeTrade(symbol, "DIGITOVER", overDigit.value, tick.quote);
        tradeLock = false;
        ticksSeen++;
      } else if (digit > Number(underDigit.value)) {
        tradeLock = true;
        await executeTrade(symbol, "DIGITUNDER", underDigit.value, tick.quote);
        tradeLock = false;
        ticksSeen++;
      }

      if (ticksSeen >= Number(tickCount.value)) {
        tickWs.close();
        resolve();
      }
    };

    tickWs.onerror = () => resolve();
  });
}

/* --------------------------------------------------
   PROFIT TABLE FETCH
-------------------------------------------------- */
async function fetchProfitTable(limit = 10) {
  return new Promise(resolve => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=61696");

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: getCurrentToken() }));
      ws.send(JSON.stringify({ profit_table: 1, limit, sort: "DESC" }));
    };

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.profit_table) {
        ws.close();
        resolve(msg.profit_table.transactions || []);
      }
    };

    ws.onerror = () => resolve([]);
  });
}

/* --------------------------------------------------
   EXECUTE TRADE (FINAL AUTHORITY)
-------------------------------------------------- */
async function executeTrade(symbol, type, barrier, quote) {
  const resp = await buyContract(
    symbol,
    type,
    1,
    stakeInput.value,
    barrier,
    quote,
    true
  );

  if (resp?.error) {
    popup("Trade failed", resp.error.message, 6000);
    return;
  }

  const buyTxId =
    resp?.buy?.transaction_id ||
    resp?.transaction_id ||
    resp?.buy?.id;

  await new Promise(r => setTimeout(r, 1200));

  const rows = await fetchProfitTable(10);
  const row = rows.find(r => String(r.transaction_ids?.buy) === String(buyTxId));

  if (!row) {
    popup("Trade Result", "Trade placed, awaiting settlement...", 5000);
    return;
  }

  const profit = Number(row.profit);
  const html = `
    Type: ${type}
    <br>Stake: $${Number(stakeInput.value).toFixed(2)}
    <br>Buy price: $${Number(row.buy_price).toFixed(2)}
    <br>Sell price: $${Number(row.sell_price).toFixed(2)}
    <br>Result: <span class="${profit >= 0 ? "profit" : "loss"}">
      ${profit >= 0 ? "+" : "-"} $${Math.abs(profit).toFixed(2)}
    </span>
    <br>Account balance: $${Number(row.balance_after).toFixed(2)}
  `;

  popup("Trade Result", html, 8000);
}

/* --------------------------------------------------
   STOP
-------------------------------------------------- */
function stopSmart() {
  running = false;
  tradeLock = false;
  if (tickWs) tickWs.close();
  popup("Stopped");
}
