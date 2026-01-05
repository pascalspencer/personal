document.addEventListener("DOMContentLoaded", () => {
  // Create hamburger + panel dynamically
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menu-btn">☰</div>
    <div id="side-panel" style="visibility: visible; display: block;">
      <div class="panel-header" style="visibility: visible; display: block; opacity: 1;">
        <span id="panel-close" style="visibility: visible; display: block; opacity: 1;">✕</span>
      </div>
<div class="panel-tabs" style="visibility: visible; display: flex; opacity: 1; flex-direction: column;">
        <button class="tab-btn active" data-tab="auto" style="visibility: visible; display: block; opacity: 1; position: relative;">Auto Analysis</button>
        <button class="tab-btn" data-tab="smart" style="visibility: visible; display: block; opacity: 1; position: relative;">Smart Over/Under</button>
        <button class="tab-btn" data-tab="even-odd" style="visibility: visible; display: block; opacity: 1; position: relative;">Even/Odd Switch</button>
      </div>
    </div>
  `);

  // GSAP Animations for UI elements - Create timeline for smooth coordination
  const tl = gsap.timeline({ paused: false });
  
  // Set initial states to prevent glitching
  gsap.set("#menu-btn", { x: -100, opacity: 0 });
  gsap.set("#side-panel", { x: -300, opacity: 0 });
  gsap.set(".tab-btn", { y: 30, opacity: 0 });
  gsap.set("#panel-close", { rotation: -180, opacity: 0 });
  
  // Ensure panel is visible from start
  sidePanel.style.visibility = 'visible';
  closeBtn.style.visibility = 'visible';
  
  // Animate menu button entrance
  tl.to("#menu-btn", {
    duration: 0.6,
    x: 0,
    opacity: 1,
    ease: "power3.out"
  })
  
  // Animate side panel entrance
  .to("#side-panel", {
    duration: 0.8,
    x: 0,
    opacity: 1,
    ease: "power3.out"
  }, "-=0.3")
  
  // Animate tab buttons with stagger for symmetry
  .to(".tab-btn", {
    duration: 0.4,
    y: 0,
    opacity: 1,
    ease: "back.out(1.7)",
    stagger: 0.08
  }, "-=0.4")
  
  // Animate panel close button
  .to("#panel-close", {
    duration: 0.3,
    rotation: 0,
    opacity: 1,
    ease: "back.out(1.7)"
  }, "-=0.2");

  // Add smooth hover animations for tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    // Create hover timeline for each button
    const hoverTl = gsap.timeline({ paused: true });
    hoverTl.to(btn, {
      duration: 0.2,
      scale: 1.02,
      x: 5,
      ease: "power2.out"
    });
    
    btn.addEventListener("mouseenter", () => {
      if (!btn.classList.contains('no-hover')) {
        hoverTl.play();
      }
    });

    btn.addEventListener("mouseleave", () => {
      if (!btn.classList.contains('no-hover')) {
        hoverTl.reverse();
      }
    });

    // Add smooth click animation
    btn.addEventListener("click", () => {
      gsap.to(btn, {
        duration: 0.15,
        scale: 0.98,
        ease: "power2.inOut",
        onComplete: () => {
          gsap.to(btn, {
            duration: 0.15,
            scale: 1,
            ease: "power2.out"
          });
        }
      });
    });
  });

const menuBtn = document.getElementById("menu-btn");
  const sidePanel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  const tabs = document.querySelectorAll(".tab-btn");

  // Debug: Check if elements exist
  console.log('Menu button:', menuBtn);
  console.log('Side panel:', sidePanel);
  console.log('Close button:', closeBtn);
  console.log('Tabs found:', tabs.length);

  // Force panel content to be visible on load
  if (sidePanel) {
    const allPanelContent = sidePanel.querySelectorAll('*');
    allPanelContent.forEach(el => {
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });
  }

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
    
    // Kill any existing animations to prevent conflicts
    gsap.killTweensOf(sidePanel);
    gsap.killTweensOf(menuBtn);
    
    // Force panel and all content to be visible
    sidePanel.style.visibility = 'visible';
    sidePanel.style.display = 'block';
    
    // Force all panel content to be visible
    const panelContent = sidePanel.querySelectorAll('.panel-header, .panel-tabs, .tab-btn');
    panelContent.forEach(el => {
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.style.display = 'block';
    });
    
    // Create smooth opening timeline
    const openTl = gsap.timeline();
    
    // Animate panel opening
    openTl.fromTo(sidePanel, 
      { x: -300 },
      { 
        duration: 0.5,
        x: 0,
        ease: "power3.out"
      }
    )
    // Animate menu button disappearing
    .to(menuBtn, {
      duration: 0.3,
      opacity: 0,
      scale: 0.8,
      ease: "power2.in",
      onComplete: () => {
        menuBtn.style.display = 'none';
      }
    }, "-=0.3");
  };
  closeBtn.onclick = () => {
    // Kill any existing animations to prevent conflicts
    gsap.killTweensOf(sidePanel);
    gsap.killTweensOf(menuBtn);
    
    // Create smooth closing timeline
    const closeTl = gsap.timeline();
    
    // Animate panel closing
    closeTl.to(sidePanel, {
      duration: 0.5,
      x: -300,
      ease: "power3.in"
    })
    // Restore hamburger when panel closed
    .call(() => {
      menuBtn.style.display = '';
    })
    .fromTo(menuBtn, 
      { opacity: 0, scale: 0.8 },
      { 
        duration: 0.3, 
        opacity: 1, 
        scale: 1, 
        ease: "power2.out"
      }
    , "-=0.2")
    .call(() => {
      sidePanel.classList.remove("open");
      sidePanel.style.visibility = 'hidden';
      sidePanel.style.transform = 'translateX(-100%)';
    });
  };

tabs.forEach(btn => {
    btn.onclick = () => {
      // Prevent hover animations during click
      btn.classList.add('no-hover');
      
      // Update active states
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Kill any existing panel animations
      const panels = ["auto-analysis", "smart-over-under", "even-odd-panel"];
      panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
          gsap.killTweensOf(panel);
        }
      });

      // Create smooth tab switching timeline
      const switchTl = gsap.timeline();

      // Hide all panels first
      panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel && panel.style.display !== "none") {
          switchTl.to(panel, {
            duration: 0.2,
            opacity: 0,
            y: 10,
            ease: "power2.in",
            onComplete: () => {
              panel.style.display = "none";
            }
          }, 0);
        }
      });

      // Determine target panel and setup form elements
      let targetPanel;
      if (btn.dataset.tab === "auto") {
        targetPanel = document.getElementById("auto-analysis");
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "smart") {
        targetPanel = document.getElementById("smart-over-under");
        document.querySelectorAll("form > *").forEach(el => {
          if (el.id !== "market" && el.id !== "submarket") {
            el.style.display = "";
          }
        });
      } else if (btn.dataset.tab === "even-odd") {
        targetPanel = document.getElementById("even-odd-panel");
        const formElements = document.querySelectorAll("#trade-form > *");
        formElements.forEach(el => {
          if (el.id === "market" || el.id === "submarket") {
            el.style.display = "";
          } else {
            el.style.display = "none";
          }
        });
      }

      // Show selected panel
      if (targetPanel) {
        switchTl.call(() => {
          targetPanel.style.display = "block";
          gsap.set(targetPanel, { opacity: 0, y: 20, scale: 0.98 });
        })
        .to(targetPanel, {
          duration: 0.4,
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "back.out(1.7)"
        })
        .call(() => {
          // Animate form elements within the panel
          const formElements = targetPanel.querySelectorAll('input, select, button, .field, .toggle-container');
          gsap.fromTo(formElements,
            { opacity: 0, y: 15 },
            {
              duration: 0.3,
              opacity: 1,
              y: 0,
              stagger: 0.03,
              ease: "power2.out"
            }
          );
        });
      }

      // Close panel and restore menu
      switchTl.to(sidePanel, {
        duration: 0.4,
        x: -300,
        ease: "power3.in"
      }, "-=0.1")
      .call(() => {
        sidePanel.classList.remove("open");
        sidePanel.style.transform = 'translateX(-100%)';
        menuBtn.style.display = '';
      })
      .fromTo(menuBtn,
        { opacity: 0, scale: 0.8 },
        {
          duration: 0.3,
          opacity: 1,
          scale: 1,
          ease: "power2.out"
        }
      )
      .call(() => {
        // Re-enable hover animations
        setTimeout(() => {
          btn.classList.remove('no-hover');
        }, 100);
      });
    };
  });
});