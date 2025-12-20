document.addEventListener("DOMContentLoaded", () => {
  // Inject hamburger + side panel
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menu-btn">☰</div>
    <div id="side-panel">
      <div class="panel-header">
        <span id="panel-close">✕</span>
      </div>
      <div class="panel-tabs">
        <button class="tab-btn active" data-tab="auto">Auto Analysis</button>
        <button class="tab-btn" data-tab="smart">Smart Over/Under</button>
      </div>
    </div>
  `);

  const menuBtn = document.getElementById("menu-btn");
  const sidePanel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  const tabs = document.querySelectorAll(".tab-btn");

  // Detect menu position (left/right) for responsive offsets
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

  // Hamburger toggle
  menuBtn.onclick = () => {
    sidePanel.classList.add("open");
    menuBtn.style.display = 'none';
  };
  closeBtn.onclick = () => {
    sidePanel.classList.remove("open");
    menuBtn.style.display = '';
  };

  // Tab switching logic
  tabs.forEach(btn => {
    btn.onclick = async () => {
      // Update active state
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;

      // Hide both sections first
      const autoAnalysis = document.getElementById("auto-analysis");
      if (autoAnalysis) autoAnalysis.style.display = "none";

      const oldSmart = document.getElementById("smart-over-under");
      if (oldSmart) oldSmart.style.display = "none";

      // Show correct tab
      if (tab === "auto" && autoAnalysis) {
        autoAnalysis.style.display = "block";
      } else if (tab === "smart") {
        // Load Smart Over/Under dynamically only once
        let smartPanel = document.querySelector(".smart-panel");
        if (!smartPanel) {
          const response = await fetch("/smart-over-under.html");
          const html = await response.text();

          // Insert new Smart UI into body
          document.body.insertAdjacentHTML("beforeend", html);
          smartPanel = document.querySelector(".smart-panel");
        }

        if (smartPanel) {
          smartPanel.style.display = "flex"; // visible
          document.body.classList.add("smart-mode"); // for any CSS targeting
        }
      }

      // Close side panel after tab selection
      sidePanel.classList.remove("open");
      menuBtn.style.display = '';
    };
  });
});
