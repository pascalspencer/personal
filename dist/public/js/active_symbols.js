"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var DerivAPIBasic = require('@deriv/deriv-api/dist/DerivAPIBasic');
var WebSocket = require('ws');
var app_id = 1089; // Replace with your app_id or leave the current one for testing.
var connection = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=".concat(app_id));
var api = new DerivAPIBasic({
  connection: connection
});

// Currently gets all available symbols.
var active_symbols_request = {
  // landing_company: "maltainvest", // Uncomment landing_company if you want to retrieve specific symbols.
  active_symbols: 'brief',
  product_type: 'basic'
};
var activeSymbolsResponse = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(res) {
    var data, _data$error;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!(data.error !== undefined)) {
            _context.next = 6;
            break;
          }
          console.log('Error : ', (_data$error = data.error) === null || _data$error === void 0 ? void 0 : _data$error.message);
          connection.removeEventListener('message', activeSymbolsResponse, false);
          _context.next = 6;
          return api.disconnect();
        case 6:
          if (data.msg_type === 'active_symbols') {
            console.log(data.active_symbols);
          }
          connection.removeEventListener('message', activeSymbolsResponse, false);
        case 8:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return function activeSymbolsResponse(_x) {
    return _ref.apply(this, arguments);
  };
}();
var getActiveSymbols = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2() {
    return _regeneratorRuntime().wrap(function _callee2$(_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          connection.addEventListener('message', activeSymbolsResponse);
          _context2.next = 3;
          return api.activeSymbols(active_symbols_request);
        case 3:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return function getActiveSymbols() {
    return _ref2.apply(this, arguments);
  };
}();

// get ticks

var tickStream = function tickStream() {
  return api.subscribe({
    ticks: 'R_100'
  });
};
var tickResponse = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(res) {
    var data;
    return _regeneratorRuntime().wrap(function _callee3$(_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!(data.error !== undefined)) {
            _context3.next = 6;
            break;
          }
          console.log('Error : ', data.error.message);
          connection.removeEventListener('message', tickResponse, false);
          _context3.next = 6;
          return api.disconnect();
        case 6:
          if (data.msg_type === 'tick') {
            console.log(data.tick);
          }
        case 7:
        case "end":
          return _context3.stop();
      }
    }, _callee3);
  }));
  return function tickResponse(_x2) {
    return _ref3.apply(this, arguments);
  };
}();
var subscribeTicks = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4() {
    return _regeneratorRuntime().wrap(function _callee4$(_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return tickStream();
        case 2:
          connection.addEventListener('message', tickResponse);
        case 3:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  }));
  return function subscribeTicks() {
    return _ref4.apply(this, arguments);
  };
}();
var unsubscribeTicks = function unsubscribeTicks() {
  connection.removeEventListener('message', tickResponse, false);
  tickStream().unsubscribe();
};

//ticks history

var ticks_history_request = {
  ticks_history: 'R_50',
  adjust_start_time: 1,
  count: 10,
  end: 'latest',
  start: 1,
  style: 'ticks'
};
var ticks_request = _objectSpread(_objectSpread({}, ticks_history_request), {}, {
  subscribe: 1
});
var tickSubscriber = function tickSubscriber() {
  return api.subscribe(ticks_request);
};
var ticksHistoryResponse = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee5(res) {
    var data;
    return _regeneratorRuntime().wrap(function _callee5$(_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!(data.error !== undefined)) {
            _context5.next = 6;
            break;
          }
          console.log('Error : ', data.error.message);
          connection.removeEventListener('message', ticksHistoryResponse, false);
          _context5.next = 6;
          return api.disconnect();
        case 6:
          if (data.msg_type === 'history') {
            console.log(data.history);
          }
          connection.removeEventListener('message', ticksHistoryResponse, false);
        case 8:
        case "end":
          return _context5.stop();
      }
    }, _callee5);
  }));
  return function ticksHistoryResponse(_x3) {
    return _ref5.apply(this, arguments);
  };
}();
var ticksResponse = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee6(res) {
    var data;
    return _regeneratorRuntime().wrap(function _callee6$(_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          data = JSON.parse(res.data); // This example returns an object with a selected amount of past ticks.
          if (!(data.error !== undefined)) {
            _context6.next = 6;
            break;
          }
          console.log('Error : ', data.error.message);
          connection.removeEventListener('message', ticksResponse, false);
          _context6.next = 6;
          return api.disconnect();
        case 6:
          // Allows you to monitor ticks.
          if (data.msg_type === 'tick') {
            console.log(data.tick);
          }
        case 7:
        case "end":
          return _context6.stop();
      }
    }, _callee6);
  }));
  return function ticksResponse(_x4) {
    return _ref6.apply(this, arguments);
  };
}();
var subscribeTick = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee7() {
    return _regeneratorRuntime().wrap(function _callee7$(_context7) {
      while (1) switch (_context7.prev = _context7.next) {
        case 0:
          connection.addEventListener('message', ticksResponse);
          _context7.next = 3;
          return tickSubscriber();
        case 3:
        case "end":
          return _context7.stop();
      }
    }, _callee7);
  }));
  return function subscribeTick() {
    return _ref7.apply(this, arguments);
  };
}();
var unsubscribeTick = /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee8() {
    return _regeneratorRuntime().wrap(function _callee8$(_context8) {
      while (1) switch (_context8.prev = _context8.next) {
        case 0:
          connection.removeEventListener('message', ticksResponse, false);
          _context8.next = 3;
          return tickSubscriber().unsubscribe();
        case 3:
        case "end":
          return _context8.stop();
      }
    }, _callee8);
  }));
  return function unsubscribeTick() {
    return _ref8.apply(this, arguments);
  };
}();
var getTicksHistory = /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee9() {
    return _regeneratorRuntime().wrap(function _callee9$(_context9) {
      while (1) switch (_context9.prev = _context9.next) {
        case 0:
          connection.addEventListener('message', ticksHistoryResponse);
          _context9.next = 3;
          return api.ticksHistory(ticks_history_request);
        case 3:
        case "end":
          return _context9.stop();
      }
    }, _callee9);
  }));
  return function getTicksHistory() {
    return _ref9.apply(this, arguments);
  };
}();
var subscribe_ticks_button = document.querySelector('#ticks');
subscribe_ticks_button.addEventListener('click', subscribeTick);
var unsubscribe_ticks_button = document.querySelector('#ticks-unsubscribe');
unsubscribe_ticks_button.addEventListener('click', unsubscribeTick);
var ticks_history_button = document.querySelector('#ticks-history');
ticks_history_button.addEventListener('click', getTicksHistory);

//contract for symbols

var contracts_for_symbol_request = {
  contracts_for: 'R_50',
  currency: 'USD',
  landing_company: 'svg',
  product_type: 'basic'
};
var contractsForSymbolResponse = /*#__PURE__*/function () {
  var _ref10 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee10(res) {
    var data, _data$error2;
    return _regeneratorRuntime().wrap(function _callee10$(_context10) {
      while (1) switch (_context10.prev = _context10.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!(data.error !== undefined)) {
            _context10.next = 6;
            break;
          }
          console.log('Error : ', (_data$error2 = data.error) === null || _data$error2 === void 0 ? void 0 : _data$error2.message);
          connection.removeEventListener('message', contractsForSymbolResponse, false);
          _context10.next = 6;
          return api.disconnect();
        case 6:
          if (data.msg_type === 'contracts_for') {
            console.log(data.contracts_for);
          }
          connection.removeEventListener('message', contractsForSymbolResponse, false);
        case 8:
        case "end":
          return _context10.stop();
      }
    }, _callee10);
  }));
  return function contractsForSymbolResponse(_x5) {
    return _ref10.apply(this, arguments);
  };
}();
var getContractsForSymbol = /*#__PURE__*/function () {
  var _ref11 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee11() {
    return _regeneratorRuntime().wrap(function _callee11$(_context11) {
      while (1) switch (_context11.prev = _context11.next) {
        case 0:
          connection.addEventListener('message', contractsForSymbolResponse);
          _context11.next = 3;
          return api.contractsFor(contracts_for_symbol_request);
        case 3:
        case "end":
          return _context11.stop();
      }
    }, _callee11);
  }));
  return function getContractsForSymbol() {
    return _ref11.apply(this, arguments);
  };
}();
var symbol_button = document.querySelector('#contractsForSymbol');
symbol_button.addEventListener('click', getContractsForSymbol);

//keep website awake

var proposal = function proposal() {
  api.subscribe({
    proposal: 1,
    subscribe: 1,
    amount: 10,
    basis: 'payout',
    contract_type: 'CALL',
    currency: 'USD',
    duration: 1,
    duration_unit: 'm',
    symbol: 'R_100',
    barrier: '+0.1'
  });
};

// Send a ping every 30 seconds to keep the connection alive
// Needs to use the same websocket connection as the one you want to maintain.
var ping = function ping() {
  setInterval(function () {
    api.ping();
  }, 30000);
};
var wsResponse = /*#__PURE__*/function () {
  var _ref12 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee12(res) {
    var data;
    return _regeneratorRuntime().wrap(function _callee12$(_context12) {
      while (1) switch (_context12.prev = _context12.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!(data.error !== undefined)) {
            _context12.next = 8;
            break;
          }
          console.log('Error: %s ', data.error.message);
          connection.removeEventListener('message', wsResponse, false);
          _context12.next = 6;
          return api.disconnect();
        case 6:
          _context12.next = 9;
          break;
        case 8:
          if (data.msg_type === 'proposal') {
            console.log('Details: %s', data.proposal.longcode);
            console.log('Ask Price: %s', data.proposal.display_value);
            console.log('Payout: %f', data.proposal.payout);
            console.log('Spot: %f', data.proposal.spot);
          } else if (data.msg_type === 'ping') {
            console.log('ping');
          }
        case 9:
        case "end":
          return _context12.stop();
      }
    }, _callee12);
  }));
  return function wsResponse(_x6) {
    return _ref12.apply(this, arguments);
  };
}();
var checkSignal = function checkSignal() {
  proposal();
  ping();
  connection.addEventListener('message', wsResponse);
};
var endCall = function endCall() {
  connection.removeEventListener('message', wsResponse, false);
  proposal().unsubscribe();
};
var keep_alive_button = document.querySelector('#keep_alive');
keep_alive_button.addEventListener('click', checkSignal);
var end_call_button = document.querySelector('#end_call');
end_call_button.addEventListener('click', endCall);