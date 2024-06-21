// testing.js

import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';

const app_id = 1089; // Replace with your app_id or leave the current test app_id
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
const api = new DerivAPIBasic({ connection });

const last_digit_range = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const symbol = 'R_50';

const ticks_request = {
  ticks_history: symbol,
  adjust_start_time: 1,
  count: 10,
  end: 'latest',
  start: 1,
  style: 'ticks',
  subscribe: 1,
};

// Function to update the last digit display
const updateLastDigitDisplay = (lastDigit) => {
  const lastDigitDisplay = document.getElementById('lastDigitDisplay');
  if (lastDigitDisplay) {
    lastDigitDisplay.textContent = `Last Digit: ${lastDigit}`;
  }
};

const handleTickResponse = (res) => {
  const data = JSON.parse(res.data);

  if (data.error) {
    console.error('Error:', data.error.message);
    unsubscribeFromTicks(); // Disconnect on error
    return;
  }

  if (data.msg_type === 'tick') {
    const quote = data.tick.quote;
    const lastDigit = quote % 10;
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

const subscribeToTicks = () => {
  connection.addEventListener('message', handleTickResponse);
  api.subscribe(ticks_request);
};

const unsubscribeFromTicks = () => {
  connection.removeEventListener('message', handleTickResponse);
  api.unsubscribe(ticks_request);
};

const startButton = document.querySelector('#startTracking');
const stopButton = document.querySelector('#stopTracking');

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
window.addEventListener('unload', () => {
  unsubscribeFromTicks();
  api.disconnect();
});
