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
      </div>
    </div>
  `);

  const menuBtn = document.getElementById("menu-btn");
  const sidePanel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  const tabs = document.querySelectorAll(".tab-btn");

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

      document.getElementById("auto-analysis").style.display =
        btn.dataset.tab === "auto" ? "block" : "none";

      document.getElementById("smart-over-under").style.display =
        btn.dataset.tab === "smart" ? "block" : "none";

      sidePanel.classList.remove("open");
      // restore hamburger after choosing a tab
      menuBtn.style.display = '';
    };
  });
});
