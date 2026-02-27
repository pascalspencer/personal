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
    "auto": "Analyzes market trends and automatically places trades based on whether the market is going up or down.",
    "smart": "Predicts if the next digit will be higher or lower than a chosen number based on recent patterns.",
    "even-odd": "Waits for a streak of even or odd digits and then bets on the opposite, expecting a change.",
    "super-matches": "Finds the most common digit and bets on it to appear again, using a safety strategy if it loses.",
    "simple-differs": "Bets that the next digit will NOT be the same as the one you selected. Very high chance of winning.",
    "sharp-recovery": "An advanced system that uses multiple strategies and increased stakes representing a momentum breakout approach to quickly win back any losses.",
    "sniper-rise-fall": "Sniper Rise/Fall waits for a strong momentum breakout (reaching the highest/lowest price in a 6-tick window) before placing a trade, with recovery options."
  };

  function showStrategyPopup(strategy) {
    const overlay = document.createElement("div");
    overlay.className = "info-popup-overlay";
    overlay.innerHTML = `
      <div class="info-popup">
        <span class="info-popup-close">✕</span>
        <h3>${strategy.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}</h3>
        <p>${explanations[strategy]}</p>
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