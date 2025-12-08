/**
 * Deriv WebSocket Trading Client
 * - Authorize with provided token
 * - Fetch balance, active symbols, ticks, history
 * - Request proposals and place buys
 *
 * Usage:
 *  - In Node.js: npm install ws
 *  - Then: node thisfile.js
 *
 * NOTE: Replace APP_ID if you have a custom app_id. Default uses Binary.com's public v3 endpoint.
 */

const DEFAULT_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=61696'; // public v3 endpoint (change app_id if needed)

class DerivClient {
  constructor({ token, wsUrl = DEFAULT_WS_URL, reconnect = true, reconnectInterval = 3000 }) {
    if (!token) throw new Error('API token required');
    this.token = token;
    this.wsUrl = wsUrl;
    this.ws = null;
    this.requestId = 1;
    this.pending = new Map(); // requestId -> {resolve, reject, timeout}
    this.subscriptions = new Map(); // subscribe-type -> handler
    this.reconnect = reconnect;
    this.reconnectInterval = reconnectInterval;
    this.connected = false;
    this.pingIntervalId = null;
    this.watchdogInterval = null;
    this.lastMessageTs = Date.now();
  }

  _nextId() {
    return String(this.requestId++);
  }

  _sendRaw(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const s = JSON.stringify(obj);
    this.ws.send(s);
    return s;
  }

  _request(payload, { timeout = 15000 } = {}) {
    const reqId = this._nextId();
    payload.req_id = reqId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pending.set(reqId, { resolve, reject, timer });
      try {
        this._sendRaw(payload);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(reqId);
        reject(err);
      }
    });
  }

  connect() {
    // Support both Node (global WebSocket may be undefined) and browsers.
    if (typeof WebSocket === 'undefined') {
      // Node.js: require('ws') dynamically (so this file still runs in browsers).
      // If running in Node, ensure you installed 'ws' with npm.
      global.WebSocket = require('ws'); // eslint-disable-line
    }

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[Deriv] WebSocket connected');
      this._authorize().catch(err => {
        console.error('[Deriv] Authorization error:', err);
        // keep connection open; user code can handle.
      });
      this._startKeepAlive();
    };

    this.ws.onmessage = (msgEvent) => {
      this.lastMessageTs = Date.now();
      let data;
      try {
        data = JSON.parse(msgEvent.data);
      } catch (e) {
        console.warn('[Deriv] Non-JSON message', msgEvent.data);
        return;
      }
      this._handleMessage(data);
    };

    this.ws.onerror = (err) => {
      console.error('[Deriv] WebSocket error', err && err.message ? err.message : err);
    };

    this.ws.onclose = (ev) => {
      this.connected = false;
      console.warn('[Deriv] WebSocket closed', ev && ev.code ? `code=${ev.code}` : ev);
      this._stopKeepAlive();
      // reject pending requests
      for (const [id, p] of this.pending.entries()) {
        clearTimeout(p.timer);
        p.reject(new Error('Connection closed'));
      }
      this.pending.clear();
      if (this.reconnect) {
        setTimeout(() => {
          console.log('[Deriv] Reconnecting...');
          this.connect();
        }, this.reconnectInterval);
      }
    };
  }

  disconnect() {
    this.reconnect = false;
    if (this.ws) this.ws.close();
    this._stopKeepAlive();
  }

  _startKeepAlive() {
    // Ping: Deriv expects keep-alive traffic. We'll send a "ping" style request every 20s by calling "balance" (cheap) as heartbeat
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = setInterval(() => {
      if (this.connected) {
        // lightweight request
        this.getBalance().catch(() => {});
      }
      // Watchdog: if no messages for 40s, force reconnect
      if (Date.now() - this.lastMessageTs > 40000) {
        console.warn('[Deriv] No messages for >40s — reconnecting');
        try {
          this.ws.terminate?.(); // if ws (node) supports terminate
          this.ws.close?.();
        } catch (e) {}
      }
    }, 20000);
  }

  _stopKeepAlive() {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = null;
  }

  async _authorize() {
    // Send authorize request. Many responses use "authorize": {...}
    try {
      const resp = await this._request({ authorize: this.token }, { timeout: 10000 });
      // The API replies with "authorize" or "error"
      if (resp.error) {
        throw new Error(resp.error?.message || JSON.stringify(resp.error));
      }
      console.log('[Deriv] Authorized', resp.authorize?.loginid ? `loginid=${resp.authorize.loginid}` : resp.authorize);
      return resp.authorize;
    } catch (err) {
      throw err;
    }
  }

  _handleMessage(data) {
    // route by req_id if present
    if (data.req_id && this.pending.has(String(data.req_id))) {
      const p = this.pending.get(String(data.req_id));
      clearTimeout(p.timer);
      this.pending.delete(String(data.req_id));
      if (data.error) {
        p.reject(new Error(data.error.message || JSON.stringify(data.error)));
      } else {
        p.resolve(data);
      }
      return;
    }

    // handle subscription messages and notifications
    // ticks -> contains 'tick', ticks -> 'ticks'
    if (data.tick || data.ticks || data.proposal || data.buy || data.history || data.active_symbols) {
      // emit to any user-provided subscription handlers
      // we use "subscription" field name or "echo_req" to identify
      const subKey = this._inferSubscriptionKey(data);
      if (subKey && this.subscriptions.has(subKey)) {
        const handler = this.subscriptions.get(subKey);
        try { handler(data); } catch (e) { console.error('[Deriv] subscription handler error', e); }
      }
    }

    // generic event logging for unhandled messages
    // console.debug('[Deriv] message', data);
  }

  _inferSubscriptionKey(data) {
    // common subscription responses include:
    // { "tick": {...}, "subscription": {...} } OR { "history": {...}, "echo_req": {...} }
    if (data.subscription && data.subscription.ticks) {
      return `ticks:${data.subscription.ticks}`;
    }
    if (data.tick && data.tick.symbol) {
      return `ticks:${data.tick.symbol}`;
    }
    if (data.echo_req && data.echo_req.ticks) {
      return `ticks:${data.echo_req.ticks}`;
    }
    if (data.proposal && data.echo_req && data.echo_req.proposal) {
      const s = data.echo_req.proposal;
      const symbol = s.symbol || 'proposal';
      return `proposal:${symbol}`;
    }
    if (data.buy && data.buy.contract_id) {
      return `buy:${data.buy.contract_id}`;
    }
    if (data.active_symbols) {
      return 'active_symbols';
    }
    if (data.history && data.echo_req && data.echo_req.ticks_history) {
      return `history:${data.echo_req.ticks_history}`;
    }
    return null;
  }

  // Public helpers
  async getBalance() {
    // Returns the balance payload (wraps the "balance" call)
    const resp = await this._request({ balance: 1 }).catch(err => { throw err; });
    // resp.balance contains string or number depending on API
    return resp.balance;
  }

  async getActiveSymbols(product = 'basic') {
    // product can be 'basic', 'forex', etc. Returns active_symbols
    const resp = await this._request({ active_symbols: 'brief', product }).catch(err => { throw err; });
    return resp.active_symbols;
  }

  async getContractTypesForSymbol(symbol) {
    // There isn't a single API call that returns contract types directly, but active_symbols contains info.
    // We'll filter active_symbols for the symbol and return the entry.
    const all = await this.getActiveSymbols();
    return all.filter(s => s.symbol === symbol);
  }

  subscribeTicks(symbol, handler) {
    // handler receives the raw message object for ticks
    const key = `ticks:${symbol}`;
    this.subscriptions.set(key, handler);
    // send subscribe request
    try {
      this._sendRaw({ ticks: symbol, subscribe: 1, req_id: this._nextId() });
    } catch (e) {
      console.error('[Deriv] subscribeTicks failed', e);
    }
    // return unsubscribe function
    return () => {
      this.subscriptions.delete(key);
      try { this._sendRaw({ forget: 'ticks', req_id: this._nextId(), ticks: symbol }); } catch (e) {}
    };
  }

  async getTicksHistory(symbol, { start = 0, end = 0, count = 1000, style = 'ticks' } = {}) {
    const payload = { ticks_history: symbol, count, style };
    if (start) payload.start = start;
    if (end) payload.end = end;
    const resp = await this._request(payload);
    return resp.history; // contains 'prices' or 'data' depending on style
  }

  // Request a proposal for a potential contract
  // opts example:
  // { symbol: 'R_100', amount: 1, basis: 'stake', contract_type: 'CALL', duration: 60, duration_unit: 's' }
  async requestProposal(opts) {
    const echo = { proposal: opts };
    // The API often expects the shape: { proposal: 1, amount: ..., symbol: ... } — some endpoints support echo_req
    // We'll send echo_req style (supported by v3).
    const payload = { proposal: 1, ...opts };
    const resp = await this._request(payload);
    // resp.proposal contains the quote with fields: id, price, display_value, etc.
    return resp.proposal;
  }

  // Buy contract using a proposal id (price) or passing final buy request
  // Typically: first get proposal, then call buy with that proposal.id and price.
  // opts: { proposal_id, price } OR you can pass full buy params similar to { buy: proposal_id }
  async buyContract({ proposal_id, price }) {
    if (!proposal_id) throw new Error('proposal_id required to buy');
    const payload = { buy: proposal_id, price };
    const resp = await this._request(payload);
    // resp.buy contains contract info on success
    return resp.buy;
  }

  // Convenience: request a proposal and immediately buy (with optional maxPrice limit)
  async proposeAndBuy(opts, { maxPrice = Infinity } = {}) {
    // opts same as requestProposal inputs (amount, symbol, etc.)
    const proposalResp = await this.requestProposal(opts);
    if (!proposalResp || typeof proposalResp.amount === 'undefined') {
      throw new Error('Invalid proposal response');
    }
    const price = Number(proposalResp.proposal?.price ?? proposalResp.amount ?? proposalResp.ask_price ?? proposalResp.display_value) || Number(proposalResp.amount);
    // If price is not acceptable, abort
    if (price > maxPrice) {
      throw new Error(`Price ${price} exceeds maxPrice ${maxPrice}`);
    }
    const buyResp = await this.buyContract({ proposal_id: proposalResp.proposal.id ?? proposalResp.id ?? proposalResp.contract_id, price });
    return buyResp;
  }

  // Generic custom request (for advanced calls)
  rawRequest(payload, { timeout } = {}) {
    return this._request(payload, { timeout });
  }
}

/* ---------------------------
   Example usage
   --------------------------- */
async function example() {
  const token = 'jEmsX96Vurwy6MN'; // your token
  const client = new DerivClient({ token });

  client.connect();

  // Wait a bit for connection/authorization to complete
  await new Promise((res) => setTimeout(res, 1200));

  try {
    const balance = await client.getBalance();
    console.log('Balance:', balance);

    const symbols = await client.getActiveSymbols('basic'); // or 'forex' depending on desired products
    console.log('Active symbols (sample):', symbols.slice(0, 8));

    // Subscribe to ticks for a symbol (example uses first symbol found)
    const symbol = (symbols[0] && symbols[0].symbol) || 'R_100';
    console.log('Subscribing to ticks for', symbol);
    const unsubscribe = client.subscribeTicks(symbol, (msg) => {
      // msg contains e.g. { tick: { epoch: 1234567, quote: '1234.5', symbol: 'R_100' }, subscription: { ... } }
      if (msg.tick) {
        console.log(`[tick ${symbol}]`, msg.tick);
      } else {
        console.log('[ticks message]', msg);
      }
    });

    // Get tick history (last 100 ticks)
    const history = await client.getTicksHistory(symbol, { count: 100, style: 'ticks' });
    console.log('Ticks history sample length:', history ? (history.prices ? history.prices.length : (history.history ? history.history.length : Object.keys(history).length)) : 'n/a');

    // Example: request a proposal (demo only)
    // NOTE: contract_type, duration_unit and other fields depend on the symbol/product type. Adjust accordingly.
    const proposalOpts = {
      symbol,
      amount: 1,          // stake
      basis: 'stake',     // or 'payout'
      contract_type: 'CALL', // or 'PUT' depending on instrument
      duration: 5,
      duration_unit: 's'  // 's' seconds, 'm' minutes etc.
    };

    try {
      const proposal = await client.requestProposal(proposalOpts);
      console.log('Proposal:', proposal);

      // If you want to buy immediately (CAUTION: real trade)
      // const buyResult = await client.buyContract({ proposal_id: proposal.proposal.id ?? proposal.id, price: proposal.proposal.price ?? proposal.ask_price ?? proposal.amount });
      // console.log('Buy result:', buyResult);
    } catch (err) {
      console.warn('Proposal/buy failed (maybe unsuitable contract settings for this symbol):', err.message);
    }

    // Keep alive and run for 60s for demo then unsubscribe
    setTimeout(() => {
      unsubscribe();
      console.log('Unsubscribed ticks. Disconnecting client in demo.');
      client.disconnect();
    }, 60000);

  } catch (err) {
    console.error('Error in example flow:', err);
    client.disconnect();
  }
}

// If run directly with node, execute example
if (require && require.main === module) {
  example();
}
