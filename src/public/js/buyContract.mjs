import { getCurrentToken } from './popupMessages.mjs';

// Note: DerivAPIBasic removed — sending raw JSON over WebSocket and handling responses by req_id.
const derivAppID = 61696;
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);

let api = null; // kept for compatibility checks in other codepaths
const resultsContainer = document.getElementById("results-container");

// request bookkeeping
let reqCounter = 1;
const pending = new Map();        // req_id -> resolve(response)
const subscriptions = new Map();  // req_id -> { resolve, timeout }
// default currency (fall back to USD)
let defaultCurrency = 'USD';

function parseCurrencyFromAuth(resp) {
  try {
    if (!resp) return null;
    if (resp.authorize && resp.authorize.currency) return resp.authorize.currency;
    if (resp.authorize && Array.isArray(resp.authorize.account_list) && resp.authorize.account_list.length) {
      const a = resp.authorize.account_list[0];
      if (a && a.currency) return a.currency;
    }
  } catch (e) {}
  return null;
}

// --- WebSocket lifecycle ---
connection.onopen = function () {
  api = connection; // mark as available for simple checks elsewhere
  startPing();
  console.log("WebSocket connection is fantastic.");

  document.addEventListener("DOMContentLoaded", async () => {
    const token = getCurrentToken();
    if (!token) {
      console.warn("No token found at authorization.");
      return;
    }

    console.log("Authorizing with token (masked):", String(token).slice(0, 8));
    try {
      const resp = await sendJson({ authorize: token });
      console.log("Authorize response:", resp);
      const cur = parseCurrencyFromAuth(resp);
      if (cur) {
        defaultCurrency = cur;
        console.log('Using currency from authorize:', defaultCurrency);
      }
    } catch (err) {
      console.error("Authorization failed:", err);
    }
  });
};

connection.onerror = (err) => {
  console.error("WebSocket error:", err);
};

connection.onmessage = (evt) => {
  let msg;
  try { msg = JSON.parse(evt.data); } catch (e) { return; }

  const echo = msg.echo_req || {};
  const id = echo.req_id;

  // If this response belongs to a subscription and contains tick -> route to subscription
  if (id && subscriptions.has(id)) {
    const sub = subscriptions.get(id);
    // handle tick responses streaming from a subscribe call
    if (msg.tick) {
      // resolve subscription promise with first quote (then send forget)
      try { connection.send(JSON.stringify({ forget: msg.tick.id })); } catch (e) {}
      clearTimeout(sub.timeout);
      sub.resolve(msg);
      subscriptions.delete(id);
      return;
    }
    // if error on subscription
    if (msg.error) {
      clearTimeout(sub.timeout);
      sub.reject(msg);
      subscriptions.delete(id);
      return;
    }
  }

  // Normal single-response routing
  if (id && pending.has(id)) {
    const resolver = pending.get(id);
    pending.delete(id);
    resolver(msg);
    return;
  }

  // Untracked messages (e.g., general updates) — log at debug level
  // console.debug("Unmatched message:", msg);
};

// --- Ping keep-alive ---
let pingInterval = null;
function startPing() {
  if (!connection || pingInterval) return;
  pingInterval = setInterval(() => {
    try { connection.send(JSON.stringify({ ping: 1 })); } catch (e) {}
  }, 30000);
}

// --- low-level send + await single response ---
function sendJson(payload, timeoutMs = 8000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const req_id = reqCounter++;
  payload.req_id = req_id;

  return new Promise((resolve, reject) => {
    pending.set(req_id, (resp) => {
      // Don't reject on API errors; resolve with the response so caller can handle it
      return resolve(resp);
    });

    try {
      connection.send(JSON.stringify(payload));
    } catch (err) {
      pending.delete(req_id);
      return reject(err);
    }

    const to = setTimeout(() => {
      if (pending.has(req_id)) {
        pending.delete(req_id);
        reject(new Error("Request timeout"));
      }
    }, timeoutMs);
    // wrap resolver to clear timeout
    const original = pending.get(req_id);
    pending.set(req_id, (resp) => { clearTimeout(to); original(resp); });
  });
}

// --- subscribe helper: resolves on first matching streaming message (e.g., ticks) ---
function subscribeOnce(payload, timeoutMs = 8000) {
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const req_id = reqCounter++;
  payload.req_id = req_id;
  payload.subscribe = 1; // ensure subscribe semantics for streaming endpoints

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (subscriptions.has(req_id)) {
        subscriptions.delete(req_id);
        // attempt to forget subscription on timeout
        try { connection.send(JSON.stringify({ forget: req_id })); } catch (e) {}
        reject(new Error("Subscription timeout"));
      }
    }, timeoutMs);

    subscriptions.set(req_id, { resolve, reject, timeout });

    try {
      connection.send(JSON.stringify(payload));
    } catch (err) {
      clearTimeout(timeout);
      subscriptions.delete(req_id);
      return reject(err);
    }
  });
}


// --- Automation Mode Control ---
let isAutomationEnabled = false;
let automationInterval = null;

export function setAutomationMode(enabled) {
  isAutomationEnabled = enabled;
  console.log("Automation mode:", enabled ? "ON" : "OFF");
}

export function getAutomationMode() {
  return isAutomationEnabled;
}

// --- Fetch live trading instruments from backend ---
let tradingInstruments = null;

async function fetchLiveInstruments() {
  if (tradingInstruments) return tradingInstruments;

  try {
    const response = await fetch("/api/data"); // backend fetch from Deriv API
    tradingInstruments = await response.json();
    return tradingInstruments;
  } catch (err) {
    console.error("Error fetching live trading instruments:", err);
    return {};
  }
}

// --- Safe Evaluate & Buy ---
async function evaluateAndBuyContractSafe() {
  console.log("Automation tick…");

  const market = document.getElementById("market")?.value;
  const submarket = document.getElementById("submarket")?.value;
  const sentimentDropdown = document.getElementById("sentiment");
  const selectedSentiment = sentimentDropdown?.value;
  const tradeDigit = document.getElementById("input-value")?.value;

  if (!market) return console.warn("⛔ Market not selected");
  if (!submarket) return console.warn("⛔ Submarket not selected");
  if (!selectedSentiment) return console.warn("⛔ Sentiment not selected");


  const instruments = await fetchLiveInstruments();
  console.log("Fetched instruments:", instruments);

  const percentages = calculatePercentages();
  console.log("Percentages:", percentages);

  if (percentages.length < 2) {
    return console.warn("⛔ Not enough sentiment data");
  }

  const maxPercentage = Math.max(...percentages);
  const maxIndex = percentages.indexOf(maxPercentage);

  if (maxPercentage < 40) {
    console.warn("⛔ No strong sentiment (>=40%)");
    
    // Show popup for weak sentiment
    try {
      const overlay = document.createElement('div');
      overlay.className = 'trade-popup-overlay';

      const popup = document.createElement('div');
      popup.className = 'trade-popup';

      const title = document.createElement('h3');
      title.textContent = 'Insufficient Sentiment';
      popup.appendChild(title);

      const msgP = document.createElement('p');
      msgP.textContent = `No strong sentiment detected. Maximum sentiment is ${maxPercentage}%, but at least 40% is required to execute a trade.`;
      popup.appendChild(msgP);

      const closeBtn = document.createElement('a');
      closeBtn.className = 'close-btn';
      closeBtn.href = '#';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); overlay.remove(); });
      popup.appendChild(closeBtn);

      overlay.appendChild(popup);
      try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show sentiment popup:', e); }
      
      // Auto-dismiss after 6 seconds
      setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 6000);
    } catch (e) {
      console.warn('Failed to build sentiment popup:', e);
    }
    
    return;
  }

  console.log(`Winning sentiment index = ${maxIndex}`);

  const tradeType = await getTradeTypeForSentiment(selectedSentiment, maxIndex, submarket);
  console.log("Trade type:", tradeType);

  if (!tradeType) {
    return console.error("⛔ Could not map sentiment → trade type");
  }

  const price = parseFloat(document.getElementById("price")?.value || 1);

  console.log(`🔥 Automated mode active — executing trade
  Symbol: ${submarket}
  Type: ${tradeType}
  Price: ${price}
  Digit: ${tradeDigit}`);

  await buyContract(submarket, tradeType, 1, price, tradeDigit);
}

async function getTradeTypeForSentiment(sentiment, index) {
  const parts = (sentiment || "").split("/");
  if (!parts[index]) return null;

  const selected = parts[index].trim().toLowerCase();
  if (!selected) return null;

  // Minimal, reliable mapping
  const map = {
    "rise": "CALL",
    "fall": "PUT",
    "matches": "DIGITMATCH",
    "differs": "DIGITDIFF",
    "even": "DIGITEVEN",
    "odd": "DIGITODD",
    "over": "DIGITOVER",
    "under": "DIGITUNDER",
  };

  for (const key in map) {
    if (selected.includes(key)) return map[key];
  }

  console.warn("No mapping for:", selected);
  return null;
}

// --- Wait for first live tick ---
async function waitForFirstTick(symbol) {
  // subscribeOnce resolves with the raw message; extract quote
  try {
    const msg = await subscribeOnce({ ticks: symbol });
    if (msg && msg.tick && msg.tick.quote !== undefined) {
      console.log("📈 First tick received:", msg.tick.quote);
      return msg.tick.quote;
    }
    throw new Error("Invalid tick message");
  } catch (err) {
    throw err;
  }
}


// Unified buyContract that follows contracts_for precisely
async function buyContract(symbol, tradeType, duration, price, prediction = null) {
    if (!connection || connection.readyState !== WebSocket.OPEN) {
        console.error("❌ WebSocket not connected.");
        return;
    }

    // Ensure authorized (basic check: presence of cached userToken or session-based token)
    const token = getCurrentToken();
    if (!token) {
      console.warn("No token available; attempt will likely fail.");
    } else {
      // ensure authorization on server-side was done via /redirect; re-authorize if necessary
      try {
        const authResp = await sendJson({ authorize: token });
        if (authResp.error) {
          console.warn("Authorization failed:", authResp.error);
          // continue or abort depending on your preference; here we continue and let proposal fail if unauthorized
        } else {
          console.log("Authorized before proposal (masked token).");
          const cur2 = parseCurrencyFromAuth(authResp);
          if (cur2) {
            defaultCurrency = cur2;
            console.log('Using currency from authorize before proposal:', defaultCurrency);
          }
        }
      } catch (err) {
        console.warn("Authorize request error:", err);
      }
    }

    console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
    console.log("⏳ Subscribing to live ticks before requesting proposal…");

    // 1) Get live tick
    let livePrice;
    try {
        livePrice = await waitForFirstTick(symbol);
    } catch (err) {
        console.error("❌ Could not get live tick:", err);
        return;
    }

    console.log("🔥 Using live tick:", livePrice);

    // 2) Build PROPOSAL object
    const proposal = {
      proposal: 1,
      amount: price,
      basis: "stake",
      contract_type: tradeType,
      currency: defaultCurrency || "USD",
      symbol: symbol,
      duration: duration,
      duration_unit: "t",
    };

    // Digit-specific
    if (tradeType.startsWith("DIGIT")) {
        if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
            proposal.barrier = String(prediction ?? 0);
        }
    }

    // 3) SEND PROPOSAL
    let proposalResp;
    try {
        proposalResp = await sendJson(proposal);
        console.log("Proposal response:", proposalResp);
    } catch (err) {
        console.error("❌ Proposal request failed:", err);
        return;
    }

    if (proposalResp.error) {
        console.error("❌ Proposal error:", proposalResp.error);
        return;
    }

    // Extract correct proposal info
    const prop = proposalResp.proposal;
    if (!prop || !prop.id) {
      console.error("❌ Proposal missing id:", proposalResp);
      return;
    }
    const propId = prop.id;
    const askPrice = prop.ask_price ?? prop.ask_price; // use ask_price if present

    console.log("🆔 Proposal ID:", propId);
    console.log("💵 Ask Price:", askPrice);

    // 4) BUY CONTRACT
    // Capture starting balance immediately before attempting the buy so we
    // can determine whether the account decreased after the purchase.
    let startingBalance = null;
    try {
        const balBefore = await sendJson({ balance: 1 });
        if (balBefore) {
          const candidates = [balBefore.balance, balBefore.balance_after, balBefore.account_balance, balBefore.balance_before];
          for (const c of candidates) {
            if (typeof c === 'number') { startingBalance = c; break; }
            if (typeof c === 'string' && !Number.isNaN(Number(c))) { startingBalance = Number(c); break; }
          }
        }
    } catch (e) {
      // ignore balance read errors
    }

    let buyResp;
    try {
        buyResp = await sendJson({ buy: propId, price: askPrice });
        console.log("Buy response:", buyResp);
    } catch (err) {
        console.error("❌ Buy call failed:", err);
        // Show error popup for WebSocket/connection errors
        try {
          const overlay = document.createElement('div');
          overlay.className = 'trade-popup-overlay';
          const popup = document.createElement('div');
          popup.className = 'trade-popup';
          const title = document.createElement('h3');
          title.textContent = 'Buy Failed';
          popup.appendChild(title);
          const msgP = document.createElement('p');
          msgP.textContent = err.message || 'Failed to execute buy request.';
          popup.appendChild(msgP);
          const closeBtn = document.createElement('a');
          closeBtn.className = 'close-btn';
          closeBtn.href = '#';
          closeBtn.textContent = 'Close';
          closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); overlay.remove(); });
          popup.appendChild(closeBtn);
          overlay.appendChild(popup);
          try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show error popup:', e); }
          setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 10000);
        } catch (e) {
          console.warn('Failed to build error popup:', e);
        }
        return;
    }

    if (buyResp.error) {
        console.error("❌ Buy error:", buyResp.error);

        // Show a user-friendly popup describing the error (e.g., insufficient balance)
        try {
          const err = buyResp.error;
          const overlay = document.createElement('div');
          overlay.className = 'trade-popup-overlay';

          const popup = document.createElement('div');
          popup.className = 'trade-popup';

          const title = document.createElement('h3');
          title.textContent = 'Trade Failed';
          popup.appendChild(title);

          const msgP = document.createElement('p');
          msgP.textContent = err.message || 'Unable to complete buy request.';
          popup.appendChild(msgP);

          // Try to extract suggested stake / price from echo_req or response
          const echo = buyResp.echo_req || {};
          const echoBuy = echo.buy || echo;
          const reqPrice = echoBuy.price ?? echo.price ?? null;
          if (reqPrice !== null && reqPrice !== undefined) {
            const reqP = document.createElement('p');
            reqP.innerHTML = `Required stake: <span class="amount">$${Number(reqPrice).toFixed(2)}</span>`;
            popup.appendChild(reqP);
          }

          // Attempt to parse current balance from error message or response
          let parsedBalance = null;
          // check common fields
          const candidateFields = [buyResp.balance, buyResp.buy?.balance, buyResp.account_balance, buyResp.buy?.account_balance];
          for (const c of candidateFields) {
            if (typeof c === 'number') { parsedBalance = c; break; }
            if (typeof c === 'string' && !Number.isNaN(Number(c))) { parsedBalance = Number(c); break; }
          }
          // parse from message like "Your account balance (0.00 USD) is insufficient"
          if (parsedBalance === null && typeof err.message === 'string') {
            const m = err.message.match(/\((\d+(?:\.\d+)?)\s*USD\)/i) || err.message.match(/balance\s*(\d+(?:\.\d+)?)/i);
            if (m && m[1]) parsedBalance = Number(m[1]);
          }
          if (parsedBalance !== null) {
            const balP = document.createElement('p');
            balP.innerHTML = `Account balance: <span class="amount">$${Number(parsedBalance).toFixed(2)}</span>`;
            popup.appendChild(balP);
          }

          // If error code indicates insufficient balance, add highlighted note
          if (err.code === 'InsufficientBalance' || /insufficient/i.test(err.message || '')) {
            const low = document.createElement('p');
            low.className = 'low-balance';
            low.textContent = `Insufficient balance to buy this contract. Please top up your account.`;
            popup.appendChild(low);
          }

          const closeBtn = document.createElement('a');
          closeBtn.className = 'close-btn';
          closeBtn.href = '#';
          closeBtn.textContent = 'Close';
          closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); overlay.remove(); });
          popup.appendChild(closeBtn);

          overlay.appendChild(popup);
          try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show error popup:', e); }
          // Auto-dismiss after 10 seconds
          setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 10000);
        } catch (e) {
          console.warn('Failed to build error popup:', e);
        }

        return buyResp;
    }

    console.log("🎉 Contract bought successfully:", buyResp);

    // Robust balance parsing helpers
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

    // Determine ending balance (try response fields first, then fallback to balance request)
    let endingBalance = firstNumeric([
      buyResp.buy?.balance_after,
      buyResp.buy?.balance,
      buyResp.balance_after,
      buyResp.balance,
      buyResp.account_balance,
      buyResp.buy?.account_balance,
    ]);
    if (endingBalance === null) {
      try {
        const balAfter = await sendJson({ balance: 1 });
        if (balAfter) endingBalance = firstNumeric([balAfter.balance, balAfter.account_balance]);
      } catch (e) {
        // ignore
      }
    }

    // If startingBalance wasn't captured before buy, try to extract it from the buy response
    if (startingBalance === null) {
      startingBalance = firstNumeric([
        buyResp.buy?.balance_before,
        buyResp.buy?.balance,
        buyResp.balance_before,
        buyResp.balance,
        buyResp.account_balance,
        buyResp.buy?.account_balance,
      ]);
    }

    // If we have both balances and the ending balance decreased by at least a tiny epsilon, treat as a loss
    const isBalanceLoss = (startingBalance !== null && endingBalance !== null && endingBalance + 1e-9 < startingBalance);

    // --- Show popup with profit / loss and low-balance info ---
    try {
      const buyInfo = buyResp.buy || buyResp || {};
      // stake is the amount the user attempted to place
      const stakeAmount = Number(price) || 0;

      // buy price (amount charged) — prefer explicit fields, fall back to askPrice
      const buyPrice = Number(
        buyInfo.buy_price ?? buyInfo.price ?? buyInfo.buy_price ?? askPrice ?? 0
      ) || 0;

      // payout — total return if contract wins (usually includes stake)
      const payout = Number(buyInfo.payout ?? buyInfo.payout_amount ?? buyInfo.payoutValue ?? 0) || 0;

      // Try to determine account balance from response fields if present (current balance candidate)
      let balanceCandidate = firstNumeric([
        buyResp.buy?.balance,
        buyResp.balance,
        buyResp.account_balance,
        buyResp.buy?.account_balance,
      ]);

      // As a best-effort, attempt to request balance from server (optional and non-blocking)
      if (balanceCandidate === null) {
        try {
          const balResp = await sendJson({ balance: 1 });
          if (balResp) balanceCandidate = firstNumeric([balResp.balance, balResp.account_balance]);
        } catch (e) {
          // ignore if balance request not supported
        }
      }

      let profit = 0;
      let loss = 0;
      if (startingBalance !== null && endingBalance !== null) {
        const delta = +(endingBalance - startingBalance);
        if (delta > 0) profit = +delta.toFixed(2);
        else if (delta < 0) loss = +Math.abs(delta).toFixed(2);
      } else if (balanceCandidate !== null && endingBalance !== null) {
        const delta = +(endingBalance - balanceCandidate);
        if (delta > 0) profit = +delta.toFixed(2);
        else if (delta < 0) loss = +Math.abs(delta).toFixed(2);
      } else if (!Number.isNaN(payout)) {
        const p = +(payout - stakeAmount);
        if (p > 0) profit = +p.toFixed(2);
        else if (p < 0) loss = +Math.abs(p).toFixed(2);
      }

      let lossToDisplay = null;
      const referenceBalance = (startingBalance !== null) ? startingBalance : balanceCandidate;
      if (referenceBalance !== null && endingBalance !== null && endingBalance + 1e-9 < referenceBalance) {
        lossToDisplay = +(referenceBalance - endingBalance).toFixed(2);
        if (typeof stakeAmount === 'number' && !Number.isNaN(stakeAmount)) {
          loss = Number(stakeAmount);
        } else {
          loss = lossToDisplay;
        }
      }

      // Build popup content
      const overlay = document.createElement('div');
      overlay.className = 'trade-popup-overlay';

      const popup = document.createElement('div');
      popup.className = 'trade-popup';

      const title = document.createElement('h3');
      title.textContent = 'Trade Result';
      popup.appendChild(title);

      const stakeP = document.createElement('p');
      stakeP.innerHTML = `Stake: <span class="amount">$${Number(price).toFixed(2)}</span>`;
      popup.appendChild(stakeP);

      const buyP = document.createElement('p');
      buyP.innerHTML = `Buy price: <span class="amount">$${Number(buyPrice).toFixed(2)}</span>`;
      popup.appendChild(buyP);

      const payoutP = document.createElement('p');
      payoutP.innerHTML = `Payout: <span class="amount">$${Number(payout).toFixed(2)}</span>`;
      popup.appendChild(payoutP);

      const profitP = document.createElement('p');
      if (profit > 0) {
        profitP.innerHTML = `Result: <span class="profit">+ $${profit.toFixed(2)}</span>`;
      } else if (loss > 0) {
        // Prefer the explicit lossToDisplay if available, otherwise use the
        // computed loss (both are positive numbers). Fallback to stakeAmount.
        const displayLoss = (typeof lossToDisplay === 'number' && lossToDisplay > 0) ? lossToDisplay : (loss > 0 ? loss : Number(stakeAmount));
        profitP.innerHTML = `Result: <span class="loss">- $${Number(displayLoss).toFixed(2)}</span>`;
      } else {
        profitP.innerHTML = `Result: <span class="amount">$0.00</span>`;
      }
      popup.appendChild(profitP);

      if (balanceCandidate !== null) {
        const balP = document.createElement('p');
        balP.innerHTML = `Account balance: <span class="amount">$${Number(balanceCandidate).toFixed(2)}</span>`;
        popup.appendChild(balP);

        if (Number(balanceCandidate) < Number(price)) {
          const low = document.createElement('p');
          low.className = 'low-balance';
          low.textContent = `Low balance compared with stake ($${Number(price).toFixed(2)}). Please top up.`;
          popup.appendChild(low);
        }
      }

      const closeBtn = document.createElement('a');
      closeBtn.className = 'close-btn';
      closeBtn.href = '#';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); overlay.remove(); });
      popup.appendChild(closeBtn);

      overlay.appendChild(popup);
      try { document.body.appendChild(overlay); } catch (e) { console.warn('Could not show popup:', e); }

      // Auto-dismiss after 8 seconds
      setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 8000);
    } catch (err) {
      console.warn('Could not build trade popup:', err);
    }

    return buyResp;
}


// --- Helper to calculate sentiment percentages ---
function calculatePercentages() {
  const percentages = [];
  const divs = resultsContainer?.getElementsByTagName("div") || [];
  for (let i = 0; i < 2 && i < divs.length; i++) {
    const match = divs[i].textContent?.match(/\((\d+)%\)/);
    if (match) percentages.push(parseInt(match[1], 10));
  }
  return percentages;
}

// --- Export for automation ---
export { evaluateAndBuyContractSafe };
