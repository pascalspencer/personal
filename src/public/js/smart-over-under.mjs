import { buyContract } from "./buyContract.mjs";

let running = false;
let ticksSeen = 0;
let tradeLock = false;

let overDigit, underDigit, tickCount, stakeInput;
let singleToggle, bulkToggle, resultsBox;

document.addEventListener("DOMContentLoaded", () => {
  // UI Injection
  document.body.insertAdjacentHTML("beforeend", `
    <div id="smart-over-under" style="display:none">
      <h2>Smart Over / Under</h2>

      <label>Over:</label>
      <select id="over-digit"></select>

      <label>Under:</label>
      <select id="under-digit"></select>

      <label>Number of ticks:</label>
      <input type="number" id="tick-count" min="1" value="5">

      <label>Stake (minimum 0.35):</label>
      <input type="number" id="stake" min="0.35" step="0.01" value="0.35">

      <div class="toggle-container">
        <span>Single</span>
        <input type="checkbox" id="single-toggle" checked>
        <span>Bulk</span>
        <input type="checkbox" id="bulk-toggle">
      </div>

      <div class="smart-buttons">
        <button id="run-smart">RUN</button>
        <button id="stop-smart">STOP</button>
      </div>

      <div id="smart-results"></div>
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

  document.getElementById("run-smart").onclick = runSmart;
  document.getElementById("stop-smart").onclick = stopSmart;
});

function popup(msg) {
  const overlay = document.createElement("div");
  overlay.className = "trade-popup-overlay";
  overlay.innerHTML = `
    <div class="trade-popup">
      <h3>${msg}</h3>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2000);
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
    for (let i = 0; i < tickCount.value; i++) {
      await executeTrade(symbol);
    }
    popup("Trade successful");
    running = false;
    return;
  }

  while (running && ticksSeen < tickCount.value) {
    await checkTick(symbol);
    ticksSeen++;
  }

  running = false;
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
    tradeLock = true;
    await executeTrade(symbol, "DIGITOVER", overDigit.value);
  }

  if (digit > Number(underDigit.value)) {
    tradeLock = true;
    await executeTrade(symbol, "DIGITUNDER", underDigit.value);
  }

  tradeLock = false;
}

async function executeTrade(symbol, type = "DIGITOVER", barrier = 0) {
  const resp = await buyContract(
    symbol,
    type,
    1,
    stakeInput.value,
    barrier
  );

  if (resp?.error) {
    resultsBox.innerHTML += `<div class="loss">Trade failed</div>`;
  } else {
    resultsBox.innerHTML += `<div class="profit">Trade opened</div>`;
    popup("Trade successful");
  }
}

function stopSmart() {
  running = false;
  tradeLock = false;
  popup("Stopped");
}
