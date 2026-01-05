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

  // GSAP Animations for UI elements
  // Animate menu button entrance
  gsap.from("#menu-btn", {
    duration: 0.8,
    x: -100,
    opacity: 0,
    ease: "power3.out",
    delay: 0.2
  });

  // Animate side panel entrance
  gsap.from("#side-panel", {
    duration: 1,
    x: -300,
    opacity: 0,
    ease: "power3.out",
    delay: 0.4
  });

  // Animate tab buttons with stagger for symmetry
  gsap.from(".tab-btn", {
    duration: 0.6,
    y: 50,
    opacity: 0,
    ease: "back.out(1.7)",
    stagger: 0.1,
    delay: 0.6
  });

  // Add hover animations for tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      gsap.to(btn, {
        duration: 0.3,
        scale: 1.05,
        ease: "power2.out"
      });
    });

    btn.addEventListener("mouseleave", () => {
      gsap.to(btn, {
        duration: 0.3,
        scale: 1,
        ease: "power2.out"
      });
    });

    // Add click animation
    btn.addEventListener("click", () => {
      gsap.to(btn, {
        duration: 0.1,
        scale: 0.95,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut"
      });
    });
  });

  // Animate panel close button
  gsap.from("#panel-close", {
    duration: 0.5,
    rotation: -180,
    opacity: 0,
    ease: "back.out(1.7)",
    delay: 0.8
  });

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
    // Animate panel opening
    gsap.to(sidePanel, {
      duration: 0.4,
      x: 0,
      ease: "power3.out"
    });
    // Animate menu button disappearing
    gsap.to(menuBtn, {
      duration: 0.3,
      opacity: 0,
      scale: 0.8,
      ease: "power2.in",
      onComplete: () => {
        menuBtn.style.display = 'none';
      }
    });
  };
  closeBtn.onclick = () => {
    // Animate panel closing
    gsap.to(sidePanel, {
      duration: 0.4,
      x: -300,
      ease: "power3.in",
      onComplete: () => {
        sidePanel.classList.remove("open");
        sidePanel.style.transform = 'translateX(-100%)';
      }
    });
    // restore hamburger when panel closed
    menuBtn.style.display = '';
    gsap.fromTo(menuBtn, 
      { opacity: 0, scale: 0.8 },
      { 
        duration: 0.3, 
        opacity: 1, 
        scale: 1, 
        ease: "power2.out",
        delay: 0.2
      }
    );
  };

tabs.forEach(btn => {
    btn.onclick = () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Hide all panels first with animation
      const panels = ["auto-analysis", "smart-over-under", "even-odd-panel"];
      panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel && panel.style.display !== "none") {
          gsap.to(panel, {
            duration: 0.3,
            opacity: 0,
            y: 20,
            ease: "power2.in",
            onComplete: () => {
              panel.style.display = "none";
            }
          });
        }
      });

      // Show selected panel with animation
      let targetPanel;
      if (btn.dataset.tab === "auto") {
        targetPanel = document.getElementById("auto-analysis");
        // Auto Analysis gets all form elements
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "smart") {
        targetPanel = document.getElementById("smart-over-under");
        // Smart Over/Under gets all form elements
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "even-odd") {
        targetPanel = document.getElementById("even-odd-panel");
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

      // Animate panel appearance with symmetry
      if (targetPanel) {
        targetPanel.style.display = "block";
        gsap.fromTo(targetPanel, 
          { opacity: 0, y: 30, scale: 0.95 },
          { 
            duration: 0.5, 
            opacity: 1, 
            y: 0, 
            scale: 1, 
            ease: "back.out(1.7)",
            onComplete: () => {
              // Animate form elements within the panel
              const formElements = targetPanel.querySelectorAll('input, select, button, .field, .toggle-container');
              gsap.fromTo(formElements, 
                { opacity: 0, y: 20 },
                { 
                  duration: 0.4,
                  opacity: 1,
                  y: 0,
                  stagger: 0.05,
                  ease: "power2.out"
                }
              );
            }
          }
        );
      }

      // Animate panel closing
      gsap.to(sidePanel, {
        duration: 0.4,
        x: -300,
        ease: "power3.in",
        onComplete: () => {
          sidePanel.classList.remove("open");
          sidePanel.style.transform = 'translateX(-100%)';
        }
      });

      // restore hamburger after choosing a tab
      menuBtn.style.display = '';
      gsap.fromTo(menuBtn, 
        { opacity: 0, scale: 0.8 },
        { 
          duration: 0.3, 
          opacity: 1, 
          scale: 1, 
          ease: "power2.out",
          delay: 0.2
        }
      );
    };
  });
});