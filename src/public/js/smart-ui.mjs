document.addEventListener("DOMContentLoaded", () => {
  // Create hamburger + panel dynamically
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menu-btn">☰</div>
    <div id="side-panel">
      <div class="panel-header">
        <span id="panel-close">✕</span>
      </div>
<div class="panel-tabs">
        <button class="tab-btn active" data-tab="auto">Auto Analysis</button>
        <button class="tab-btn" data-tab="smart">Smart Over/Under</button>
        <button class="tab-btn" data-tab="even-odd">Even/Odd Switch</button>
      </div>
    </div>
  `);

  const menuBtn = document.getElementById("menu-btn");
  const sidePanel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  const tabs = document.querySelectorAll(".tab-btn");

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

  menuBtn.onclick = () => {
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

      if (btn.dataset.tab === "auto") {
        document.getElementById("auto-analysis").style.display = "block";
        // Auto Analysis gets all form elements
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "smart") {
        document.getElementById("smart-over-under").style.display = "block";
        // Smart Over/Under gets all form elements
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
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
      }

      sidePanel.classList.remove("open");
      // restore hamburger after choosing a tab
      menuBtn.style.display = '';
    };
  });
});