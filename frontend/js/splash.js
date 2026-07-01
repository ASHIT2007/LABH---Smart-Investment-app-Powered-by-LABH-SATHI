document.addEventListener("DOMContentLoaded", () => {
  const splashScreen = document.getElementById("splash-screen");
  const mainUi = document.getElementById("main-ui-container");
  
  if (!splashScreen) return;

  // Ensure initial state
  if (mainUi) {
    mainUi.classList.add("app-hidden");
    // Remove the display block inline style that overrides flex layouts
    mainUi.style.display = ""; 
    
    // The inner #app is also display:none initially, we should make it visible 
    // so the container fade-in works on its contents.
    const innerApp = document.getElementById("app");
    if (innerApp) {
      innerApp.style.display = "block";
    }
  }

  // Phase 1: High-Impact Brand Reveal (0.0s - 1.8s)
  // Trigger the brand scale up
  requestAnimationFrame(() => {
    splashScreen.classList.add("splash-step-1");
  });

  // Sync Point: Loader fades in as logo nears peak scale
  setTimeout(() => {
    splashScreen.classList.add("splash-step-1-loader");
  }, 1200);

  // Check if we have the innerApp (dashboard header) to shift to
  const hasAppHeader = document.getElementById("app") !== null;

  // Phase 2: Synchronized Transition (1.8s - 2.8s)
  // Transition everything upward (ONLY if on the main app page)
  setTimeout(() => {
    if (hasAppHeader) {
      splashScreen.classList.add("splash-step-2");
    } else {
      // If on login, just fade out the brand block slightly or keep it centered
      splashScreen.querySelector(".splash-content").style.transition = "opacity 0.8s ease";
      splashScreen.querySelector(".splash-content").style.opacity = "0";
    }
  }, 1800);

  // Phase 3: Content Flow Integration (2.5s - 3.5s)
  // Main app content fades in with staggered delays
  setTimeout(() => {
    if (mainUi) {
      mainUi.classList.remove("app-hidden");
      mainUi.classList.add("app-visible");
    }
  }, 2500);

  // Finish: Cleanup splash screen completely (3.5s+)
  setTimeout(() => {
    splashScreen.classList.add("splash-complete");
    
    // Hard remove from DOM flow to ensure no pointer-event issues
    setTimeout(() => {
      splashScreen.style.display = "none";
    }, 800); // Wait for the opacity/backdrop-filter transition to finish
  }, 3500);
});
