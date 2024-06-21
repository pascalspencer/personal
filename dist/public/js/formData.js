"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var _DerivAPIBasic = _interopRequireDefault(require("https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic"));
var _ws = _interopRequireDefault(require("ws"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
document.addEventListener("DOMContentLoaded", function () {
  var dataForm = document.getElementById("trade-form");
  var spinnerContainer = document.getElementById("spinner-container");
  var loadingMessage = document.getElementById("loading-message");
  var resultsContainer = document.getElementById("results-container");
  var derivAppID = 61696; // Replace with your actual app ID
  var connection = new _ws.default("wss://ws.binaryws.com/websockets/v3?app_id=".concat(derivAppID));
  var api;
  var sentimentsData = {};

  // Fetch trading instruments JSON
  var tradingInstruments = {};
  fetch("/trade/instruments").then(function (response) {
    return response.json();
  }).then(function (data) {
    tradingInstruments = data;
  }).catch(function (error) {
    return console.error("Error fetching trading instruments:", error);
  });
  function showSpinnerAndMessages() {
    spinnerContainer.style.display = "block";
    document.body.classList.add("blur-background");
    loadingMessage.textContent = "Running simulations...";
    setTimeout(function () {
      loadingMessage.textContent = "Finalizing predictions...";
    }, 4500);
    setTimeout(function () {
      spinnerContainer.style.display = "none";
      loadingMessage.textContent = "";
      document.body.classList.remove("blur-background");
      displaySelectedOptionsAfterFetch();
      evaluateAndBuyContract();
    }, 8500);
  }
  function getTradeTypeForSentiment(sentiment, index) {
    var sentimentParts = sentiment.split("/");
    if (sentimentParts[index]) {
      var selectedPart = sentimentParts[index].trim();
      return tradingInstruments.trade_types[selectedPart];
    } else {
      console.error("Index out of bounds or sentiment part is undefined.");
      return null;
    }
  }
  function evaluateAndBuyContract() {
    var sentimentDropdown = document.getElementById("sentiment");
    var selectedSentiment = sentimentDropdown.value;
    var percentages = calculatePercentages();
    var maxPercentage = Math.max.apply(Math, _toConsumableArray(percentages));
    var maxIndex = percentages.indexOf(maxPercentage);
    var tradeType = getTradeTypeForSentiment(selectedSentiment, maxIndex);
    if (!tradeType) {
      console.error("Invalid trade type derived from sentiment.");
      return;
    }
    var market = document.getElementById("market").value;
    var submarket = document.getElementById("submarket").value;
    var symbol = tradingInstruments.symbols[submarket];
    if (!symbol) {
      console.error("Invalid symbol derived from submarket.");
      return;
    }
    var price = parseFloat(document.getElementById("price").value);
    buyContract(symbol, tradeType, 1, price);
  }
  function populateSubmarkets() {
    var market = document.getElementById("market").value;
    var submarketDropdown = document.getElementById("submarket");
    submarketDropdown.innerHTML = "";
    fetch("/api/data").then(function (response) {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    }).then(function (data) {
      // Ensure data[market] exists and is an array
      var submarkets = data[market] || [];

      // Populate submarket dropdown
      submarkets.forEach(function (submarket) {
        addOption(submarketDropdown, submarket);
      });

      // Enable and make submarket dropdown required
      submarketDropdown.disabled = false;
      submarketDropdown.required = true;
    }).catch(function (error) {
      console.error("There was a problem with the fetch operation:", error);
    });
  }
  var numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Constants
  var MAX_PERCENTAGE = 93;
  var MATCH_CHANCE_FREQUENCY = 2 / 11; // Probability of high match chance
  var RANDOM_DEVIATION_CHANCE = 0.2;
  var GENERAL_DEVIATION_CHANCE = 0.1;
  var DEVIATION_BASE = 90.0;
  var DEVIATION_RANGE = 35.0;
  var RANDOM_FREQUENCY_MIN = 8.0;
  var RANDOM_FREQUENCY_RANGE = 5.0;
  function determineBaseChances(selectedNumber) {
    var totalNumbers = numbers.length; // total numbers from 0 to 9
    var chance = 100 / totalNumbers;
    var higherChance, lowerChance;

    // Calculate chances based on selectedNumber
    higherChance = lowerChance = chance;
    return {
      higherChance: higherChance,
      lowerChance: lowerChance
    };
  }
  function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
    if (Math.random() < RANDOM_DEVIATION_CHANCE && selectedNumber > Math.min.apply(Math, numbers) && selectedNumber < Math.max.apply(Math, numbers)) {
      var increaseAmount = Math.random() * 10; // Increase by up to 10%
      higherChance = Math.min(higherChance + increaseAmount, MAX_PERCENTAGE);
      lowerChance = Math.max(lowerChance - increaseAmount, 0);
    }
    return {
      higherChance: higherChance,
      lowerChance: lowerChance
    };
  }
  function applyGeneralDeviation(higherChance, lowerChance) {
    if (Math.random() < GENERAL_DEVIATION_CHANCE) {
      var deviationAmount = DEVIATION_BASE + Math.random() * DEVIATION_RANGE;
      higherChance = deviationAmount;
      lowerChance = MAX_PERCENTAGE - higherChance;
    }
    return {
      higherChance: higherChance,
      lowerChance: lowerChance
    };
  }
  function determinePercentage(selectedNumber) {
    var _determineBaseChances = determineBaseChances(selectedNumber),
      higherChance = _determineBaseChances.higherChance,
      lowerChance = _determineBaseChances.lowerChance;
    var _applyRandomDeviation = applyRandomDeviation(higherChance, lowerChance, selectedNumber);
    higherChance = _applyRandomDeviation.higherChance;
    lowerChance = _applyRandomDeviation.lowerChance;
    // Ensure bounds are respected
    var _applyGeneralDeviatio = applyGeneralDeviation(higherChance, lowerChance);
    higherChance = _applyGeneralDeviatio.higherChance;
    lowerChance = _applyGeneralDeviatio.lowerChance;
    higherChance = Math.min(higherChance, MAX_PERCENTAGE);
    lowerChance = Math.max(lowerChance, 0);

    // Generate a random frequency between RANDOM_FREQUENCY_MIN and (RANDOM_FREQUENCY_MIN + RANDOM_FREQUENCY_RANGE)
    var randomFrequency = Math.random() * RANDOM_FREQUENCY_RANGE + RANDOM_FREQUENCY_MIN;

    // Multiply the chosen percentage by the random frequency
    var differs = higherChance * randomFrequency;
    var matches = lowerChance * randomFrequency;

    // Adjust match chance to be higher when deviation occurs
    if (Math.random() < RANDOM_DEVIATION_CHANCE && selectedNumber > Math.min.apply(Math, numbers) && selectedNumber < Math.max.apply(Math, numbers)) {
      matches *= 2; // Increase match chance significantly during deviation
    } else {
      // Adjust match chance to be low most of the time
      if (Math.random() >= MATCH_CHANCE_FREQUENCY) {
        matches *= 0.1; // Reduce match chance significantly
      }
    }
    return {
      higherChance: higherChance,
      lowerChance: lowerChance,
      randomFrequency: randomFrequency,
      matches: matches,
      differs: differs
    };
  }

  // Export a function to determine the chances
  function determineChances(selectedNumber) {
    var _determinePercentage = determinePercentage(selectedNumber),
      matches = _determinePercentage.matches,
      differs = _determinePercentage.differs;

    // Determine total chance
    var totalChance = matches + differs;

    // Determine matchesChance and differsChance percentages
    var matchesChance = Math.floor(matches / totalChance * 97);
    var differsChance = Math.floor(differs / totalChance * 97);
    return {
      matchesChance: matchesChance,
      differsChance: differsChance
    };
  }

  // Deviation frequencies for specific numbers
  var deviationFrequenciesDigits = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 5,
    6: 4,
    7: 3,
    8: 2
  };

  // Constants
  var MAX_PERCENTAGE_DIGIT = 93;
  var DEVIATION_BASE_DIGIT = 50.0;
  var DEVIATION_RANGE_DIGIT = 35.0;
  var RANDOM_FREQUENCY_MIN_DIGIT = 7.0;
  var RANDOM_FREQUENCY_RANGE_DIGIT = 6.0;
  var RANDOM_DEVIATION_CHANCE_DIGIT = 0.2;
  function calculateBaseChances(selectedNumber, max, min) {
    var higherChanceDigit, lowerChanceDigit;
    if (selectedNumber === max || selectedNumber === 9) {
      higherChanceDigit = 0;
      lowerChanceDigit = MAX_PERCENTAGE_DIGIT;
    } else if (selectedNumber === min || selectedNumber === 0) {
      higherChanceDigit = MAX_PERCENTAGE_DIGIT;
      lowerChanceDigit = 0;
    } else {
      higherChanceDigit = Math.min((max - selectedNumber) / (max - min) * 100, MAX_PERCENTAGE_DIGIT);
      lowerChanceDigit = Math.min((selectedNumber - min) / (max - min) * 100, MAX_PERCENTAGE_DIGIT);
    }
    return {
      higherChanceDigit: higherChanceDigit,
      lowerChanceDigit: lowerChanceDigit
    };
  }
  function applyRandomDeviationDigit(higherChanceDigit, lowerChanceDigit, selectedNumber) {
    if (Math.random() < RANDOM_DEVIATION_CHANCE_DIGIT && selectedNumber > 1 && selectedNumber < 9) {
      var increaseAmountDigit = Math.random() * 10;
      higherChanceDigit = Math.min(higherChanceDigit + increaseAmountDigit, MAX_PERCENTAGE_DIGIT);
      lowerChanceDigit = Math.max(lowerChanceDigit - increaseAmountDigit, 0);
    }
    return {
      higherChanceDigit: higherChanceDigit,
      lowerChanceDigit: lowerChanceDigit
    };
  }
  function applyFrequencyDeviationDigit(higherChanceDigit, lowerChanceDigit, selectedNumber) {
    var deviationFrequencyDigit = deviationFrequenciesDigits[selectedNumber] || 1;
    if (Math.random() < deviationFrequencyDigit / 10) {
      var deviationAmountDigit = DEVIATION_BASE_DIGIT + Math.random() * DEVIATION_RANGE_DIGIT;
      higherChanceDigit = deviationAmountDigit;
      lowerChanceDigit = MAX_PERCENTAGE_DIGIT - higherChanceDigit;
    }
    higherChanceDigit = Math.min(higherChanceDigit, MAX_PERCENTAGE_DIGIT);
    lowerChanceDigit = Math.max(lowerChanceDigit, 0);
    return {
      higherChanceDigit: higherChanceDigit,
      lowerChanceDigit: lowerChanceDigit
    };
  }
  function calculatePercentageDigit(selectedNumber) {
    var max = Math.max.apply(Math, numbers);
    var min = Math.min.apply(Math, numbers);
    var _calculateBaseChances = calculateBaseChances(selectedNumber, max, min),
      higherChanceDigit = _calculateBaseChances.higherChanceDigit,
      lowerChanceDigit = _calculateBaseChances.lowerChanceDigit;
    var _applyRandomDeviation2 = applyRandomDeviationDigit(higherChanceDigit, lowerChanceDigit, selectedNumber);
    higherChanceDigit = _applyRandomDeviation2.higherChanceDigit;
    lowerChanceDigit = _applyRandomDeviation2.lowerChanceDigit;
    var _applyFrequencyDeviat = applyFrequencyDeviationDigit(higherChanceDigit, lowerChanceDigit, selectedNumber);
    higherChanceDigit = _applyFrequencyDeviat.higherChanceDigit;
    lowerChanceDigit = _applyFrequencyDeviat.lowerChanceDigit;
    var randomFrequencyDigit = Math.random() * RANDOM_FREQUENCY_RANGE_DIGIT + RANDOM_FREQUENCY_MIN_DIGIT;
    var over = higherChanceDigit * randomFrequencyDigit;
    var under = lowerChanceDigit * randomFrequencyDigit;
    return {
      higherChanceDigit: higherChanceDigit,
      lowerChanceDigit: lowerChanceDigit,
      randomFrequencyDigit: randomFrequencyDigit,
      over: over,
      under: under
    };
  }
  function calculateChances(selectedNumber) {
    var _calculatePercentageD = calculatePercentageDigit(selectedNumber),
      over = _calculatePercentageD.over,
      under = _calculatePercentageD.under;
    var totalChanceDigit = over + under;
    var overChance = Math.floor(over / totalChanceDigit * 97);
    var underChance = Math.floor(under / totalChanceDigit * 97);
    return {
      overChance: overChance,
      underChance: underChance
    };
  }
  function populateSentiments() {
    var sentimentData = document.getElementById("contract_type").value;
    var sentimentDropdown = document.getElementById("sentiment");
    sentimentDropdown.innerHTML = "";
    var sentiments = sentimentsData[sentimentData] || [];
    sentiments.forEach(function (sentiment) {
      return addOption(sentimentDropdown, sentiment);
    });
    var selectedSentiment = sentimentDropdown.value;
    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";
    } else if (["Even/Odd"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "none";
    } else {
      document.getElementById("digit-value").style.display = "none";
    }
    sentimentDropdown.disabled = false;
  }
  connection.onopen = function () {
    api = new _DerivAPIBasic.default({
      connection: connection
    });

    // Call ping once the connection is open
    ping();
    console.log("WebSocket connection established.");

    // Fetch sentiments data once the WebSocket connection is open
    fetch("/api/data").then(function (response) {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    }).then(function (data) {
      sentimentsData = data;
      populateSentimentDropdown();
    }).catch(function (error) {
      console.error("There was a problem with the fetch operation:", error);
    });
  };
  connection.onerror = function (error) {
    console.error("WebSocket error:", error);
  };
  function ping() {
    if (api) {
      setInterval(function () {
        api.ping();
      }, 30000);
    }
  }
  function buyContract(symbol, tradeType, duration, price) {
    var buyContractRequest = {
      proposal: 1,
      amount: price,
      basis: "stake",
      contract_type: tradeType,
      currency: "USD",
      duration: duration,
      duration_unit: "t",
      symbol: symbol
    };
    function executeBuyContract() {
      return _executeBuyContract.apply(this, arguments);
    }
    function _executeBuyContract() {
      _executeBuyContract = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
        var proposalResponse, buyRequest, buyResponse;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return api.proposal(buyContractRequest);
            case 3:
              proposalResponse = _context.sent;
              buyRequest = {
                buy: proposalResponse.proposal.id,
                price: price
              };
              _context.next = 7;
              return api.buy(buyRequest);
            case 7:
              buyResponse = _context.sent;
              console.log("Contract bought:", buyResponse);
              alert("Contract bought successfully!");
              _context.next = 16;
              break;
            case 12:
              _context.prev = 12;
              _context.t0 = _context["catch"](0);
              console.error("Error buying contract:", _context.t0);
              alert("Error buying contract. Please try again.");
            case 16:
            case "end":
              return _context.stop();
          }
        }, _callee, null, [[0, 12]]);
      }));
      return _executeBuyContract.apply(this, arguments);
    }
    executeBuyContract();
  }
  ;
  if (connection.readyState === _ws.default.OPEN) {
    connection.onopen(); // Call the onopen handler directly if the connection is already open
  } else {
    connection.onopen = function () {
      api = new _DerivAPIBasic.default({
        connection: connection
      });
      ping(); // Ensure ping is called once the connection is open
      console.log("WebSocket connection established.");
    };
  }
  function addOption(selectElement, optionText) {
    var option = document.createElement("option");
    option.text = optionText;
    selectElement.add(option);
  }
  function displaySelectedOptionsAfterFetch() {
    var sentimentDropdown = document.getElementById("sentiment");
    var selectedSentiment = sentimentDropdown.value;
    var selectedNumber = parseInt(document.getElementById("input-value").value, 10);
    var _calculateChances = calculateChances(selectedNumber),
      overChance = _calculateChances.overChance,
      underChance = _calculateChances.underChance;
    var _determineChances = determineChances(selectedNumber),
      matchesChance = _determineChances.matchesChance,
      differsChance = _determineChances.differsChance;
    var sentimentParts = selectedSentiment.split("/");
    var percentages = sentimentParts.map(generatePercentage);
    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "block";
    if (["Matches/Differs", "Over/Under"].includes(selectedSentiment)) {
      document.getElementById("digit-value").style.display = "block";
      sentimentParts.forEach(function (part, index) {
        var optionElement = document.createElement("div");
        if (part.trim() === "Matches") {
          optionElement.textContent = "Matches (".concat(matchesChance, "%) Stop trade");
        } else if (part.trim() === "Differs") {
          optionElement.textContent = "Differs (".concat(differsChance, "%) Stop trade");
        } else if (part.trim() === "Over") {
          optionElement.textContent = "Over (".concat(overChance, "%) Stop trade");
        } else if (part.trim() === "Under") {
          optionElement.textContent = "Under (".concat(underChance, "%) Stop trade");
        } else {
          optionElement.textContent = "".concat(part.trim(), " (").concat(percentages[index], "%) Stop trade");
        }
        resultsContainer.appendChild(optionElement);
      });
    } else {
      document.getElementById("digit-value").style.display = "none";
      sentimentParts.forEach(function (part, index) {
        var optionElement = document.createElement("div");
        optionElement.textContent = "".concat(part.trim(), " (").concat(percentages[index], "%) Stop trade");
        resultsContainer.appendChild(optionElement);
      });
    }
  }
  function calculatePercentages() {
    var percentages = [];
    var divElements = resultsContainer.getElementsByTagName("div");
    for (var i = 0; i < 2 && i < divElements.length; i++) {
      var textContent = divElements[i].textContent;
      var percentageMatch = textContent.match(/\((\d+)%\)/);
      if (percentageMatch) {
        percentages.push(parseInt(percentageMatch[1], 10));
      }
    }
    return percentages;
  }
  function generatePercentage() {
    var percentage;
    do {
      percentage = Math.floor(Math.random() * 87) + 1;
    } while (percentage === 50);
    return percentage;
  }
  fetch("/trade/data").then(function (response) {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  }).then(function (data) {
    // Assuming data structure like { Multipliers: [...], up_and_down: [...], high_and_low: [...], digits: [...] }
    sentimentsData = {
      Multipliers: data.Multipliers || [],
      up_and_down: data.up_and_down || [],
      high_and_low: data.high_and_low || [],
      digits: data.digits || []
    };
  }).catch(function (error) {
    console.error("There was a problem with the fetch operation:", error);
  });
  document.getElementById("market").addEventListener("change", populateSubmarkets);
  document.getElementById("contract_type").addEventListener("change", populateSentiments);
  window.addEventListener("load", populateSubmarkets);
  dataForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showSpinnerAndMessages();
  });
});