"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var express = require("express");
var session = require("express-session");
var path = require("path");
require("dotenv").config();
var fs = require("fs");
var WebSocket = require("ws");
var DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");
var app = express();
var app_id = 61696;
var connection = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=".concat(app_id));
connection.onopen = function () {
  console.log("WebSocket connection established.");
};
connection.onerror = function (error) {
  console.error("WebSocket error:", error);
};
var api = new DerivAPI({
  connection: connection
});
var basic = api.basic;
var active_symbols_request = {
  active_symbols: "brief",
  product_type: "basic"
};

// Initialize marketsData with Sets
var marketsData = {
  forex: new Set(),
  indices: new Set(),
  commodities: new Set(),
  cryptocurrency: new Set(),
  synthetic_index: new Set()
};
var tradeData = {
  Multipliers: ["Up/Down"],
  up_and_down: ["Rise/Fall", "Higher/Lower"],
  high_and_low: ["Touch/No Touch"],
  digits: ["Matches/Differs", "Even/Odd", "Over/Under"]
};
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({
  extended: true
}));
app.use(express.json());
app.use(session({
  secret: "zodiac_deriv",
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true
  } // Set to true if using HTTPS
}));
app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
var ping = function ping() {
  setInterval(function () {
    if (basic) {
      basic.ping();
    }
  }, 30000);
};
app.get("/sign-in", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "sign-in.html"));
});
var activeSymbolsResponse = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(res) {
    var data, contractsData, _iterator, _step, contract, _market, market;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          data = JSON.parse(res.data);
          if (!data.error) {
            _context.next = 7;
            break;
          }
          console.error("Error:", data.error.message);
          connection.removeEventListener("message", activeSymbolsResponse);
          _context.next = 6;
          return basic.disconnect();
        case 6:
          return _context.abrupt("return");
        case 7:
          if (data.msg_type === "active_symbols") {
            contractsData = data.active_symbols;
            _iterator = _createForOfIteratorHelper(contractsData);
            try {
              for (_iterator.s(); !(_step = _iterator.n()).done;) {
                contract = _step.value;
                _market = contract.market; // Ensure marketsData[market] is a Set
                if (!(marketsData[_market] instanceof Set)) {
                  marketsData[_market] = new Set();
                }
                marketsData[_market].add(contract.display_name);
              }

              // Convert sets back to arrays if needed
            } catch (err) {
              _iterator.e(err);
            } finally {
              _iterator.f();
            }
            for (market in marketsData) {
              marketsData[market] = Array.from(marketsData[market]);
            }
            connection.removeEventListener("message", activeSymbolsResponse);
          }
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
          connection.addEventListener("message", activeSymbolsResponse);
          _context2.next = 3;
          return basic.activeSymbols(active_symbols_request);
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
app.post("/trade", function (req, res) {
  var filePath = path.resolve(__dirname, "public", "clients.json");
  fs.readFile(filePath, "utf8", function (err, data) {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Internal Server Error");
    }
    try {
      var jsonData = JSON.parse(data);
      var _req$body = req.body,
        usernameClient = _req$body.usernameClient,
        passwordClient = _req$body.passwordClient;
      var customers = jsonData.customers;
      var client = customers.find(function (customer) {
        return customer.clientUsername === usernameClient && customer.clientPassword === passwordClient;
      });
      if (client) {
        req.session.authenticated = true;
        return res.sendFile(path.join(__dirname, "public", "trade.html"));
      } else {
        return res.status(401).send("Invalid username or password");
      }
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return res.status(500).send("Internal Server Error");
    }
  });
});
app.get('/trade/instruments', function (req, res) {
  var filePath = path.join(__dirname, 'public', 'trading_instruments.json');
  fs.readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      console.error('Error reading JSON file:', err);
      res.status(500).json({
        error: 'Internal server error'
      });
      return;
    }
    res.json(JSON.parse(data));
  });
});
app.get("/api/data", function (req, res) {
  getActiveSymbols().then(function () {
    res.json(marketsData);
  }).catch(function (error) {
    console.error("Error getting active symbols:", error);
    res.status(500).json({
      error: "Internal Server Error"
    });
  });
});
app.get("/redirect", /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(req, res) {
    var _req$query, acct1, token1, cur1, acct2, token2, cur2, user_accounts, _i, _user_accounts, account;
    return _regeneratorRuntime().wrap(function _callee3$(_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _req$query = req.query, acct1 = _req$query.acct1, token1 = _req$query.token1, cur1 = _req$query.cur1, acct2 = _req$query.acct2, token2 = _req$query.token2, cur2 = _req$query.cur2;
          user_accounts = [{
            account: acct1,
            token: token1,
            currency: cur1
          }, {
            account: acct2,
            token: token2,
            currency: cur2
          }];
          if (basic) {
            _context3.next = 5;
            break;
          }
          console.error("DerivAPI basic is not initialized.");
          return _context3.abrupt("return", res.sendStatus(500));
        case 5:
          _context3.prev = 5;
          _i = 0, _user_accounts = user_accounts;
        case 7:
          if (!(_i < _user_accounts.length)) {
            _context3.next = 16;
            break;
          }
          account = _user_accounts[_i];
          if (!account.token) {
            _context3.next = 13;
            break;
          }
          console.log("Authorizing account ...");
          _context3.next = 13;
          return basic.authorize(account.token);
        case 13:
          _i++;
          _context3.next = 7;
          break;
        case 16:
          req.session.token1 = token1;
          res.redirect("/sign-in");
          _context3.next = 24;
          break;
        case 20:
          _context3.prev = 20;
          _context3.t0 = _context3["catch"](5);
          console.error("Error authorizing accounts:", _context3.t0);
          res.sendStatus(500);
        case 24:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[5, 20]]);
  }));
  return function (_x2, _x3) {
    return _ref3.apply(this, arguments);
  };
}());
app.get("/trade/data", function (req, res) {
  res.json(tradeData);
});
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log("Server is running on http://localhost:".concat(PORT));
  ping(); // Start the pinging process to keep the WebSocket connection alive
});
module.exports = app;