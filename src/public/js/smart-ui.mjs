document.addEventListener("DOMContentLoaded", () => {
  // Create hamburger + panel dynamically
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menu-btn">☰</div>
    <div id="balance-container">
      <span id="balance-amount">Loading...</span>
    </div>
    <div id="side-panel">
      <div class="panel-header">
        <div class="social-icons">
          <a href="https://wa.me/254757384487" target="_blank" rel="noopener noreferrer" class="social-link whatsapp">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
          <a href="https://t.me/zodiacalgotrade" target="_blank" rel="noopener noreferrer" class="social-link telegram">
            <i class="fa-brands fa-telegram"></i>
          </a>
        </div>
        <span id="panel-close">✕</span>
      </div>
      <div class="panel-tabs">
        <div class="tab-btn-wrapper">
          <button class="tab-btn active" data-tab="auto">Auto Analysis</button>
          <span class="info-icon" data-strategy="auto">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="smart">Smart Over/Under</button>
          <span class="info-icon" data-strategy="smart">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="even-odd">Even/Odd Switch</button>
          <span class="info-icon" data-strategy="even-odd">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="super-matches">Super Matches</button>
          <span class="info-icon" data-strategy="super-matches">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="simple-differs">Simple Differs</button>
          <span class="info-icon" data-strategy="simple-differs">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="sharp-recovery">Sharp Recovery</button>
          <span class="info-icon" data-strategy="sharp-recovery">!</span>
        </div>
        <div class="tab-btn-wrapper">
          <button class="tab-btn" data-tab="sniper-rise-fall">Sniper Rise/Fall</button>
          <span class="info-icon" data-strategy="sniper-rise-fall">!</span>
        </div>
      </div>
    </div>
  `);

  const menuBtn = document.getElementById("menu-btn");
  const sidePanel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  const tabs = document.querySelectorAll(".tab-btn");
  const infoIcons = document.querySelectorAll(".info-icon");

  const explanations = {
    "auto": `
      <p><strong>Auto Analysis</strong> is a hands-free trading mode that reads the market's pulse for you.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>It scans recent price movements to determine if the market is currently trending upwards or downwards. Once it identifies a strong trend, it automatically places trades in that direction.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Market & Submarket:</strong> Choose the specific asset you want the system to continuously analyze.</li>
        <li style="margin-bottom: 5px;"><strong>Stake:</strong> The amount of money you are risking per trade.</li>
      </ul>`,
    "smart": `
      <p><strong>Smart Over/Under</strong> predicts if the next digit will fall above or below your chosen thresholds based on recent patterns.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>The system tracks the final digit of the last several price quotes. It looks for patterns where digits are consistently low (to trigger an 'Under' trade) or consistently high (to trigger an 'Over' trade).</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>OVER &lt; / UNDER &gt;:</strong> Select the target digits. If you pick OVER 5, the system bets the next digit will be greater than 5.</li>
        <li style="margin-bottom: 5px;"><strong>Target Trades:</strong> Number of trades to execute before stopping.</li>
        <li style="margin-bottom: 5px;"><strong>Martingale:</strong> When activated, the system increases your stake after a loss to recover funds upon your next win.</li>
        <li style="margin-bottom: 5px;"><strong>AI Predict:</strong> Uses a stricter 2-tick confirmation rule before entering a trade for higher accuracy.</li>
      </ul>`,
    "even-odd": `
      <p><strong>Even/Odd Switch</strong> waits for a streak of similar numbers and bets that the pattern will break.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>If the market produces several 'Even' numbers in a row, the system assumes an 'Odd' number is due next, and places an Odd trade. It does the exact same in reverse for 'Odd' streaks.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Target Trades:</strong> How many trades you want to win before the system stops automatically.</li>
        <li style="margin-bottom: 5px;"><strong>Martingale:</strong> Recovers losses by multiplying your stake after a losing trade.</li>
        <li style="margin-bottom: 5px;"><strong>Single vs Bulk:</strong> 'Single' executes one trade at a time, while 'Bulk' places multiple trades concurrently when a signal appears.</li>
      </ul>`,
    "super-matches": `
      <p><strong>Super Matches</strong> identifies the single most frequent digit in the recent market and bets that it will appear again.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>It analyzes a rolling window of past ticks to find the "hottest" digit. If that digit's frequency meets your minimum requirement, it places a 'Matches' trade. If the trade loses, it quickly places a 'Differs' hedge trade as safety.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Min Frequency (%):</strong> The hottest digit must appear at least this often to trigger a trade.</li>
        <li style="margin-bottom: 5px;"><strong>Max Attempts:</strong> The maximum number of match trades before taking a break.</li>
        <li style="margin-bottom: 5px;"><strong>Volatility Limit:</strong> Pauses trading if the market becomes too chaotic or unpredictable.</li>
      </ul>`,
    "simple-differs": `
      <p><strong>Simple Differs</strong> leverages the very high probability that the next digit will NOT be a specific number you choose.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>You select a digit (0-9). The system continuously monitors the market. Whenever your chosen digit appears in the live feed, the system instantly bets that the <em>next</em> digit will be different.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Digit Differs:</strong> The specific number you want to avoid matching.</li>
        <li style="margin-bottom: 5px;"><strong>Target Trades:</strong> Number of successful trades desired before stopping.</li>
        <li style="margin-bottom: 5px;"><strong>Martingale Multiplier:</strong> Because Differ trades have low payouts (around 9%), the multiplier here must be high (e.g., 11x) to recover a loss.</li>
      </ul>`,
    "sharp-recovery": `
      <p><strong>Sharp Recovery</strong> is a heavy-duty system allowing you to run multiple customized strategies simultaneously, backed by an aggressive recovery plan.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>Set up two "Primary" strategies (e.g., Rise/Fall and Even/Odd) to run actively. If a primary trade is lost, the system switches to your customized "Recovery" strategies with an increased stake to aggressively win back your balance.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Primary & Recovery Slots:</strong> Assign specific logic rules (like Over/Under or Matches/Differs) to each slot.</li>
        <li style="margin-bottom: 5px;"><strong>Barriers:</strong> Depending on the logic, set the specific target digits or limits that trigger the trades.</li>
        <li style="margin-bottom: 5px;"><strong>Martingale:</strong> Controls how aggressively the stake increases during the recovery phase.</li>
      </ul>`,
    "sniper-rise-fall": `
      <p><strong>Sniper Rise/Fall</strong> is a highly patient strategy that waits for a clear breakout in market momentum before striking.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">How It Works</h4>
      <p>It monitors a rolling window of the last 6 price ticks. It will only place a 'Rise' (Call) trade if the current price is the absolute highest in that window AND has strong upward momentum. Conversely, it places a 'Fall' (Put) trade at the absolute minimum with downward momentum.</p>
      <h4 style="margin: 15px 0 5px; color: #00bbf0; font-size: 1.1rem;">Components</h4>
      <ul style="margin: 5px 0 15px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 5px;"><strong>Target Operations:</strong> Total number of confirmed trades to execute.</li>
        <li style="margin-bottom: 5px;"><strong>Martingale Recovery:</strong> Automatically raises the stake after a missed "sniper shot" to recover the capital on the next attempt.</li>
      </ul>`
  };

  function showStrategyPopup(strategy) {
    const overlay = document.createElement("div");
    overlay.className = "info-popup-overlay";
    overlay.innerHTML = `
      <div class="info-popup">
        <span class="info-popup-close">✕</span>
        <h3>${strategy.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}</h3>
        <div class="strategy-details" style="font-size: 0.95rem; line-height: 1.5;">${explanations[strategy]}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".info-popup-close").onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
  }

  infoIcons.forEach(icon => {
    icon.onclick = (e) => {
      e.stopPropagation();
      showStrategyPopup(icon.dataset.strategy);
    };
  });

  // Close side panel when clicking outside
  document.addEventListener("click", (e) => {
    if (sidePanel.classList.contains("open") &&
      !sidePanel.contains(e.target) &&
      e.target !== menuBtn) {
      sidePanel.classList.remove("open");
      menuBtn.style.display = '';
    }
  });

  // Detect whether the menu/hamburger is positioned on the right side of the
  // viewport and toggle a `body.menu-right` class so CSS can mirror offsets.
  function updateMenuSide() {
    const rect = menuBtn.getBoundingClientRect();
    if (rect.left > window.innerWidth / 2) {
      document.body.classList.add('menu-right');
    } else {
      document.body.classList.remove('menu-right');
    }
  }
  updateMenuSide();
  window.addEventListener('resize', updateMenuSide);

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    sidePanel.classList.add("open");
    // hide hamburger while side panel is open
    menuBtn.style.display = 'none';
  };
  closeBtn.onclick = () => {
    sidePanel.classList.remove("open");
    // restore hamburger when panel closed
    menuBtn.style.display = '';
  };

  tabs.forEach(btn => {
    btn.onclick = () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Hide all panels first
      document.getElementById("auto-analysis").style.display = "none";
      document.getElementById("smart-over-under").style.display = "none";
      document.getElementById("even-odd-panel").style.display = "none";
      const smPanel = document.getElementById("super-matches-panel");
      if (smPanel) smPanel.style.display = "none";
      const sdPanel = document.getElementById("simple-differs-panel");
      if (sdPanel) sdPanel.style.display = "none";
      const srPanel = document.getElementById("sharp-recovery-panel");
      if (srPanel) srPanel.style.display = "none";
      const sniperPanel = document.getElementById("sniper-rise-fall-panel");
      if (sniperPanel) sniperPanel.style.display = "none";

      const resultsContainer = document.getElementById("results-container");
      if (resultsContainer) resultsContainer.style.display = "none";

      if (btn.dataset.tab === "auto") {
        document.getElementById("auto-analysis").style.display = "block";
        if (resultsContainer) resultsContainer.style.display = "block";
        // Auto Analysis gets all form elements
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "smart") {
        document.getElementById("smart-over-under").style.display = "block";
        // ONLY market and submarket, hide everything else (parity with Super Matches)
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      } else if (btn.dataset.tab === "even-odd") {
        document.getElementById("even-odd-panel").style.display = "block";
        // Even/Odd only gets market and submarket, hide everything else
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      } else if (btn.dataset.tab === "super-matches") {
        const smPanel = document.getElementById("super-matches-panel");
        if (smPanel) smPanel.style.display = "block";
        // Only gets market and submarket, hide everything else
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      } else if (btn.dataset.tab === "simple-differs") {
        const sdPanel = document.getElementById("simple-differs-panel");
        if (sdPanel) sdPanel.style.display = "block";
        // Only gets market and submarket, hide everything else
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      } else if (btn.dataset.tab === "sharp-recovery") {
        const srPanel = document.getElementById("sharp-recovery-panel");
        if (srPanel) srPanel.style.display = "block";
        // Only gets market and submarket, hide everything else
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      } else if (btn.dataset.tab === "sniper-rise-fall") {
        const sniperPanel = document.getElementById("sniper-rise-fall-panel");
        if (sniperPanel) sniperPanel.style.display = "block";
        // Only gets market and submarket, hide everything else
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      }

      // Dispatch custom event to notify strategy scripts that tab has changed
      window.dispatchEvent(new CustomEvent('tabChange', { detail: { tab: btn.dataset.tab } }));

      sidePanel.classList.remove("open");
      // restore hamburger after choosing a tab
      menuBtn.style.display = '';
    };
  });
});