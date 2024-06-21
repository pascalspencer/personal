"use strict";

var _DerivAPIBasic = _interopRequireDefault(require("https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// testing.js

var app_id = 1089; // Replace with your app_id or leave the current test app_id
var connection = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=".concat(app_id));
var api = new _DerivAPIBasic.default({
  connection: connection
});
var last_digit_range = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var symbol = 'R_50';
var ticks_request = {
  ticks_history: symbol,
  adjust_start_time: 1,
  count: 10,
  end: 'latest',
  start: 1,
  style: 'ticks',
  subscribe: 1
};

// Function to update the last digit display
var updateLastDigitDisplay = function updateLastDigitDisplay(lastDigit) {
  var lastDigitDisplay = document.getElementById('lastDigitDisplay');
  if (lastDigitDisplay) {
    lastDigitDisplay.textContent = "Last Digit: ".concat(lastDigit);
  }
};
var handleTickResponse = function handleTickResponse(res) {
  var data = JSON.parse(res.data);
  if (data.error) {
    console.error('Error:', data.error.message);
    unsubscribeFromTicks(); // Disconnect on error
    return;
  }
  if (data.msg_type === 'tick') {
    var quote = data.tick.quote;
    var lastDigit = quote % 10;
    console.log('Current Tick:', quote);
    console.log('Last Digit:', lastDigit);
    updateLastDigitDisplay(lastDigit); // Update HTML with current last digit
    if (last_digit_range.includes(lastDigit)) {
      console.log('Last Digit is in the range:', last_digit_range);
    } else {
      console.log('Last Digit is NOT in the range:', last_digit_range);
    }
  }
};
var subscribeToTicks = function subscribeToTicks() {
  connection.addEventListener('message', handleTickResponse);
  api.subscribe(ticks_request);
};
var unsubscribeFromTicks = function unsubscribeFromTicks() {
  connection.removeEventListener('message', handleTickResponse);
  api.unsubscribe(ticks_request);
};
var startButton = document.querySelector('#startTracking');
var stopButton = document.querySelector('#stopTracking');
if (startButton) {
  startButton.addEventListener('click', subscribeToTicks);
} else {
  console.error('Button with id "startTracking" not found');
}
if (stopButton) {
  stopButton.addEventListener('click', unsubscribeFromTicks);
} else {
  console.error('Button with id "stopTracking" not found');
}

// Graceful disconnect on window unload or close
window.addEventListener('unload', function () {
  unsubscribeFromTicks();
  api.disconnect();
});