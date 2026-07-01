import { apiCall, getAuthUser, logout, setAuthUser } from "./api.js";
import { setupChat } from "./chat.js";

let currentUser = getAuthUser();
let marketData = [];
let watchlist = JSON.parse(localStorage.getItem("labh_watchlist") || "[]");
let marketSearchQuery = "";

// Currency helper: everything is converted to ₹ now
const cur = (stock) => "₹";

document.addEventListener("DOMContentLoaded", async () => {
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("app").style.display = "block";
  document.getElementById("navUserName").textContent = currentUser.name;
  const dropdownEmail = document.getElementById("dropdownEmail");
  if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
  
  // Dynamic greetings and clock
  updateGreeting(true);
  setInterval(updateClock, 1000);
  
  document.getElementById("logoutBtn").addEventListener("click", logout);

  const navProfilePic = document.getElementById("navProfilePic");
  const dropdownProfilePic = document.getElementById("dropdownProfilePic");
  const recProfilePic = document.getElementById("recProfilePic");
  const avatarUrl = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=22c55e&color=fff`;
  
  if (navProfilePic) {
    navProfilePic.src = avatarUrl;
  }
  if (dropdownProfilePic) {
    dropdownProfilePic.src = avatarUrl;
  }
  if (recProfilePic) {
    recProfilePic.src = avatarUrl;
  }

  // Profile Dropdown Toggle
  const profileBtn = document.getElementById("profileDropdownBtn");
  const profileMenu = document.getElementById("profileDropdownMenu");
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!profileMenu.contains(e.target)) {
        profileMenu.classList.add("hidden");
      }
    });
  }

  // Theme logic
  const savedTheme = localStorage.getItem("labh_theme") || "dark";
  document.body.dataset.theme = savedTheme;
  document.getElementById("themeToggleBtn").innerHTML =
    savedTheme === "dark"
      ? '<span class="material-symbols-outlined">light_mode</span>'
      : '<span class="material-symbols-outlined">dark_mode</span>';

  document.getElementById("themeToggleBtn").addEventListener("click", (e) => {
    const isDark = document.body.dataset.theme === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.body.dataset.theme = newTheme;
    e.currentTarget.innerHTML =
      newTheme === "dark"
        ? '<span class="material-symbols-outlined">light_mode</span>'
        : '<span class="material-symbols-outlined">dark_mode</span>';
    localStorage.setItem("labh_theme", newTheme);
  });

  setupMarketSearch();

  await fetchMe();
  fetchMarketsLoop();

  setupTabs();
  setupChat();
  setupRoast();
  setupDragAndDrop();

  // AI Widget toggle
  document.getElementById("aiWidgetBubble").addEventListener("click", () => {
    document.getElementById("aiWidgetPanel").classList.toggle("hidden");
  });

  // Commodities
  fetchCommoditiesLoop();
  setupCommodityFilters();

  // Benchmarks
  fetchBenchmarksLoop();

  // News
  fetchNewsLoop();

  // Sentiment Engine
  setupSentiment();
});

// --- DYNAMIC GREETINGS AND CLOCK ---
let currentSessionCategory = "";

function updateGreeting(force = false) {
  const name = currentUser ? currentUser.name : "Trader";
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour * 100 + minute;
  
  let session = "";
  let greetings = [];
  
  if (hour >= 5 && timeVal < 915) {
    session = "pre-market";
    greetings = [
      `Pre-market strategy, ${name}`,
      `Morning prep, ${name}`,
      `Rising pre-market, ${name}`,
      `Before the bell, ${name}`,
      `Good morning, ${name}`
    ];
  } else if (timeVal >= 915 && timeVal < 1530) {
    session = "market-hours";
    greetings = [
      `Active trading, ${name}`,
      `Live market session, ${name}`,
      `Trading hours, ${name}`,
      `Intraday charting, ${name}`,
      `Tracking trends, ${name}`
    ];
  } else if (timeVal >= 1530 && hour < 20) {
    session = "evening-review";
    greetings = [
      `Daily recap, ${name}`,
      `Post-market analysis, ${name}`,
      `Closing review, ${name}`,
      `Evening watch, ${name}`,
      `Reviewing performance, ${name}`
    ];
  } else if (hour >= 20) {
    session = "late-night";
    greetings = [
      `Late night research, ${name}`,
      `US market watch, ${name}`,
      `After-hours analysis, ${name}`,
      `Global markets review, ${name}`,
      `Late night charts, ${name}`
    ];
  } else { // hour >= 0 && hour < 5
    session = "overnight";
    greetings = [
      `Overnight futures watch, ${name}`,
      `Midnight market watch, ${name}`,
      `Asian pre-market prep, ${name}`,
      `Overnight analysis, ${name}`,
      `Night owl charting, ${name}`
    ];
  }
  
  if (session !== currentSessionCategory || force) {
    currentSessionCategory = session;
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    const welcomeHeadingEl = document.getElementById("welcomeHeading");
    if (welcomeHeadingEl) {
      welcomeHeadingEl.innerHTML = randomGreeting.replace(
        name,
        `<strong style="color: var(--text);">${name}</strong>`
      );
    }
  }
}

function updateClock() {
  const now = new Date();
  const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const timeString = now.toLocaleTimeString('en-US', optionsTime);
  
  const optionsDate = { weekday: 'long', month: 'short', day: 'numeric' };
  const dateString = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() + " • " + now.toLocaleDateString('en-US', optionsDate);
  
  const clockTimeEl = document.getElementById("liveClockTime");
  const clockDateEl = document.getElementById("liveClockDate");
  
  if (clockTimeEl) clockTimeEl.textContent = timeString;
  if (clockDateEl) {
    clockDateEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; color: var(--green); transform: rotate(${now.getSeconds() * 6}deg); transition: transform 0.5s ease; display: inline-block;">schedule</span> ${dateString}`;
  }
  
  // Keep the greeting session live and responsive to time shifts
  updateGreeting();
}

// --- COMMODITIES ---
let commoditiesData = [];
let commodityFilter = "all";

const CATEGORY_COLORS = {
  Energy: "#F97316",
  "Precious Metals": "#F7931A",
  "Base Metals": "#6366F1",
  Grains: "#22C55E",
  Softs: "#EC4899",
};

const CATEGORY_ICONS = {
  Energy: "local_gas_station",
  "Precious Metals": "diamond",
  "Base Metals": "hardware",
  Grains: "grass",
  Softs: "coffee",
};

async function fetchCommoditiesLoop() {
  try {
    commoditiesData = await apiCall("/commodities");
    renderCommodities();
  } catch (e) {
    console.error("Commodities fetch error:", e);
  }
  setTimeout(fetchCommoditiesLoop, 10000);
}

function renderCommodities() {
  const grid = document.getElementById("commoditiesGrid");
  if (!grid) return;

  const filtered =
    commodityFilter === "all"
      ? commoditiesData
      : commoditiesData.filter((c) => c.category === commodityFilter);

  grid.innerHTML = filtered
    .map((c) => {
      const isUp = c.change >= 0;
      const color = CATEGORY_COLORS[c.category] || "#8E929B";
      const icon = CATEGORY_ICONS[c.category] || "sell";
      
      // Handle US Cents (USd) vs US Dollars (USD)
      const priceInUSD = c.unit.startsWith("USd") ? c.price / 100 : c.price;
      
      // Our standard USD -> INR conversion rate is 0.012 (1 INR = 0.012 USD => 1 USD = 83.33 INR)
      const priceInInr = priceInUSD / 0.012;
      
      const currency = typeof window.getSetting === "function" ? window.getSetting("currency") : "INR";
      
      let displayUnit = c.unit;
      if (c.unit.includes("/")) {
        const parts = c.unit.split("/");
        // Convert 'USD' or 'USd' to the active currency name
        displayUnit = currency + "/" + parts[1];
      }

      let finalPriceInInr = priceInInr;
      let displayName = c.name;
      
      // Convert precious metals from oz to 10g (1 oz = 31.103 grams = 3.11034768 units of 10g)
      if (c.category === "Precious Metals") {
        finalPriceInInr = finalPriceInInr / 3.11034768;
        displayUnit = currency + "/10g";
        if (displayName.includes("Gold")) displayName = "Gold 24k";
      }

      const displayPrice = c.price > 0 ? window.formatPrice(finalPriceInInr) : "—";

      return `
        <div class="commodity-card" onclick="window.openCommodityModal('${c.sym}')" style="cursor: pointer; transition: all 0.2s;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="material-symbols-outlined" style="font-size:16px; color:${color};">${icon}</span>
                <span class="c-name">${displayName}</span>
            </div>
            <div class="c-unit">${displayUnit}</div>
            <div class="c-price" style="color: var(--text); font-family: var(--font-mono);">${displayPrice}</div>
            <div class="c-change tint-${isUp ? "up" : "down"}">${c.price > 0 ? (isUp ? "+" : "") + c.change.toFixed(2) + "%" : "Loading..."}</div>
        </div>`;
    })
    .join("");

  if (window.currentOpenCommodity) {
    window.openCommodityModal(window.currentOpenCommodity);
  }
}

function setupCommodityFilters() {
  const container = document.getElementById("commodityFilters");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    container
      .querySelectorAll(".range-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    commodityFilter = btn.dataset.cat;
    renderCommodities();
  });
}

// --- MARKET BENCHMARKS ---
let benchmarksData = [];

async function fetchBenchmarksLoop() {
  try {
    benchmarksData = await apiCall("/benchmarks");
    renderBenchmarks();
  } catch (e) {
    console.error("Benchmarks fetch error:", e);
  }
  setTimeout(fetchBenchmarksLoop, 15000); // refresh every 15s
}

function renderBenchmarks() {
  const container = document.getElementById("benchmarkContainer");
  if (!container || !benchmarksData.length) return;

  container.innerHTML = benchmarksData.map(b => {
    const isUp = b.change >= 0;
    const colorClass = isUp ? "var(--green)" : "var(--red)";
    const icon = isUp ? "arrow_drop_up" : "arrow_drop_down";
    const sign = isUp ? "+" : "";
    
    // For benchmarks, let's format the value cleanly with commas
    const formattedPrice = b.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // We don't have absolute points change easily without calculating it back, 
    // but we have percentage. We'll just show percentage change.
    // Let's approximate points change based on percentage.
    const pointsChange = ((b.change / 100) * b.price).toFixed(2);
    const absPointsChange = Math.abs(pointsChange);

    return `
      <div class="glass-card stat-card" style="padding: 16px;">
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px; font-weight: 600;">${b.name}</div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
              <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text);">${formattedPrice}</div>
              <div style="font-size: 13px; font-weight: 600; color: ${colorClass}; display: flex; align-items: center;">
                  <span class="material-symbols-outlined" style="font-size: 14px;">${icon}</span> 
                  ${absPointsChange} (${sign}${b.change.toFixed(2)}%)
              </div>
          </div>
      </div>
    `;
  }).join("");
}

// --- STOCK NEWS ---
async function fetchNewsLoop() {
  try {
    const news = await apiCall("/news");
    renderNews(news);
  } catch (e) {
    console.error("News fetch error:", e);
  }
  setTimeout(fetchNewsLoop, 60000); // Refresh every 60s
}

function showToast(message, type = "success") {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  const color = type === "error" ? "var(--red)" : "var(--green)";
  const icon = type === "error" ? "error" : "check_circle";
  toast.style.borderLeft = `4px solid ${color}`;
  toast.innerHTML = `<span class="material-symbols-outlined" style="color:${color}">${icon}</span> 
            <span>${message}</span>`;
  tc.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function renderNews(news) {
  const grid = document.getElementById("stockNewsGrid");
  if (!grid || !news.length) return;

  // Show up to 6 cards
  const items = news.slice(0, 6);

  grid.innerHTML = items
    .map((item) => {
      const stock = item.stock;
      let logoHTML;
      if (stock && stock.logo) {
        logoHTML = `<img src="${stock.logo}" class="news-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="news-logo-fallback" style="display:none;">${stock.sym[0]}</div>`;
      } else if (stock) {
        logoHTML = `<div class="news-logo-fallback">${stock.sym[0]}</div>`;
      } else {
        logoHTML = `<div class="news-logo-fallback"><span class="material-symbols-outlined" style="font-size:20px; color:var(--muted);">article</span></div>`;
      }

      const name = stock ? stock.name : item.source || "Market News";
      const isUp = stock ? stock.change >= 0 : true;
      const changeHTML = stock
        ? `<span class="news-change tint-${isUp ? "up" : "down"}">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</span>`
        : "";

      return `
        <a href="${item.link}" target="_blank" rel="noopener" class="news-card">
            <div class="news-header">
                <div style="display:flex; gap:12px; align-items:center;">
                    ${logoHTML}
                    <span class="news-stock-name">${name}</span>
                </div>
                ${changeHTML}
            </div>
            <div class="news-snippet">${item.title}</div>
            <div class="news-time">${timeAgo(item.pubDate)}</div>
        </a>`;
    })
    .join("");
}

// --- SENTIMENT ENGINE ---
let sentimentData = null;
let sentimentLoading = false;

async function fetchSentiment() {
  if (sentimentLoading) return;
  sentimentLoading = true;

  const btn = document.getElementById("sentimentRefreshBtn");
  const grid = document.getElementById("sentimentHeadlines");
  const needle = document.getElementById("sentimentNeedle");

  // Visual feedback
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<span class="material-symbols-outlined" style="font-size: 16px; animation: chartSpin 0.8s linear infinite;">refresh</span> Analyzing...';
  }
  
  if (needle) {
    needle.style.animation = "needleScan 1.2s ease-in-out infinite alternate";
  }

  // Show skeleton while loading
  const summaryEl = document.getElementById("sentimentSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="skeleton" style="height: 16px; width: 100%; border-radius: 4px; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 16px; width: 95%; border-radius: 4px; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 16px; width: 85%; border-radius: 4px; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 16px; width: 60%; border-radius: 4px;"></div>
    `;
  }

  const barBull = document.getElementById("sentimentBarBull");
  const barNeutral = document.getElementById("sentimentBarNeutral");
  const barBear = document.getElementById("sentimentBarBear");
  
  if (barBull && barNeutral && barBear) {
    barBull.classList.add("skeleton");
    barNeutral.classList.add("skeleton");
    barBear.classList.add("skeleton");
    
    barBull.style.background = "none";
    barNeutral.style.background = "none";
    barBear.style.background = "none";
    
    barBull.style.width = "33%";
    barNeutral.style.width = "34%";
    barBear.style.width = "33%";
  }

  const breakdownText = document.getElementById("sentimentBreakdownText");
  if (breakdownText) breakdownText.textContent = "— / — / —";
  
  document.getElementById("sentimentBullCount").textContent = "0";
  document.getElementById("sentimentNeutralCount").textContent = "0";
  document.getElementById("sentimentBearCount").textContent = "0";

  if (grid && !sentimentData) {
    grid.innerHTML = Array(4)
      .fill(
        `<div class="sentiment-card" style="height: 180px;">
            <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                <div>
                    <div class="skeleton" style="height: 20px; width: 80%; border-radius: 4px; margin-bottom: 8px;"></div>
                    <div class="skeleton" style="height: 20px; width: 60%; border-radius: 4px; margin-bottom: 16px;"></div>
                    <div class="skeleton" style="height: 12px; width: 40%; border-radius: 4px;"></div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px;">
                    <div style="flex: 1; display: flex; gap: 4px;">
                        <div class="skeleton" style="height: 16px; width: 40px; border-radius: 4px;"></div>
                        <div class="skeleton" style="height: 16px; width: 60px; border-radius: 4px;"></div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                        <span style="font-size: 13px; font-weight: 700; color: var(--muted); opacity: 0.5;">Confidence</span>
                        <div class="ring-indicator spinning-loader" style="--pct: 20%; --color: var(--muted);">
                            <span style="opacity: 0;"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
      )
      .join("");
  }

  try {
    const [data] = await Promise.all([
      apiCall("/sentiment"),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
    sentimentData = data;
    renderSentiment();
  } catch (e) {
    console.error("Sentiment fetch error:", e);
    if (grid)
      grid.innerHTML = `<div style="text-align:center; color:var(--muted); padding: 40px; grid-column: 1 / -1;">
            <span class="material-symbols-outlined" style="font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.5;">sentiment_dissatisfied</span>
            Failed to load sentiment analysis. Try again later.
        </div>`;
  } finally {
    sentimentLoading = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<span class="material-symbols-outlined" style="font-size: 16px;">refresh</span> Re-Analyze';
    }
    const needle = document.getElementById("sentimentNeedle");
    if (needle) {
      needle.style.animation = "none";
    }
  }
}

function renderSentiment() {
  if (!sentimentData) return;

  const {
    headlines,
    overallMood,
    moodScore,
    marketSummary,
    analyzedAt,
    aiPowered,
  } = sentimentData;

  // Gauge
  const scoreDisplay = document.getElementById("sentimentScoreDisplay");
  const moodLabel = document.getElementById("sentimentMoodLabel");
  const timestamp = document.getElementById("sentimentTimestamp");

  if (scoreDisplay) scoreDisplay.textContent = moodScore;

  // Determine zone label and color based on score
  let zoneName, moodColor;
  if (moodScore <= 20) {
    zoneName = "Strong Sell";
    moodColor = "#ea3943";
  } else if (moodScore <= 40) {
    zoneName = "Sell";
    moodColor = "#ea7b7b";
  } else if (moodScore <= 60) {
    zoneName = "Neutral";
    moodColor = "#b0b0b0";
  } else if (moodScore <= 80) {
    zoneName = "Buy";
    moodColor = "#6bc8a0";
  } else {
    zoneName = "Strong Buy";
    moodColor = "#16c784";
  }

  if (moodLabel) {
    moodLabel.textContent = zoneName;
    moodLabel.style.color = moodColor;
  }

  // Needle rotation: score 0 → -90° (left), score 100 → +90° (right)
  const needle = document.getElementById("sentimentNeedle");
  if (needle) {
    const angle = -90 + (moodScore / 100) * 180;
    needle.style.transform = `rotate(${angle}deg)`;
  }

  if (timestamp && analyzedAt) {
    timestamp.textContent = `Analyzed ${timeAgo(analyzedAt)}`;
  }

  // Summary
  const summary = document.getElementById("sentimentSummary");
  if (summary)
    summary.textContent =
      marketSummary || "AI summary available when GROQ_API_KEY is configured.";


  // AI Badge
  const aiBadge = document.getElementById("sentimentAiBadge");
  if (aiBadge) aiBadge.style.display = aiPowered ? "inline-flex" : "none";

  // Breakdown Stats
  const bullCount = headlines.filter((h) => h.sentiment === "bullish").length;
  const bearCount = headlines.filter((h) => h.sentiment === "bearish").length;
  const neutralCount = headlines.filter((h) => h.sentiment === "neutral").length;
  const total = headlines.length || 1;

  document.getElementById("sentimentBullCount").textContent = bullCount;
  document.getElementById("sentimentNeutralCount").textContent = neutralCount;
  document.getElementById("sentimentBearCount").textContent = bearCount;
  document.getElementById("sentimentBreakdownText").textContent =
    `${bullCount}B / ${neutralCount}N / ${bearCount}Be`;

  // Breakdown bar widths
  const barBull = document.getElementById("sentimentBarBull");
  const barNeutral = document.getElementById("sentimentBarNeutral");
  const barBear = document.getElementById("sentimentBarBear");
  
  barBull.classList.remove("skeleton");
  barNeutral.classList.remove("skeleton");
  barBear.classList.remove("skeleton");
  
  barBull.style.background = "var(--green)";
  barNeutral.style.background = "var(--muted)";
  barBear.style.background = "var(--red)";

  barBull.style.width = `${(bullCount / total) * 100}%`;
  barNeutral.style.width = `${(neutralCount / total) * 100}%`;
  barBear.style.width = `${(bearCount / total) * 100}%`;

  // Headline Cards
  const grid = document.getElementById("sentimentHeadlines");
  if (!grid) return;

  grid.innerHTML = headlines
    .map((h) => {
      const sentColor =
        h.sentiment === "bullish"
          ? "var(--green)"
          : h.sentiment === "bearish"
            ? "var(--red)"
            : "var(--muted)";
      const sentIcon =
        h.sentiment === "bullish"
          ? "trending_up"
          : h.sentiment === "bearish"
            ? "trending_down"
            : "trending_flat";
      const confPct = Math.round(h.confidence * 100);
      const stockTag = h.stock
        ? `<span style="font-size: 11px; color: var(--accent); font-weight: 600;">${h.stock.sym}</span>`
        : "";
      const keywordsHTML = (h.keywords || [])
        .map((k) => `<span class="keyword-tag">${k}</span>`)
        .join("");

      return `
        <a href="${h.link}" target="_blank" rel="noopener" class="sentiment-card sentiment-${h.sentiment}" style="text-decoration: none; color: inherit;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 600; line-height: 1.5; margin-bottom: 2px; color: var(--text);">${h.title}</div>
                    <div style="font-size: 11px; color: var(--muted); display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                        <span>${h.source}</span>
                        <span>·</span>
                        <span>${timeAgo(h.pubDate)}</span>
                        ${stockTag ? `<span>·</span> ${stockTag}` : ""}
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: ${sentColor}20; color: ${sentColor}; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 22px; font-weight: 800; font-variation-settings: 'wght' 700;">${sentIcon}</span>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--muted); font-style: italic;">\"${h.reasoning}\"</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px;">
                ${keywordsHTML ? `<div class="sentiment-keywords" style="flex: 1;">${keywordsHTML}</div>` : `<div style="flex: 1;"></div>`}
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    <span style="font-size: 13px; font-weight: 700; color: var(--text);">Confidence</span>
                    <div class="ring-indicator" style="--pct: ${confPct}%; --color: ${sentColor};">
                        <span>${confPct}%</span>
                    </div>
                </div>
            </div>
        </a>`;
    })
    .join("");
}

function setupSentiment() {
  const btn = document.getElementById("sentimentRefreshBtn");
  if (btn)
    btn.addEventListener("click", () => {
      sentimentData = null;
      fetchSentiment();
    });

  // Lazy load: fetch on tab switch to Sentiment or Recommendations
  const origSwitchTab = window.switchTab;
  window.switchTab = (tabId) => {
    origSwitchTab(tabId);
    if (tabId === "sentiment" && !sentimentData && !sentimentLoading) {
      fetchSentiment();
    }
    if (tabId === "recommendations" && !window._recsLoaded) {
      fetchRecommendations();
    }
  };
}
// --- END SENTIMENT ENGINE ---

function setupDragAndDrop() {
  const container = document.getElementById("dashboardWidgets");
  if (!container) return;

  const savedOrder = JSON.parse(
    localStorage.getItem("labh_widget_order") || "[]",
  );
  if (savedOrder.length > 0) {
    savedOrder.forEach((id) => {
      const el = document.querySelector(`[data-widget-id="${id}"]`);
      if (el) container.appendChild(el);
    });
  }

  let draggedEl = null;

  container.addEventListener("dragstart", (e) => {
    draggedEl = e.target.closest(".dashboard-widget");
    if (draggedEl) setTimeout(() => (draggedEl.style.opacity = "0.5"), 0);
  });

  container.addEventListener("dragend", (e) => {
    if (draggedEl) draggedEl.style.opacity = "1";
    draggedEl = null;
    const newOrder = [...container.querySelectorAll(".dashboard-widget")].map(
      (el) => el.dataset.widgetId,
    );
    localStorage.setItem("labh_widget_order", JSON.stringify(newOrder));
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    const widget = e.target.closest(".dashboard-widget");

    if (draggedEl && widget && draggedEl !== widget) {
      if (afterElement == null) {
        container.appendChild(draggedEl);
      } else {
        container.insertBefore(draggedEl, afterElement);
      }
    }
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(
        '.dashboard-widget:not([style*="opacity: 0.5"])',
      ),
    ];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY },
    ).element;
  }
}

async function fetchMe() {
  try {
    const data = await apiCall(`/auth/me?email=${currentUser.email}`);
    currentUser = data.user;
    setAuthUser(currentUser);
    updateDashboardUI();
  } catch (e) {
    if (e.message === "Not found") logout();
  }
}

window.toggleWatchlist = (sym) => {
  if (watchlist.includes(sym)) {
    watchlist = watchlist.filter((s) => s !== sym);
  } else {
    watchlist.push(sym);
  }
  localStorage.setItem("labh_watchlist", JSON.stringify(watchlist));
  updateMarketsTable();
};

async function fetchMarketsLoop() {
  try {
    marketData = await apiCall("/markets");
    window.marketData = marketData; // Expose globally for chat.js
    updateMarketsTable();
  } catch (e) {
    console.error(e);
  }
  setTimeout(fetchMarketsLoop, 5000); // Poll purely for demonstration
}

function updateDashboardUI() {
  // Balances
  const displayBalance = window.formatPrice(currentUser.balance);
  document.getElementById("homeCash").textContent = displayBalance;
  const dropBal = document.getElementById("dropdownBalance");
  if (dropBal) dropBal.textContent = displayBalance;

  let portValue = 0;
  currentUser.portfolio.forEach((p) => {
    const mStock = marketData.find((m) => m.sym === p.ticker);
    portValue += p.qty * (mStock ? mStock.price : p.avgPrice);
  });
  document.getElementById("homePortfolioValue").textContent = window.formatPrice(portValue);

  // Update Portfolio Table
  const tbody = document.querySelector("#portfolioTable tbody");
  if (currentUser.portfolio.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No holdings yet.</td></tr>';
  } else {
    tbody.innerHTML = currentUser.portfolio
      .map((p) => {
        const currentPrice =
          marketData.find((m) => m.sym === p.ticker)?.price || p.avgPrice;
        const pl = (currentPrice - p.avgPrice) * p.qty;
        const isProfit = pl >= 0;
        return `
                <tr>
                    <td style="font-weight:bold;">${p.ticker}</td>
                    <td>${p.qty}</td>
                    <td style="font-family:var(--font-mono);">${window.formatPrice(p.avgPrice)}</td>
                    <td style="font-family:var(--font-mono);">${window.formatPrice(currentPrice)}</td>
                    <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isProfit ? "up" : "down"}">${isProfit ? "+" : ""}${window.formatPrice(pl)}</span></td>
                    <td><button class="trade-action-btn" onclick="window.openTradeModal('${p.ticker}', 'SELL')">Sell</button></td>
                </tr>
            `;
      })
      .join("");
  }

  // Update LIVE Order Book (New shared function)
  if (window.renderOrderBook) {
    window.renderOrderBook("all");
  }

  // Update Reports if initialized
  if (typeof renderReports === "function") {
    renderReports();
  }
}

// Reusable logo helper
function stockLogo(stock, size = 40) {
  if (stock.logo) {
    return `<img src="${stock.logo}" alt="${stock.sym}" style="width:${size}px; height:${size}px; border-radius:10px; object-fit:contain; background:#fff; border: 1px solid var(--border);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div style="display:none; width:${size}px; height:${size}px; border-radius:10px; background:var(--card-inset); align-items:center; justify-content:center; font-weight:bold; font-size:${Math.round(size * 0.45)}px; border: 1px solid var(--border); flex-shrink:0;">${stock.sym[0]}</div>`;
  }
  return `<div style="width:${size}px; height:${size}px; border-radius:10px; background:var(--card-inset); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:${Math.round(size * 0.45)}px; border: 1px solid var(--border); flex-shrink:0;">${stock.sym[0]}</div>`;
}

function updateMarketsTable() {
  // Movers List (Home tab)
  const homeMovers = document.getElementById("moversList");
  const top4 = [...marketData]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  homeMovers.innerHTML = top4
    .map((stock) => {
      const isUp = stock.change >= 0;
      return `
        <div class="mover-row">
            <div style="display:flex; gap:14px; align-items:center;">
                ${stockLogo(stock, 40)}
                <div onclick="window.openStockDetail('${stock.sym}')" class="symbol-link" style="cursor:pointer;">
                    <div style="font-weight:600; font-size:15px;">${stock.sym}</div>
                    <div style="font-size:12px; color:var(--muted);">${stock.name}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:600; font-size:15px; font-family:var(--font-mono);">${window.formatPrice(stock.price)}</div>
                <div class="tint-${isUp ? "up" : "down"}" style="font-size:12px; font-weight:600; font-family:var(--font-mono);">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</div>
            </div>
        </div>
        `;
    })
    .join("");

  // Market Overview horizontal scroller (Home Tab)
  const marketScroll = document.getElementById("marketOverviewList");
  marketScroll.innerHTML = [...marketData]
    .slice(0, 5)
    .map((stock) => {
      const isUp = stock.change >= 0;
      return `
        <div class="market-item" style="cursor:pointer;" onclick="window.openStockDetail('${stock.sym}')">
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                ${stockLogo(stock, 28)}
                <div style="font-size:13px; color:var(--muted); font-weight:600;">${stock.sym}</div>
            </div>
            <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; margin:4px 0;">${window.formatPrice(stock.price)}</div>
            <div class="tint-${isUp ? "up" : "down"}" style="font-size:13px; font-weight:600; font-family:var(--font-mono);">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</div>
        </div>
        `;
    })
    .join("");

  // Filtered Full Table (Markets tab)
  const ftbody = document.querySelector("#fullMarketTable tbody");
  const filteredMarket = marketData.filter(
    (m) =>
      m.sym.toLowerCase().includes(marketSearchQuery) ||
      m.name.toLowerCase().includes(marketSearchQuery),
  );

  const rowHTML = (stock) => {
    const isUp = stock.change >= 0;
    const isWatched = watchlist.includes(stock.sym);
    return `
            <tr>
                <td><button onclick="window.toggleWatchlist('${stock.sym}')" style="background:transparent; border:none; cursor:pointer; color: var(--${isWatched ? "gold" : "muted"}); transition: 0.2s; display: flex; align-items: center; justify-content: center;" title="Toggle Watchlist"><span class="material-symbols-outlined" style="font-size:24px; font-variation-settings: 'FILL' ${isWatched ? 1 : 0};">star</span></button></td>
                <td style="cursor:pointer;" onclick="window.openStockDetail('${stock.sym}')">
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${stockLogo(stock, 32)}
                        <div>
                            <div class="symbol-link" style="font-weight:bold;">${stock.sym}</div>
                            <div style="color:var(--muted); font-size:12px; font-weight:400;">${stock.name}</div>
                        </div>
                    </div>
                </td>
                <td style="font-family:var(--font-mono); font-weight:bold;">${window.formatPrice(stock.price)}</td>
                <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isUp ? "up" : "down"}">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</span></td>
                <td style="display:flex; gap:8px;">
                    <button class="trade-action-btn" onclick="window.openTradeModal('${stock.sym}', 'BUY')">Trade</button>
                </td>
            </tr>
        `;
  };

  ftbody.innerHTML = filteredMarket.map(rowHTML).join("");

  // Watchlist Table
  const wtbody = document.querySelector("#watchlistTable tbody");
  const wContainer = document.getElementById("watchlistContainer");
  const wHeader = document.getElementById("watchlistHeader");

  const watchedStocks = marketData.filter((m) => watchlist.includes(m.sym));
  if (watchedStocks.length > 0 && wContainer) {
    wContainer.classList.remove("hidden");
    wHeader.classList.remove("hidden");
    wtbody.innerHTML = watchedStocks.map(rowHTML).join("");
  } else if (wContainer) {
    wContainer.classList.add("hidden");
    wHeader.classList.add("hidden");
  }

  // Ticker Update
  const tickerContainer = document.getElementById("tickerContent");
  tickerContainer.innerHTML = marketData
    .map((stock) => {
      const isUp = stock.change >= 0;
      return `<div class="ticker-item"><span style="color:var(--muted)">${stock.sym}</span> <span style="font-family:var(--font-mono);">${window.formatPrice(stock.price)}</span> <span class="tint-${isUp ? "up" : "down"}">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</span></div>`;
    })
    .join("");
  // Duplicate for smooth infinite scrolling
  tickerContainer.innerHTML += tickerContainer.innerHTML;

  // Auto-update portfolio calculations since prices changed
  updateDashboardUI();
}

// Global Tab switcher
function updateNavIndicator() {
  const activeItem = document.querySelector(".nav-item.active");
  const indicator = document.getElementById("navIndicator");
  
  if (activeItem && indicator) {
    const left = activeItem.offsetLeft;
    const width = activeItem.offsetWidth;
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;
    indicator.style.opacity = '1';
  }
}

window.addEventListener('resize', updateNavIndicator);

window.switchTab = (tabId) => {
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".dashboard-wrap")
    .forEach((el) => el.classList.add("hidden"));

  const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navItem) navItem.classList.add("active");

  const target = document.getElementById(tabId + "Tab");
  if (target) target.classList.remove("hidden");

  // Animate the nav indicator capsule
  updateNavIndicator();

  // Specific tab initializers
  if (tabId === "reports") {
    renderReports();
  }
  if (tabId === "compare") {
    setupCompare();
  }
};

function setupTabs() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => switchTab(el.dataset.tab));
  });
  // Initialize indicator position
  setTimeout(updateNavIndicator, 100);
}

// Chat logic extracted to chat.js
// Roast
function setupRoast() {
  const btn = document.getElementById("roastBtn");
  const resultDiv = document.getElementById("roastResult");

  btn.addEventListener("click", async () => {
    if (currentUser.portfolio.length === 0)
      return alert("Your portfolio is empty. Nothing to roast!");
    btn.textContent = "Roasting...";
    try {
      const data = await apiCall("/roast", {
        method: "POST",
        body: JSON.stringify({ portfolio: currentUser.portfolio }),
      });
      resultDiv.classList.remove("hidden");
      resultDiv.innerHTML = `
        <div style="position: absolute; top: 12px; right: 12px; cursor: pointer; color: var(--muted); opacity: 0.7; transition: all 0.2s;" onmouseover="this.style.opacity='1'; this.style.color='var(--red)';" onmouseout="this.style.opacity='0.7'; this.style.color='var(--muted)';" onclick="this.parentElement.classList.add('hidden')">
          <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
        </div>
        <h3 style="color:var(--red); font-family:var(--font-head); margin-bottom:8px;">AI Roast:</h3>
        <p style="font-size:15px; line-height:1.6; margin-right: 30px;">${data.roastText}</p>
      `;
    } catch (e) {
      alert("Roast failed: " + e.message);
    } finally {
      btn.innerHTML =
        '<span class="material-symbols-outlined" style="font-size: 20px;">local_fire_department</span> Roast My Portfolio';
    }
  });
}

// Chart Instance
let currentChart = null;
let currentChartSymbol = null;
window.currentChartMode = 'candlestick';
const chartModes = ['candlestick', 'line', 'area', 'bar'];
const chartModeIcons = { 'candlestick': 'candlestick_chart', 'line': 'show_chart', 'area': 'area_chart', 'bar': 'bar_chart' };

async function loadChart(sym, range = "3mo", interval = "1d") {
  const container = document.getElementById("chartContainer");
  const loader = document.getElementById("chartLoader");
  const liveBadge = document.getElementById("chartLiveBadge");

  // Show loader
  if (loader) loader.style.display = "flex";
  if (liveBadge) liveBadge.style.display = "none";

  // Clean up previous chart
  if (currentChart) {
    currentChart.remove();
    currentChart = null;
  }
  // Remove any old chart canvas but keep the loader
  Array.from(container.children).forEach((child) => {
    if (child.id !== "chartLoader") child.remove();
  });

  const isDark = document.body.dataset.theme === "dark";

  // Market Closed Detection Removed as per User Request.
  // Charts will always attempt to load regardless of day/time.

  try {
    // Fetch data from our backend API
    const response = await apiCall(
      `/chart/${sym}?range=${range}&interval=${interval}`,
    );
    const candles = response.candles || [];
    const meta = response.meta || {};

    // Create the chart
    currentChart = LightweightCharts.createChart(container, {
      autoSize: true,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: isDark ? "#D9D9D9" : "#191919",
      },
      grid: {
        vertLines: {
          color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        },
        horzLines: {
          color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          style: 0,
          width: 1,
        },
        horzLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          style: 0,
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      },
      timeScale: {
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        timeVisible: interval.includes("m"),
      },
    });

    const cssGreen = getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#22c55e';
    const cssRed = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ef4444';
    
    let mainSeries;
    if (window.currentChartMode === 'line') {
      mainSeries = currentChart.addLineSeries({ color: cssGreen, lineWidth: 2 });
    } else if (window.currentChartMode === 'area') {
      mainSeries = currentChart.addAreaSeries({ lineColor: cssGreen, topColor: 'rgba(34, 197, 94, 0.4)', bottomColor: 'rgba(34, 197, 94, 0.0)', lineWidth: 2 });
    } else if (window.currentChartMode === 'bar') {
      mainSeries = currentChart.addBarSeries({ upColor: cssGreen, downColor: cssRed });
    } else {
      mainSeries = currentChart.addCandlestickSeries({ upColor: cssGreen, downColor: cssRed, borderVisible: false, wickUpColor: cssGreen, wickDownColor: cssRed });
    }
    currentChart.mainSeries = mainSeries;

    // Volume series (histogram below main series)
    const volumeSeries = currentChart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    if (candles.length > 0) {
      if (window.currentChartMode === 'line' || window.currentChartMode === 'area') {
        mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
      } else {
        mainSeries.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
      }

      // Set volume data with color
      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color:
            c.close >= c.open
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(239, 68, 68, 0.3)",
        })),
      );

      // Update price display with consistent live data
      const stockForCurrency = marketData.find(
        (m) => m.sym === currentChartSymbol,
      );
      if (stockForCurrency && !meta.mock) {
        const detailPrc = document.getElementById("detailPrc");
        const detailChg = document.getElementById("detailChg");
        const cs = "₹";
        
        // Use the live price and daily change from our central marketData store
        detailPrc.textContent = window.formatPrice(stockForCurrency.price);
        
        detailChg.textContent =
          (stockForCurrency.change >= 0 ? "+" : "") + stockForCurrency.change.toFixed(2) + "%";
        detailChg.className = `tint-${stockForCurrency.change >= 0 ? "up" : "down"}`;
        detailChg.style.color = "";

        if (liveBadge) liveBadge.style.display = "inline-block";
      }
    }

    // Fit content
    currentChart.timeScale().fitContent();
    setTimeout(() => {
      if (currentChart) currentChart.timeScale().fitContent();
    }, 150);
  } finally {
    if (loader) loader.style.display = "none";

    // Update "Last Updated" timestamp for Live charts
    const lastUpdatedEl = document.getElementById("chartLastUpdated");
    if (lastUpdatedEl && range === "1d") {
      const now = new Date();
      lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      lastUpdatedEl.style.display = "inline-block";
    } else if (lastUpdatedEl) {
      lastUpdatedEl.style.display = "none";
    }
  }

  // --- Live Polling Logic ---
  // Clear any existing interval
  if (window.liveChartInterval) {
    clearInterval(window.liveChartInterval);
    window.liveChartInterval = null;
  }

  // If it's 1D range, start polling every 30 seconds
  if (range === "1d") {
    window.liveChartInterval = setInterval(async () => {
      // Check if modal is still open before updating
      const modal = document.getElementById("stockDetailModal");
      if (
        modal &&
        !modal.classList.contains("hidden") &&
        currentChartSymbol === sym
      ) {
        // Fetch just the latest meta/price to update the chart efficiently
        try {
          const response = await apiCall(
            `/chart/${sym}?range=1d&interval=${interval}`,
          );
          const candles = response.candles || [];
          const meta = response.meta || {};

          if (candles.length > 0 && currentChart) {
            const series = currentChart.mainSeries;
            if (series) {
              if (window.currentChartMode === 'line' || window.currentChartMode === 'area') {
                series.setData(candles.map((c) => ({ time: c.time, value: c.close })));
              } else {
                series.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
              }
            }

            // Update price labels with consistent live data
            const stockForCurrency = marketData.find((m) => m.sym === sym);
            if (stockForCurrency) {
              const detailPrc = document.getElementById("detailPrc");
              const detailChg = document.getElementById("detailChg");
              const cs = "₹";
              
              detailPrc.textContent = window.formatPrice(stockForCurrency.price);
              detailChg.textContent = (stockForCurrency.change >= 0 ? "+" : "") + stockForCurrency.change.toFixed(2) + "%";
              detailChg.className = `tint-${stockForCurrency.change >= 0 ? "up" : "down"}`;
              detailChg.style.color = "";

              if (lastUpdatedEl) {
                lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString("en-IN")}`;
              }
            }
          }
        } catch (e) {
          console.warn("Live update failed:", e);
        }
      } else {
        clearInterval(window.liveChartInterval);
        window.liveChartInterval = null;
      }
    }, 30000); // 30 seconds
  }
}

window.openStockDetail = async (sym) => {
  const stock = marketData.find((m) => m.sym === sym);
  if (!stock) return;

  currentChartSymbol = sym;
  document.getElementById("stockDetailModal").classList.remove("hidden");

  // UI Updates
  document.getElementById("detailLogo").innerHTML = stockLogo(stock, 48);
  document.getElementById("detailSym").textContent = stock.sym;
  document.getElementById("detailName").textContent = stock.name;
  document.getElementById("detailPrc").textContent =
    window.formatPrice(stock.price);

  const chgEl = document.getElementById("detailChg");
  chgEl.textContent =
    (stock.change >= 0 ? "+" : "") + stock.change.toFixed(2) + "%";
  chgEl.className = `tint-${stock.change >= 0 ? "up" : "down"}`;
  chgEl.style.color = "";

  document.getElementById("detailTradeBtn").onclick = () => {
    openTradeModal(currentChartSymbol, "BUY");
  };

  document.getElementById("detailSellBtn").onclick = () => {
    openTradeModal(currentChartSymbol, "SELL");
  };

  // Quick Analysis via Labh Sathi
  document.getElementById("detailAnalyzeBtn").onclick = () => {
    // Open the AI chat panel and make it visible
    const chatPanel = document.getElementById("aiWidgetPanel");
    chatPanel.classList.remove("hidden");

    // Pre-fill and trigger AI search
    const chatInput = document.getElementById("chatInput");
    const chatSend = document.getElementById("chatSend");

    if (chatInput && chatSend) {
      chatInput.value = `Give me a quick analysis of ${currentChartSymbol} comparing its current price to moving trends. Is it looking bullish or bearish today?`;
      chatSend.click();
    }
  };

  document.getElementById("detailSipBanner").onclick = () => {
    showToast(`Systematic Investment Plan (SIP) for ${currentChartSymbol} is coming soon! This will allow you to automate regular investments.`, "success");
  };

  // Chart Type Toggle
  document.getElementById("chartTypeBtn").onclick = async () => {
    const currentIndex = chartModes.indexOf(window.currentChartMode);
    window.currentChartMode = chartModes[(currentIndex + 1) % chartModes.length];
    document.getElementById("chartTypeIcon").textContent = chartModeIcons[window.currentChartMode];
    
    const activeBtn = document.querySelector("#chartRangeButtons .range-btn.active");
    const range = activeBtn ? activeBtn.dataset.range : "3mo";
    const interval = activeBtn ? activeBtn.dataset.interval : "1d";
    await loadChart(currentChartSymbol, range, interval);
  };

  // Chart Maximize Toggle
  document.getElementById("chartMaximizeBtn").onclick = () => {
    const panel = document.getElementById("chartPanel");
    panel.classList.toggle("chart-maximized");
    const icon = document.querySelector("#chartMaximizeBtn span");
    icon.textContent = panel.classList.contains("chart-maximized")
      ? "fullscreen_exit"
      : "fullscreen";

    // Resize chart after transition
    setTimeout(() => {
      if (currentChart) {
        const container = document.getElementById("chartContainer");
        currentChart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
        currentChart.timeScale().fitContent();
      }
    }, 300); // Wait longer for full flex transition explicitly
  };

  // Deterministic Mock Data Generation for Tabs
  const seed = sym.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const rand = (min, max) =>
    min + (((seed * 9301 + 49297) % 233280) / 233280) * (max - min);

  // Performance Tab
  const dayLow = stock.price * (1 - rand(0.005, 0.02));
  const dayHigh = stock.price * (1 + rand(0.005, 0.02));
  document.getElementById("perfTodayLow").textContent = dayLow.toFixed(2);
  document.getElementById("perfTodayHigh").textContent = dayHigh.toFixed(2);
  const tPct = ((stock.price - dayLow) / (dayHigh - dayLow)) * 100;
  document.getElementById("perfTodayTrackerMarker").style.left =
    `${Math.min(Math.max(tPct, 0), 100)}%`;

  document.getElementById("detail52W").textContent = stock.week52High
    ? stock.week52High
    : "-";
  document.getElementById("detail52WLow").textContent = stock.week52Low
    ? stock.week52Low
    : "-";
  if (stock.week52High && stock.week52Low) {
    const wPct =
      ((stock.price - stock.week52Low) / (stock.week52High - stock.week52Low)) *
      100;
    document.getElementById("perf52wTrackerMarker").style.left =
      `${Math.min(Math.max(wPct, 0), 100)}%`;
  }

  document.getElementById("detailOpenPrice").textContent = (
    stock.price *
    (1 + rand(-0.01, 0.01))
  ).toFixed(2);
  document.getElementById("detailPrevClose").textContent = (
    stock.price - stock.change
  ).toFixed(2);
  document.getElementById("detailLowerCircuit").textContent = (
    stock.price * 0.8
  ).toFixed(2);
  document.getElementById("detailUpperCircuit").textContent = (
    stock.price * 1.2
  ).toFixed(2);

  // Fundamentals
  document.getElementById("detailMktCap").textContent = stock.mktCap || "N/A";
  document.getElementById("detailPE").textContent = stock.peRatio || "N/A";
  document.getElementById("detailVol").textContent = stock.volume || "N/A";
  const pbRatio = rand(1, 10).toFixed(2);
  document.getElementById("detailPB").textContent = pbRatio;
  const indPe = stock.peRatio
    ? (stock.peRatio * rand(0.8, 1.2)).toFixed(2)
    : "15.00";
  document.getElementById("detailIndPE").textContent = indPe;
  document.getElementById("detailDebtEq").textContent = rand(0.1, 2.0).toFixed(
    2,
  );
  document.getElementById("detailROE").textContent =
    rand(5, 30).toFixed(2) + "%";
  document.getElementById("detailEPS").textContent = rand(10, 100).toFixed(2);
  document.getElementById("detailDiv").textContent =
    rand(0.1, 3.0).toFixed(2) + "%";
  document.getElementById("detailBook").textContent = rand(100, 1000).toFixed(
    2,
  );
  document.getElementById("detailFace").textContent = Math.floor(rand(1, 10));

  // About
  document.getElementById("detailAboutSym").textContent = stock.sym;

  const isCrypto = stock.sym.endsWith("USDT") || !stock.exchange;
  if (isCrypto) {
    document.getElementById("detailAboutDesc").textContent =
      `This is a digital asset for ${stock.sym}. It represents a decentralized currency.`;
    document.getElementById("detailAboutCEO").textContent = "Satoshi Nakamoto";
    document.getElementById("detailAboutFound").textContent = "2009";
    document.getElementById("detailAboutInd").textContent =
      "Blockchain & Crypto";
  } else {
    document.getElementById("detailAboutDesc").textContent = "Loading...";
    document.getElementById("detailAboutCEO").textContent = "...";
    document.getElementById("detailAboutFound").textContent = "...";
    document.getElementById("detailAboutInd").textContent = "...";

    apiCall(`/company-info/${stock.sym}`)
      .then((data) => {
        document.getElementById("detailAboutDesc").textContent =
          data.description || "No description available.";
        document.getElementById("detailAboutCEO").textContent =
          data.ceo || "N/A";
        document.getElementById("detailAboutFound").textContent =
          data.founded || "N/A";
        document.getElementById("detailAboutInd").textContent =
          data.industry || "N/A";
      })
      .catch((err) => {
        document.getElementById("detailAboutDesc").textContent =
          stock.description ||
          `${stock.name} (${stock.sym}) is a listed entity.`;
        document.getElementById("detailAboutCEO").textContent =
          stock.ceo || "Unknown";
        document.getElementById("detailAboutFound").textContent = "Unknown";
        document.getElementById("detailAboutInd").textContent =
          stock.industry || "Unknown";
      });
  }

  // Setup Financial Bars Data globally so tabs can use it
  window.currentFinData = {
    revenue: Array.from({ length: 5 }, (_, i) => rand(10000, 90000).toFixed(0)),
    profit: Array.from({ length: 5 }, (_, i) => rand(1000, 9000).toFixed(0)),
    networth: Array.from({ length: 5 }, (_, i) =>
      rand(50000, 150000).toFixed(0),
    ),
    labels: ["Dec '24", "Mar '25", "Jun '25", "Sep '25", "Dec '25"],
  };
  renderFinancials("revenue");

  // Fetch News for this stock if tab is active, or pre-fetch
  fetchStockRelatedNews(stock.sym);

  // Reset range buttons to 3M active
  document
    .querySelectorAll("#chartRangeButtons .range-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const defaultBtn = document.querySelector('#chartRangeButtons .range-btn[data-range="3mo"]');
  if (defaultBtn) defaultBtn.classList.add("active");

  // Load chart
  await loadChart(sym, "3mo", "1d");
};

// Range button click handlers
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("#chartRangeButtons .range-btn");
  if (!btn || !currentChartSymbol) return;

  document
    .querySelectorAll("#chartRangeButtons .range-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const range = btn.dataset.range;
  const interval = btn.dataset.interval;
  await loadChart(currentChartSymbol, range, interval);
});

// Modal UI Handlers (Tabs & Financials)
document.addEventListener("click", (e) => {
  // Main Modal Overview vs News Tab
  const mTab = e.target.closest(".sm-modal-tab");
  if (mTab) {
    document.querySelectorAll(".sm-modal-tab").forEach((t) => {
      t.classList.remove("active");
      t.style.borderBottomColor = "transparent";
      t.style.color = "var(--text)";
    });
    mTab.classList.add("active");
    mTab.style.borderBottomColor = "var(--green)";
    mTab.style.color = "var(--green)";

    document
      .querySelectorAll(".sm-tab-content")
      .forEach((c) => c.classList.add("hidden"));
    const targetId = mTab.getAttribute("data-target");
    if (document.getElementById(targetId))
      document.getElementById(targetId).classList.remove("hidden");
  }

  // Financials Type Tab (Revenue, Profit, Net Worth)
  const fTab = e.target.closest(".fin-tab-item");
  if (fTab) {
    document.querySelectorAll(".fin-tab-item").forEach((t) => {
      t.classList.remove("active");
      t.style.color = "var(--muted)";
      t.querySelector(".fin-tab-indicator").style.background = "transparent";
    });
    fTab.classList.add("active");
    fTab.style.color = "var(--green)";
    fTab.querySelector(".fin-tab-indicator").style.background = "var(--green)";

    const type = fTab.getAttribute("data-type");
    renderFinancials(type);
  }

  // Financials Period Tab (Quarterly, Yearly)
  const pTab = e.target.closest(".fin-period-item");
  if (pTab && !pTab.classList.contains("active")) {
    document.querySelectorAll(".fin-period-item").forEach((t) => {
      t.classList.remove("active");
      t.style.background = "transparent";
      t.style.color = "var(--muted)";
    });
    pTab.classList.add("active");
    pTab.style.background = "rgba(34, 197, 94, 0.1)";
    pTab.style.color = "var(--green)";

    // Slightly re-scramble the data to simulate yearly/quarterly switch
    const type = document
      .querySelector(".fin-tab-item.active")
      .getAttribute("data-type");
    const factor = pTab.getAttribute("data-period") === "yearly" ? 4 : 1;

    if (window.currentFinData) {
      window.activeFinPeriodMod = factor;
      renderFinancials(type);
    }
  }
});

function renderFinancials(type) {
  const container = document.getElementById("finBarsContainer");
  if (!container || !window.currentFinData) return;

  const dataArr = window.currentFinData[type];
  const labels = window.currentFinData.labels;
  const mod = window.activeFinPeriodMod || 1;

  // Get max value for scaling
  const maxVal = Math.max(...dataArr.map((v) => Number(v) * mod));

  // Re-inject bars
  const barHTML = dataArr
    .map((val, idx) => {
      const finalVal = Number(val) * mod;
      const heightPct = Math.max(20, (finalVal / maxVal) * 120); // Max pixel height roughly 120
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="font-size: 11px; font-family: var(--font-mono); font-weight: 600;">${finalVal.toLocaleString()}</div>
            <div style="width: 24px; height: ${heightPct}px; background: var(--green); border-radius: 2px 2px 0 0; transition: height 0.3s ease;"></div>
            <div style="font-size: 11px; color: var(--muted);">${labels[idx]}</div>
        </div>`;
    })
    .join("");

  // Note disclaimer
  const discl = `<div style="position: absolute; right: 0; top: -24px; font-size: 10px; color: var(--muted);">*All values are in Rs. ${mod === 4 ? "Crores (Yearly)" : "Crores"}</div>`;
  container.innerHTML = discl + barHTML;
}

async function fetchStockRelatedNews(sym) {
  const container = document.getElementById("detailNewsContainer");
  if (!container) return;
  container.innerHTML =
    '<div style="color:var(--muted); font-size: 13px; padding:20px; text-align:center;">Loading fresh news...</div>';

  try {
    const res = await apiCall("/news");
    if (Array.isArray(res) && res.length > 0) {
      // Randomize slicing so it looks like different news sets
      const seed = sym.charCodeAt(0) % 5;
      const shuffled = [...res].sort((a, b) => 0.5 - Math.random());
      const relevantNews = shuffled.slice(0, 5); // Take up to 5 articles

      container.innerHTML = relevantNews
        .map(
          (item) => `
                <a href="${item.link}" target="_blank" style="display: block; text-decoration: none; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
                    <h4 style="font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 8px; line-height: 1.4;">${item.title.substring(0, 100)}...</h4>
                    <span style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase;">${item.source || "Market News"}</span>
                </a>
            `,
        )
        .join("");
    } else {
      container.innerHTML =
        '<div style="color:var(--muted); font-size: 13px; text-align: center;">No targeted news found for this stock today.</div>';
    }
  } catch (err) {
    container.innerHTML =
      '<div style="color:var(--red); font-size: 13px; text-align: center;">Failed to load live news.</div>';
  }
}

// Trade Modal Global Functions
// ─── Order Book & Ticket System (LIVE BACKEND INTEGRATION) ───

/**
 * renderOrderBook: Dynamically builds the HTML table using the AUTHENTICATED user's real data.
 * @param {string} filter - The status filter ('all', 'open', 'executed', 'canceled')
 */
window.renderOrderBook = (filter = "all") => {
  const tbody = document.getElementById("orderBookBody");
  if (!tbody || !currentUser) return;

  // Use actual trades from the database instead of mock data
  // Note: Since our backend currently executes all trades immediately,
  // we'll default their status to 'EXECUTED' for the history view.
  const trades = (currentUser.trades || [])
    .map((t) => ({
      ...t,
      status: "EXECUTED", // All historical trades in this app are executed
    }))
    .reverse(); // Show latest first

  // Filter based on UI selection
  const filtered =
    filter === "all"
      ? trades
      : trades.filter((t) => t.status.toLowerCase() === filter.toLowerCase());

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:60px; color:var(--muted); font-size:13px;">
            <span class="material-symbols-outlined" style="font-size:32px; display:block; margin-bottom:12px; opacity:0.3;">receipt_long</span>
            No ${filter !== "all" ? filter : ""} trades found in your order book.
        </td></tr>`;
    return;
  }

  // Generate table rows linked to real account data
  tbody.innerHTML = filtered
    .map((trade) => {
      const dateStr = new Date(trade.date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
            <tr class="fade-in">
                <td style="font-size: 11px; color: var(--muted); font-family: var(--font-mono);">${dateStr}</td>
                <td style="font-weight: 700;">${trade.ticker}</td>
                <td><span class="side-text ${trade.type.toLowerCase()}">${trade.type}</span></td>
                <td style="font-size: 11px; color: var(--muted); font-weight: 600;">MARKET</td>
                <td style="font-family: var(--font-mono); font-weight: 600;">${trade.qty}</td>
                <td style="font-family: var(--font-mono); font-weight: 600;">${window.formatPrice(trade.price)}</td>
                <td><span class="status-badge executed">EXECUTED</span></td>
            </tr>
        `;
    })
    .join("");
};

/**
 * Initialize Order Book Listeners
 */
document.querySelectorAll(".order-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".order-filter").forEach((b) => {
      b.classList.remove("active");
      b.style.background = "transparent";
      b.style.color = "var(--muted)";
    });
    btn.classList.add("active");
    btn.style.background = "var(--green)";
    btn.style.color = "#000";
    window.renderOrderBook(btn.getAttribute("data-filter"));
  });
});

/**
 * Global openTradeModal Implementation (LIVE Integrated)
 */
window.openTradeModal = (ticker, initialSide = "BUY") => {
  const stock = marketData.find((m) => m.sym === ticker) || { price: 0 };
  const modal = document.getElementById("tradeModal");
  if (!modal) return;

  // Reset UI to current stock info
  document.getElementById("modalSym").textContent = ticker;
  document.getElementById("modalLTP").textContent =
    `LTP: ₹${stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const buyBtn = document.getElementById("orderSideBuy");
  const sellBtn = document.getElementById("orderSideSell");
  const sellAllBtn = document.getElementById("sellAllBtn");
  const oldConfirmBtn = document.getElementById("modalConfirmBtn");
  const confirmBtn = oldConfirmBtn.cloneNode(true);
  oldConfirmBtn.parentNode.replaceChild(confirmBtn, oldConfirmBtn);

  let currentSide = initialSide;

  const updateSideUI = (side) => {
    currentSide = side;
    if (side === "BUY") {
      buyBtn.classList.add("active");
      sellBtn.classList.remove("active");
      sellBtn.style.color = "var(--muted)";
      confirmBtn.style.background = "var(--green)";
      confirmBtn.style.color = "#000";
      confirmBtn.style.boxShadow = "0 8px 24px rgba(34, 197, 94, 0.3)";
      confirmBtn.textContent = `CONFIRM BUY ${ticker}`;
      if (sellAllBtn) sellAllBtn.classList.add("hidden");
    } else {
      sellBtn.classList.add("active");
      buyBtn.classList.remove("active");
      buyBtn.style.color = "var(--muted)";
      confirmBtn.style.background = "var(--red)";
      confirmBtn.style.color = "#fff";
      confirmBtn.style.boxShadow = "0 8px 24px rgba(239, 68, 68, 0.3)";
      confirmBtn.textContent = `CONFIRM SELL ${ticker}`;
      if (sellAllBtn) sellAllBtn.classList.remove("hidden");
    }
  };

  buyBtn.onclick = () => updateSideUI("BUY");
  sellBtn.onclick = () => updateSideUI("SELL");
  updateSideUI(initialSide);

  const typeSelect = document.getElementById("orderType");
  const priceInput = document.getElementById("tradePrice");
  const qtyInput = document.getElementById("tradeQty");
  const totalSpan = document.getElementById("modalTotal");

  if (sellAllBtn) {
    sellAllBtn.onclick = () => {
      const holding = currentUser.portfolio.find((p) => p.ticker === ticker);
      if (holding) {
        qtyInput.value = holding.qty;
        updateTotal();
      }
    };
  }

  typeSelect.onchange = () => {
    const isMarket = typeSelect.value === "MARKET";
    const isSL = typeSelect.value === "SL";
    
    priceInput.disabled = isMarket || isSL;
    priceInput.style.opacity = (isMarket || isSL) ? "0.6" : "1";
    if (isMarket || isSL) priceInput.value = (stock.price || 0).toFixed(2);
    
    const triggerGroup = document.getElementById("triggerGroup");
    if (isSL) {
        triggerGroup.classList.remove("hidden");
        document.getElementById("tradeTrigger").value = (stock.price * (currentSide === "BUY" ? 1.05 : 0.95)).toFixed(2);
    } else {
        triggerGroup.classList.add("hidden");
    }
    updateTotal();
  };

  const updateTotal = () => {
    const p = parseFloat(priceInput.value) || stock.price;
    const q = parseInt(qtyInput.value) || 0;
    const total = p * q;
    totalSpan.textContent = `₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  qtyInput.oninput = updateTotal;
  priceInput.oninput = updateTotal;

  // Default setup
  qtyInput.value = 1;
  typeSelect.value = "MARKET";
  document.getElementById("triggerGroup").classList.add("hidden");
  priceInput.value = (stock.price || 0).toFixed(2);
  priceInput.disabled = true;
  updateTotal();

  modal.classList.remove("hidden");

  confirmBtn.onclick = async () => {
    const qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0) return alert("Please enter valid quantity");

    const orderType = typeSelect.value;
    const triggerPrice = orderType === "SL" ? parseFloat(document.getElementById("tradeTrigger").value) : null;

    try {
      confirmBtn.textContent = orderType === "SL" ? "SETTING SL TRIGGER..." : "EXECUTING ORDER...";
      confirmBtn.disabled = true;

      // ACTUAL LIVE API CALL TO BACKEND
      const res = await apiCall("/trade", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          type: currentSide,
          ticker: ticker,
          quantity: qty,
          orderType: orderType, // MARKET, LIMIT, or SL
          triggerPrice: triggerPrice
        }),
      });

      // Update local user state immediately
      currentUser = res.user;
      setAuthUser(currentUser);

      // Refresh all Dashboard UIs
      updateDashboardUI();
      modal.classList.add("hidden");

      // --- AI TRADING COACH: BEHAVIORAL INTERVENTION ---
      if (res.aiCoachMessage) {
        const coachModal = document.getElementById("aiCoachModal");
        if (coachModal) {
          const biasType = res.biasType || "PANIC_SELL";
          if (biasType === "REVENGE_TRADE") {
            document.getElementById("aiCoachBiasType").innerHTML = "<span class=\"material-symbols-outlined\" style=\"font-size: 16px; vertical-align: middle; margin-right: 4px;\">crisis_alert</span> Revenge Trading — Emotional Pattern Detected";
            document.getElementById("aiCoachHoldTime").textContent = "Rapid";
            document.getElementById("aiCoachLoss").textContent = "Multiple";
          } else {
            document.getElementById("aiCoachBiasType").innerHTML = "<span class=\"material-symbols-outlined\" style=\"font-size: 16px; vertical-align: middle; margin-right: 4px;\">psychology</span> Panic Sell — Loss Aversion Detected";
            document.getElementById("aiCoachHoldTime").textContent = "< 48h";
            document.getElementById("aiCoachLoss").textContent = `−${qty} shares`;
          }
          document.getElementById("aiCoachSymbol").textContent = ticker;
          document.getElementById("aiCoachMessageText").textContent = res.aiCoachMessage;
          coachModal.classList.remove("hidden");
        }
      }
      // -----------------------------------------------

      // Notification
      // showToast(`Trade ${currentSide} ${qty} ${ticker} Executed Successfully!`, currentSide === "BUY" ? "success" : "success");
      
      // SHOW RICH RECEIPT MODAL
      const receiptModal = document.getElementById("tradeReceiptModal");
      if (receiptModal) {
          const txnId = "TXN-" + Math.floor(10000 + Math.random() * 90000);
          document.getElementById("receiptTxnId").textContent = txnId;
          
          const badge = document.getElementById("receiptSideBadge");
          badge.textContent = currentSide === "BUY" ? "BOUGHT" : "SOLD";
          badge.className = currentSide === "BUY" ? "badge-bought" : "badge-sold";
          
          document.getElementById("receiptQty").textContent = qty;
          document.getElementById("receiptTicker").textContent = ticker;
          
          const logoEl = document.getElementById("receiptLogo");
          if (logoEl) {
              logoEl.src = stock.logo || `https://ui-avatars.com/api/?name=${ticker}&background=random&color=fff`;
              logoEl.style.display = "block";
          }
          
          const companyName = stock.name || ticker;
          document.getElementById("receiptCompanyName").textContent = companyName.toLowerCase();
          
          const exchange = (window.settings && window.settings.currency === "USD") ? "nasdaq" : "nse";
          document.getElementById("receiptExchange").textContent = exchange;
          
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
          const timeStr = now.toLocaleTimeString('en-GB');
          document.getElementById("receiptDateTime").textContent = `${dateStr}, ${timeStr}`;
          
          document.getElementById("receiptFillPrice").textContent = window.formatPrice ? window.formatPrice(stock.price) : `₹${stock.price}`;
          document.getElementById("receiptOrderType").textContent = orderType.toLowerCase();
          document.getElementById("receiptVenue").textContent = (window.settings && window.settings.currency === "USD") ? "xnas" : "xnse";
          document.getElementById("receiptSettles").textContent = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase() + " · t+2";
          
          const totalCost = stock.price * qty;
          document.getElementById("receiptTotal").textContent = window.formatPrice ? window.formatPrice(totalCost) : `₹${totalCost}`;
          
          receiptModal.classList.remove("hidden");
          
          const btnPos = document.getElementById("btnReceiptViewPosition");
          const btnDone = document.getElementById("btnReceiptDone");
          
          if (btnPos) {
              btnPos.onclick = () => {
                  receiptModal.classList.add("hidden");
                  if (window.switchTab) window.switchTab("portfolio");
              };
          }
          if (btnDone) {
              btnDone.onclick = () => {
                  receiptModal.classList.add("hidden");
              };
          }
      }

    } catch (e) {
      alert("Trade Error: " + e.message);
    } finally {
      confirmBtn.disabled = false;
    }
  };
};


// ─── ML STOCK RECOMMENDATION ENGINE (Frontend) ───

let recsData = null;
let recsLoading = false;

async function fetchRecommendations() {
  if (recsLoading) return;
  recsLoading = true;

  const btn = document.getElementById("refreshRecsBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; animation: chartSpin 0.8s linear infinite;">refresh</span> Refreshing...';
  }

  const skeletonRecCard = `
    <div class="rec-card">
      <div class="rec-card-header">
        <div class="rec-stock-info">
          <div class="skeleton" style="width: 32px; height: 32px; border-radius: 6px;"></div>
          <div>
            <div class="skeleton" style="width: 100px; height: 16px; margin-bottom: 6px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 60px; height: 12px; margin-bottom: 6px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 14px; border-radius: 4px;"></div>
          </div>
        </div>
        <div class="rec-score-ring">
          <svg viewBox="0 0 48 48" class="spinning-loader">
            <circle class="ring-bg" cx="24" cy="24" r="20"></circle>
            <circle class="ring-fg" cx="24" cy="24" r="20" stroke="var(--muted)" stroke-dasharray="125.66" stroke-dashoffset="94.24"></circle>
          </svg>
          <div class="rec-score-label" style="color: var(--muted); opacity: 0.3;">--</div>
        </div>
      </div>
      <div class="rec-price-row" style="margin-top: 16px; margin-bottom: 16px;">
        <div class="skeleton" style="width: 80px; height: 24px; border-radius: 4px;"></div>
        <div class="skeleton" style="width: 50px; height: 16px; border-radius: 4px;"></div>
      </div>
      <div class="rec-factors">
        ${Array(5).fill(`
        <div class="rec-factor-row" style="margin-bottom: 8px;">
          <div class="skeleton" style="width: 60px; height: 10px; border-radius: 2px;"></div>
          <div class="rec-factor-bar skeleton" style="border: none; margin: 0 10px;"></div>
          <div class="skeleton" style="width: 20px; height: 10px; border-radius: 2px;"></div>
        </div>`).join('')}
      </div>
      <div class="skeleton" style="width: 100%; height: 36px; border-radius: 8px; margin-top: 16px;"></div>
    </div>
  `;

  // Show skeleton states
  ["recTopPicks", "recValuePicks", "recMomentumPicks", "recDiversificationPicks"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML = Array(id === "recTopPicks" ? 3 : 2)
        .fill(skeletonRecCard)
        .join("");
  });

  try {
    const [data] = await Promise.all([
      apiCall(`/recommendations?userId=${currentUser?.id || ""}`),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
    recsData = data;
    window._recsLoaded = true;
    renderRecommendations(data);
  } catch (e) {
    console.error("[Recommendations] Fetch error:", e);
    document.getElementById("recTopPicks").innerHTML =
      '<div style="text-align:center; padding:40px; color:var(--muted);">Failed to load recommendations. Try refreshing.</div>';
  } finally {
    recsLoading = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">refresh</span> Refresh Picks';
    }
  }
}

function renderRecommendations(data) {
  if (!data || !data.categories) return;

  // User Profile
  const profile = data.userProfile || {};
  document.getElementById("recRiskProfile").textContent = profile.riskProfile || "\u2014";
  document.getElementById("recTradingStyle").textContent = profile.tradingStyle || "\u2014";
  document.getElementById("recSectorBias").textContent = profile.sectorBias || "None";
  document.getElementById("recTradeCount").textContent = profile.tradeCount || 0;

  // Meta
  const metaEl = document.getElementById("recMeta");
  if (metaEl) {
    const time = data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
    metaEl.textContent = `Analyzed at ${time}`;
  }

  // Render categories
  renderCategoryCards("recTopPicks", data.categories.topPicks || []);
  renderCategoryCards("recValuePicks", data.categories.valuePicks || []);
  renderCategoryCards("recMomentumPicks", data.categories.momentumPicks || []);
  renderCategoryCards("recDiversificationPicks", data.categories.diversificationPicks || []);
}

function renderCategoryCards(containerId, picks) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (picks.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">No picks in this category.</div>';
    return;
  }

  container.innerHTML = picks.map((pick) => renderRecCard(pick)).join("");
}

function renderRecCard(pick) {
  const cs = "₹";
  const scores = pick.scores || {};
  const changeClass = (pick.change || 0) >= 0 ? "up" : "down";
  const changePrefix = (pick.change || 0) >= 0 ? "+" : "";
  const composite = scores.composite || 0;

  // Score ring color
  let ringColor = "var(--green)";
  if (composite < 50) ringColor = "var(--red)";
  else if (composite < 65) ringColor = "#f59e0b";

  // SVG ring math
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (composite / 100) * circumference;

  // Logo
  const logoHTML = pick.logo
    ? `<img src="${pick.logo}" class="rec-stock-logo" alt="${pick.sym}" onerror="this.outerHTML='<div class=rec-stock-logo-fallback>${pick.sym.substring(0, 2)}</div>'">`
    : `<div class="rec-stock-logo-fallback">${pick.sym.substring(0, 2)}</div>`;

  return `
    <div class="rec-card fade-in">
      <div class="rec-card-header">
        <div class="rec-stock-info">
          ${logoHTML}
          <div>
            <div class="rec-stock-name">${pick.name || pick.sym}</div>
            <div class="rec-stock-ticker">${pick.sym}</div>
            <div class="rec-sector-badge">${pick.sector || ""}</div>
          </div>
        </div>
        <div class="rec-score-ring">
          <svg viewBox="0 0 48 48">
            <circle class="ring-bg" cx="24" cy="24" r="${radius}"></circle>
            <circle class="ring-fg" cx="24" cy="24" r="${radius}"
              stroke="${ringColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"></circle>
          </svg>
          <div class="rec-score-label" style="color: ${ringColor};">${composite}</div>
        </div>
      </div>

      <div class="rec-price-row">
        <span class="rec-price">${window.formatPrice(pick.price || 0)}</span>
        <span class="rec-change ${changeClass}">${changePrefix}${(pick.change || 0).toFixed(2)}%</span>
      </div>

      <div class="rec-factors">
        ${renderFactorBar("Momentum", scores.momentum, "momentum")}
        ${renderFactorBar("Value", scores.value, "value")}
        ${renderFactorBar("Stability", scores.volatility, "volatility")}
        ${renderFactorBar("Volume", scores.volume, "volume")}
        ${renderFactorBar("User Fit", scores.userFit, "userfit")}
      </div>

      <button class="rec-buy-btn" onclick="openTradeModal('${pick.sym}', 'BUY')">
        <span class="material-symbols-outlined" style="font-size: 16px;">shopping_cart</span> Buy ${pick.sym}
      </button>
    </div>
  `;
}

function renderFactorBar(label, score, className) {
  const s = score || 0;
  return `
    <div class="rec-factor-row">
      <span class="rec-factor-label">${label}</span>
      <div class="rec-factor-bar">
        <div class="rec-factor-fill ${className}" style="width: ${s}%;"></div>
      </div>
      <span class="rec-factor-score">${s}</span>
    </div>
  `;
}

// Refresh button
document.getElementById("refreshRecsBtn")?.addEventListener("click", () => {
  window._recsLoaded = false;
  recsData = null;
  fetchRecommendations();
});

// --- ADVANCED MARKET SEARCH ---
function setupMarketSearch() {
  const searchInput = document.getElementById("marketSearch");
  const searchBtn = document.getElementById("searchBtn");
  const suggestionsBox = document.getElementById("searchSuggestions");

  if (!searchInput || !suggestionsBox) return;

  const performSearch = (query) => {
    marketSearchQuery = query.toLowerCase();
    updateMarketsTable();
    suggestionsBox.classList.add("hidden");
  };

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length === 0) {
      suggestionsBox.classList.add("hidden");
      marketSearchQuery = "";
      updateMarketsTable();
      return;
    }

    // Filter stocks for suggestions (max 8)
    const matches = marketData
      .filter(m => m.sym.toLowerCase().includes(query) || m.name.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length > 0) {
      suggestionsBox.innerHTML = matches.map(m => `
        <div class="suggestion-item" data-sym="${m.sym}">
          <span class="sym">${m.sym}</span>
          <span class="name">${m.name}</span>
        </div>
      `).join("");
      suggestionsBox.classList.remove("hidden");
    } else {
      suggestionsBox.classList.add("hidden");
    }
  });

  // Handle suggestion click
  suggestionsBox.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (item) {
      const sym = item.dataset.sym;
      searchInput.value = sym;
      performSearch(sym);
      
      // Auto-open stock detail modal when clicking a suggestion
      if (window.openStockDetail) {
        window.openStockDetail(sym);
      }
    }
  });

  // Handle magnifying glass click
  searchBtn.addEventListener("click", () => {
    performSearch(searchInput.value);
  });

  // Handle Enter key
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSearch(searchInput.value);
    }
  });

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      suggestionsBox.classList.add("hidden");
    }
  });
}

// --- REPORTS ENGINE ---
function renderReports() {
  if (!currentUser) return;
  
  const trades = currentUser.trades || [];
  const detailedLogBody = document.getElementById("detailedTradeLogTable")?.querySelector("tbody");
  const capitalGainsBody = document.getElementById("capitalGainsTable")?.querySelector("tbody");
  
  if (detailedLogBody) {
    if (trades.length === 0) {
      detailedLogBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--muted);">No trades found. Start trading to see your logs here.</td></tr>';
    } else {
      detailedLogBody.innerHTML = trades.slice().reverse().map(t => {
        const dateStr = t.date ? new Date(t.date).toLocaleString("en-IN") : "N/A";
        return `
          <tr>
            <td style="font-size: 11px; font-family: var(--font-mono);">${dateStr}</td>
            <td style="font-weight: 600;">${t.ticker}</td>
            <td><span class="badge ${t.type === 'BUY' ? 'badge-buy' : 'badge-sell'}">${t.type}</span></td>
            <td>${t.qty}</td>
            <td>₹${t.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="font-family: var(--font-mono);">₹${t.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join("");
    }
  }

  // Calculate Realized P&L (Only updates on SELL)
  const holdingsForPL = {}; 
  let netRealized = 0;
  const gainsBreakdown = {};

  // Simple FIFO-ish Realized P&L calculation
  trades.forEach(t => {
    if (t.type === 'BUY') {
      if (!holdingsForPL[t.ticker]) holdingsForPL[t.ticker] = { qty: 0, totalCost: 0 };
      holdingsForPL[t.ticker].qty += t.qty;
      holdingsForPL[t.ticker].totalCost += t.total;
    } else {
      const h = holdingsForPL[t.ticker];
      if (h && h.qty > 0) {
        const avgBuyPrice = h.totalCost / h.qty;
        const sellQty = Math.min(t.qty, h.qty);
        const profit = (t.price - avgBuyPrice) * sellQty;
        netRealized += profit;
        
        if (!gainsBreakdown[t.ticker]) gainsBreakdown[t.ticker] = { buyVal: 0, sellVal: 0, qty: 0, pl: 0 };
        gainsBreakdown[t.ticker].buyVal += avgBuyPrice * sellQty;
        gainsBreakdown[t.ticker].sellVal += t.price * sellQty;
        gainsBreakdown[t.ticker].qty += sellQty;
        gainsBreakdown[t.ticker].pl += profit;
        
        // Reduce holdings
        h.qty -= sellQty;
        h.totalCost -= avgBuyPrice * sellQty;
      }
    }
  });

  if (capitalGainsBody) {
    const rows = Object.entries(gainsBreakdown).map(([sym, data]) => `
      <tr>
        <td style="font-weight: 600;">${sym}</td>
        <td>₹${data.buyVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
        <td>₹${data.sellVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
        <td>${data.qty}</td>
        <td class="${data.pl >= 0 ? 'text-up' : 'text-down'}" style="font-weight: 700;">₹${data.pl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td><span style="font-size: 10px; padding: 2px 6px; background: var(--card-inset); border-radius: 4px; color: var(--muted);">STCG (15%)</span></td>
      </tr>
    `).join("");
    capitalGainsBody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--muted);">No realized gains yet. Realized P&L is only calculated after you SELL a stock.</td></tr>';
  }

  const taxEstimate = netRealized > 0 ? netRealized * 0.15 : 0;
  
  const plEl = document.getElementById("reportRealizedPL");
  if (plEl) {
    plEl.textContent = `₹${netRealized.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    plEl.style.color = netRealized >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const taxEl = document.getElementById("reportTaxEstimate");
  if (taxEl) {
    taxEl.textContent = `₹${taxEstimate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    taxEl.style.color = taxEstimate > 0 ? 'var(--red)' : 'var(--muted)';
  }
}

// --- COMPARE ENGINE ---
let compareStock1 = null;
let compareStock2 = null;
let abortCompare = false;

function setupCompare() {
    const s1 = document.getElementById("compareSearch1");
    const s2 = document.getElementById("compareSearch2");
    const sug1 = document.getElementById("compareSug1");
    const sug2 = document.getElementById("compareSug2");

    if (!s1 || !s2) {
        console.error("Compare elements not found in DOM");
        return;
    }

    const checkEnableCompare = () => {
        const runBtn = document.getElementById("runCompareBtn");
        if (runBtn) {
            if (compareStock1 && compareStock2) {
                runBtn.style.background = "var(--accent)";
                runBtn.style.color = "white";
                runBtn.style.pointerEvents = "auto";
                runBtn.style.cursor = "pointer";
            } else {
                runBtn.style.background = "var(--card-inset)";
                runBtn.style.color = "var(--muted)";
                runBtn.style.pointerEvents = "none";
                runBtn.style.cursor = "not-allowed";
            }
        }
    };

    const handleSearch = (input, sugBox, slot) => {
        input.oninput = () => {
            const val = input.value.toUpperCase().trim();
            if (!val || val.length < 1) {
                sugBox.classList.add("hidden");
                if (slot === 1) compareStock1 = null;
                else compareStock2 = null;
                checkEnableCompare();
                return;
            }
            
            // Search in marketData
            const dataToSearch = (typeof marketData !== 'undefined') ? marketData : [];
            const filtered = dataToSearch.filter(s => 
                s.sym.toUpperCase().includes(val) || 
                (s.name && s.name.toUpperCase().includes(val))
            ).slice(0, 5);

            // Auto-select if exact match typed
            const exactMatch = dataToSearch.find(s => s.sym.toUpperCase() === val);
            if (exactMatch) {
                if (slot === 1) compareStock1 = exactMatch;
                else compareStock2 = exactMatch;
            } else {
                if (slot === 1) compareStock1 = null;
                else compareStock2 = null;
            }
            checkEnableCompare();

            if (filtered.length > 0) {
                sugBox.innerHTML = filtered.map(s => `
                    <div class="suggestion-item" onclick="window.selectCompareStock('${s.sym}', ${slot})" style="padding: 10px; border-bottom: 1px solid var(--border-light); cursor: pointer;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:24px; height:24px; background:var(--accent); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:var(--bg); font-weight:800;">${s.sym[0]}</div>
                            <div>
                                <div style="font-weight:700; color:var(--text); font-size:13px;">${s.sym}</div>
                                <div style="font-size:10px; color:var(--muted);">${s.name || ''}</div>
                            </div>
                        </div>
                    </div>
                `).join("");
                sugBox.classList.remove("hidden");
                sugBox.style.display = "block";
            } else {
                sugBox.classList.add("hidden");
            }
        };
    };

    handleSearch(s1, sug1, 1);
    handleSearch(s2, sug2, 2);

    const runBtn = document.getElementById("runCompareBtn");
    const stopBtn = document.getElementById("stopCompareBtn");

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            abortCompare = true;
            
            const runText = document.getElementById("runCompareText");
            const runSpinner = document.getElementById("runCompareSpinner");
            
            if (runBtn && runText && runSpinner) {
                runBtn.classList.remove("hidden");
                stopBtn.classList.add("hidden");
                runBtn.style.pointerEvents = "auto";
                runText.textContent = "Compare";
                runSpinner.classList.add("hidden");
            }

            const container = document.getElementById("compareContent");
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 120px 0; background: var(--card-alt); border-radius: 24px; border: 1px dashed var(--border);">
                        <span class="material-symbols-outlined" style="font-size: 64px; color: var(--muted); margin-bottom: 20px; opacity: 0.4;">compare_arrows</span>
                        <h2 style="color: var(--text); font-weight: 600; margin-bottom: 8px;">Compare Key Metrics</h2>
                        <p style="color: var(--muted); max-width: 400px; margin: 0 auto;">Select two stocks from the search boxes above to see side-by-side P/E ratios, Market Cap, and historical performance.</p>
                    </div>
                `;
            }
        });
    }

    if (runBtn) {
        runBtn.addEventListener("click", () => {
            if (compareStock1 && compareStock2) {
                abortCompare = false;
                renderCompareUI();
            }
        });
    }

    // Initial render if stocks are already set
    if (compareStock1 && compareStock2) {
        checkEnableCompare();
        renderCompareUI();
    }
}

window.selectCompareStock = (sym, slot) => {
    const dataToSearch = (typeof marketData !== 'undefined') ? marketData : [];
    const stock = dataToSearch.find(s => s.sym === sym);
    if (!stock) return;

    if (slot === 1) {
        compareStock1 = stock;
        const s1 = document.getElementById("compareSearch1");
        if (s1) s1.value = sym;
        document.getElementById("compareSug1")?.classList.add("hidden");
    } else {
        compareStock2 = stock;
        const s2 = document.getElementById("compareSearch2");
        if (s2) s2.value = sym;
        document.getElementById("compareSug2")?.classList.add("hidden");
    }

    const runBtn = document.getElementById("runCompareBtn");
    if (compareStock1 && compareStock2 && runBtn) {
        runBtn.style.background = "var(--accent)";
        runBtn.style.color = "white";
        runBtn.style.pointerEvents = "auto";
        runBtn.style.cursor = "pointer";
    }
};

async function renderCompareUI() {
    const container = document.getElementById("compareContent");
    if (!container) return;

    const s1 = compareStock1;
    const s2 = compareStock2;

    const runBtn = document.getElementById("runCompareBtn");
    const runText = document.getElementById("runCompareText");
    const runSpinner = document.getElementById("runCompareSpinner");
    const stopBtn = document.getElementById("stopCompareBtn");
    
    if (runBtn && runText && runSpinner && stopBtn) {
        runBtn.classList.add("hidden");
        stopBtn.classList.remove("hidden");
        runText.textContent = "Comparing";
        runSpinner.classList.remove("hidden");
    }

    // Show skeletons
    container.innerHTML = `
        <div class="fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            ${Array(2).fill(`
                <div class="dashboard-widget" style="padding: 24px; background: var(--card-alt); border: 1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px;">
                        <div class="skeleton" style="width: 48px; height: 48px; border-radius: 8px;"></div>
                        <div>
                            <div class="skeleton" style="width: 60px; height: 24px; margin-bottom: 6px; border-radius: 4px;"></div>
                            <div class="skeleton" style="width: 120px; height: 14px; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${Array(8).fill(`
                            <div style="display:flex; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
                                <div class="skeleton" style="width: 80px; height: 14px; border-radius: 2px;"></div>
                                <div class="skeleton" style="width: 60px; height: 14px; border-radius: 2px;"></div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `).join("")}
        </div>
        
        <div class="dashboard-widget" style="margin-top:24px; padding:24px; background: var(--card-alt); border: 1px solid var(--border);">
            <div class="skeleton" style="width: 150px; height: 20px; margin-bottom: 20px; border-radius: 4px;"></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:40px;">
                ${Array(2).fill(`
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div class="skeleton" style="width: 100px; height: 12px; border-radius: 2px;"></div>
                        <div class="skeleton" style="width: 140px; height: 32px; border-radius: 4px;"></div>
                        <div class="skeleton" style="width: 200px; height: 12px; border-radius: 2px;"></div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    try {
        const [aiData] = await Promise.all([
            apiCall("/ai/compare", {
                method: "POST",
                body: JSON.stringify({ s1: s1.sym, s2: s2.sym })
            }).catch(e => {
                console.error("AI Comparison Error:", e);
                return null;
            }),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        if (s1.sym !== compareStock1?.sym || s2.sym !== compareStock2?.sym || abortCompare) return;

        container.innerHTML = getCompareBaseHTML(s1, s2);

        if (aiData) {
            renderAIComparison(aiData);
        } else {
            document.getElementById("aiCompareResult").innerHTML = `
                <div style="padding:24px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); border-radius:16px; color:var(--red); font-size:14px; text-align:center;">
                    <span class="material-symbols-outlined" style="display:block; margin-bottom:8px;">error</span>
                    Machine Learning analysis unavailable for this pair.
                </div>
            `;
        }
    } catch(e) {
        console.error("Compare error", e);
    } finally {
        if (!abortCompare) {
            const runBtn = document.getElementById("runCompareBtn");
            const runText = document.getElementById("runCompareText");
            const runSpinner = document.getElementById("runCompareSpinner");
            const stopBtn = document.getElementById("stopCompareBtn");
            
            if (runBtn && runText && runSpinner && stopBtn) {
                runBtn.classList.remove("hidden");
                stopBtn.classList.add("hidden");
                runBtn.style.pointerEvents = "auto";
                runText.textContent = "Compare";
                runSpinner.classList.add("hidden");
            }
        }
    }
}

function getCompareBaseHTML(s1, s2) {
    const metrics = [
        { label: "Price", key: "price", format: v => `₹${(v || 0).toLocaleString("en-IN")}` },
        { label: "Change", key: "change", format: v => `${(v || 0) >= 0 ? '+' : ''}${(v || 0)}%`, color: true },
        { label: "Market Cap", key: "mktCap", format: v => v || "N/A" },
        { label: "P/E Ratio", key: "peRatio", format: v => v || "N/A" },
        { label: "Volume", key: "volume", format: v => v || "N/A" },
        { label: "52W High", key: "week52High", format: v => v ? `₹${v.toLocaleString("en-IN")}` : "N/A" },
        { label: "52W Low", key: "week52Low", format: v => v ? `₹${v.toLocaleString("en-IN")}` : "N/A" },
        { label: "Industry", key: "industry", format: v => v || "N/A" },
    ];

    return `
        <div class="fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <!-- Stock 1 Card -->
            <div class="dashboard-widget" style="padding: 24px; background: var(--card-alt); border: 1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px;">
                    ${stockLogo(s1, 48)}
                    <div>
                        <h2 style="margin:0; font-family:var(--font-head);">${s1.sym}</h2>
                        <p style="margin:4px 0 0 0; color:var(--muted); font-size:14px;">${s1.name || ''}</p>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${metrics.map(m => `
                        <div style="display:flex; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
                            <span style="color:var(--muted); font-size:14px;">${m.label}</span>
                            <span style="font-weight:700; font-family:var(--font-mono); ${m.color ? (s1[m.key] >= 0 ? 'color:var(--green)' : 'color:var(--red)') : 'color:var(--text)'}">${m.format(s1[m.key])}</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            <!-- Stock 2 Card -->
            <div class="dashboard-widget" style="padding: 24px; background: var(--card-alt); border: 1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px;">
                    ${stockLogo(s2, 48)}
                    <div>
                        <h2 style="margin:0; font-family:var(--font-head);">${s2.sym}</h2>
                        <p style="margin:4px 0 0 0; color:var(--muted); font-size:14px;">${s2.name || ''}</p>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${metrics.map(m => `
                        <div style="display:flex; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
                            <span style="color:var(--muted); font-size:14px;">${m.label}</span>
                            <span style="font-weight:700; font-family:var(--font-mono); ${m.color ? (s2[m.key] >= 0 ? 'color:var(--green)' : 'color:var(--red)') : 'color:var(--text)'}">${m.format(s2[m.key])}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
        
        <div class="dashboard-widget" style="margin-top:24px; padding:24px; background: var(--card-alt); border: 1px solid var(--border);">
            <h3 style="margin-bottom:20px; font-family:var(--font-head);">Value Comparison</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:40px;">
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Price Spread</div>
                    <div style="font-size:28px; font-weight:800; font-family:var(--font-mono); color:var(--accent);">₹${Math.abs(s1.price - s2.price).toLocaleString("en-IN")}</div>
                    <div style="font-size:13px; color:var(--muted);">${s1.sym} is ${s1.price > s2.price ? 'priced higher' : 'priced lower'} than ${s2.sym}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">P/E Multiplier</div>
                    <div style="font-size:28px; font-weight:800; font-family:var(--font-mono); color:var(--green);">${(s1.peRatio && s2.peRatio) ? (s1.peRatio / s2.peRatio).toFixed(2) : 'N/A'}x</div>
                    <div style="font-size:13px; color:var(--muted);">Relative valuation between the two stocks</div>
                </div>
            </div>
        </div>

        <div id="aiCompareResult" style="margin-top:24px; animation: slideUpFade 0.8s ease;"></div>
    `;
}

function renderAIComparison(data) {
    const container = document.getElementById("aiCompareResult");
    if (!container) return;

    const isWinnerS1 = data.verdict === "WINNER_S1";
    const isWinnerS2 = data.verdict === "WINNER_S2";
    const riskColor = data.riskLevel === "High" ? "var(--red)" : data.riskLevel === "Medium" ? "#f59e0b" : "var(--green)";

    const clampStyle = "display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;";
    const summaryClampStyle = "display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;";

    container.innerHTML = `
        <div class="dashboard-widget fade-in" style="padding:0; overflow:hidden; border:1px solid var(--border); background: var(--card-alt);">
            <div style="background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%); padding: 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="material-symbols-outlined" style="color:var(--accent); font-size:28px;">psychology</span>
                    <div>
                        <h3 style="margin:0; font-family:var(--font-head); font-size:18px;">Labh Sathi AI Verdict</h3>
                        <p style="margin:2px 0 0 0; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Neural Network Decision Engine</p>
                    </div>
                </div>
                <div style="padding:8px 16px; background:${riskColor}15; color:${riskColor}; border-radius:20px; font-size:12px; font-weight:700; border:1px solid ${riskColor}30;">
                    ${data.riskLevel} Risk
                </div>
            </div>
            
            <div style="padding:24px;">
                <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:32px;">
                    <div style="display:flex; flex-direction:column; gap:24px;">
                        <div>
                            <h4 style="margin:0 0 12px 0; color:var(--text); font-size:15px; display:flex; align-items:center; gap:8px;">
                                <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent);">summarize</span>
                                Executive Summary
                            </h4>
                            <p style="color:var(--text); line-height:1.6; font-size:14px; margin:0; ${summaryClampStyle}" title="${data.summary}">${data.summary}</p>
                        </div>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                            <div style="padding:16px; background:var(--card-inset); border-radius:12px; border:1px solid var(--border);">
                                <div style="font-size:11px; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">${data.winnerSymbol === compareStock1.sym ? 'Top Performer' : 'Secondary'}</div>
                                <div style="font-weight:700; color:var(--text);">${compareStock1.sym} Analysis</div>
                                <div style="font-size:13px; color:var(--muted); margin-top:6px; line-height:1.4; ${clampStyle}" title="${data.stock1Analysis}">${data.stock1Analysis}</div>
                            </div>
                            <div style="padding:16px; background:var(--card-inset); border-radius:12px; border:1px solid var(--border);">
                                <div style="font-size:11px; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">${data.winnerSymbol === compareStock2.sym ? 'Top Performer' : 'Secondary'}</div>
                                <div style="font-weight:700; color:var(--text);">${compareStock2.sym} Analysis</div>
                                <div style="font-size:13px; color:var(--muted); margin-top:6px; line-height:1.4; ${clampStyle}" title="${data.stock2Analysis}">${data.stock2Analysis}</div>
                            </div>
                        </div>

                        <div style="padding:20px; background:var(--card-inset); border-radius:16px; border:1px solid var(--border);">
                            <h5 style="margin:0 0 10px 0; font-size:13px; color:var(--text); display:flex; align-items:center; gap:6px;">
                                <span class="material-symbols-outlined" style="font-size:16px;">lightbulb</span>
                                Strategic Advice
                            </h5>
                            <p style="margin:0; font-size:13px; color:var(--muted); line-height:1.5; ${summaryClampStyle}" title="${data.reasoning}">${data.reasoning}</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:24px;">
                        <div style="padding:32px 24px; background:linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%); border:1px solid rgba(16, 185, 129, 0.3); border-radius:20px; text-align:center; position:relative; overflow:hidden;">
                            <div style="position:absolute; top:-10px; right:-10px; font-size:80px; opacity:0.05; color:var(--green);" class="material-symbols-outlined">verified</div>
                            <div style="font-size:12px; color:var(--green); font-weight:700; text-transform:uppercase; letter-spacing:2px; margin-bottom:8px;">Decision Verdict</div>
                            <div style="font-size:32px; font-weight:900; color:var(--text); font-family:var(--font-head); margin-bottom:8px;">BUY ${data.winnerSymbol || 'NEUTRAL'}</div>
                            <div style="font-size:13px; color:var(--green); opacity:0.8;">Machine Learning Recommendation</div>
                        </div>
                        
                        <div style="padding:24px; background:rgba(99, 102, 241, 0.05); border-radius:16px; border:1px solid rgba(99, 102, 241, 0.2); flex: 1;">
                            <h5 style="margin:0 0 12px 0; font-size:14px; color:var(--accent); display:flex; align-items:center; gap:6px;">
                                <span class="material-symbols-outlined" style="font-size:18px;">query_stats</span>
                                ML Insights
                            </h5>
                            <p style="margin:0; font-size:13px; color:var(--text); line-height:1.6; ${clampStyle}" title="${data.mlInsights}">${data.mlInsights}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


// AI Analysis Integration
window.analyzeCompareAI = () => {
    if (!compareStock1 || !compareStock2) return;
    const s1 = compareStock1;
    const s2 = compareStock2;
    
    const prompt = `Can you perform a professional fundamental comparison between ${s1.name} (${s1.sym}) and ${s2.name} (${s2.sym})? 
    
Current Comparison Data:
- ${s1.sym}: Price ₹${s1.price.toLocaleString("en-IN")}, P/E ${s1.peRatio || 'N/A'}, MktCap ${s1.mktCap}, Industry ${s1.industry}
- ${s2.sym}: Price ₹${s2.price.toLocaleString("en-IN")}, P/E ${s2.peRatio || 'N/A'}, MktCap ${s2.mktCap}, Industry ${s2.industry}

Please analyze their relative valuations, competitive advantages, and tell me which one looks more attractive at current levels based on these metrics.`;
    
    window.askSathi(prompt);
};

// Ensure search suggestions close on outside click
document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
        document.getElementById("compareSug1")?.classList.add("hidden");
        document.getElementById("compareSug2")?.classList.add("hidden");
    }
});

// Commodity Modal Logic
window.currentOpenCommodity = null;

window.openCommodityModal = (sym) => {
    window.currentOpenCommodity = sym;
    const c = commoditiesData.find(x => x.sym === sym);
    if (!c) return;

    const currency = typeof window.getSetting === "function" ? window.getSetting("currency") : "INR";
    const isUSD = c.unit.startsWith("USd");
    
    let priceBase = isUSD ? c.price / 100 : c.price;
    let prevBase = isUSD ? c.prevClose / 100 : c.prevClose;
    if(!prevBase) prevBase = priceBase; 
    
    let priceInInr = priceBase / 0.012;
    let prevInInr = prevBase / 0.012;
    
    let unitLabel = "Unit";
    let multipliers = [
        { label: "1 Unit", mult: 1 },
        { label: "10 Units", mult: 10 },
        { label: "100 Units", mult: 100 },
        { label: "1000 Units", mult: 1000 }
    ];
    
    let displayName = c.name;

    if (c.category === "Precious Metals") {
        // Convert oz to grams (1 oz = 31.1034768g)
        priceInInr = priceInInr / 31.1034768;
        prevInInr = prevInInr / 31.1034768;
        unitLabel = "Gram";
        if (displayName.includes("Gold")) displayName = "Gold 24k";
        
        multipliers = [
            { label: "1 Gram", mult: 1 },
            { label: "10 Gram", mult: 10 },
            { label: "100 Gram", mult: 100 },
            { label: "1 Kg", mult: 1000 }
        ];
    } else if (c.unit.includes("/")) {
        const parts = c.unit.split("/");
        unitLabel = parts[1];
        multipliers = [
            { label: "1 " + unitLabel, mult: 1 },
            { label: "10 " + unitLabel, mult: 10 },
            { label: "100 " + unitLabel, mult: 100 },
            { label: "1000 " + unitLabel, mult: 1000 }
        ];
    }

    document.getElementById("commodityModalTitle").textContent = displayName + " rate";
    document.getElementById("commodityModalTableTitle").textContent = displayName + " rate per " + unitLabel.toLowerCase();
    document.getElementById("commodityModalIcon").textContent = CATEGORY_ICONS[c.category] || "diamond";

    const changeBase = priceInInr - prevInInr;
    const changePct = prevInInr ? (changeBase / prevInInr) * 100 : 0;
    const isUp = changeBase >= 0;
    
    const changeEl = document.getElementById("commodityModalChange");
    changeEl.textContent = `${isUp ? '+' : ''}${window.formatPrice(changeBase)} (${isUp ? '+' : ''}${changePct.toFixed(2)}%)`;
    changeEl.className = isUp ? "tint-up" : "tint-down";

    // Dashboard shows 10g for precious metals, so let's match the modal header to 10g
    let headerToday = priceInInr;
    let headerPrev = prevInInr;
    if (c.category === "Precious Metals") {
        headerToday *= 10;
        headerPrev *= 10;
    }

    document.getElementById("commodityModalToday").textContent = window.formatPrice(headerToday);
    document.getElementById("commodityModalYesterday").textContent = window.formatPrice(headerPrev);

    const tbody = document.getElementById("commodityModalTableBody");
    tbody.innerHTML = multipliers.map(m => {
        const mPrice = priceInInr * m.mult;
        const mPrev = prevInInr * m.mult;
        const mChange = mPrice - mPrev;
        const mPct = mPrev ? (mChange / mPrev) * 100 : 0;
        const mUp = mChange >= 0;
        
        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 16px; color: var(--muted);">${m.label}</td>
                <td style="padding: 16px; font-family: var(--font-mono); color: var(--text);">${window.formatPrice(mPrice)}</td>
                <td style="padding: 16px; font-family: var(--font-mono);" class="${mUp ? 'tint-up' : 'tint-down'}">${mUp ? '+' : ''}${window.formatPrice(mChange).replace(window.getSetting("currency") || "INR", "")} (${mUp ? '+' : ''}${mPct.toFixed(2)}%)</td>
                <td style="padding: 16px; font-family: var(--font-mono); color: var(--muted);">${window.formatPrice(mPrev)}</td>
            </tr>
        `;
    }).join("");

    document.getElementById("commodityModal").classList.remove("hidden");
    document.getElementById("commodityModal").style.display = "flex";
};

window.closeCommodityModal = () => {
    window.currentOpenCommodity = null;
    document.getElementById("commodityModal").classList.add("hidden");
    document.getElementById("commodityModal").style.display = "";
};

// Profile Modal Logic
window.openProfileModal = () => {
    if (!currentUser) return;
    document.getElementById("profileName").value = currentUser.name || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
    document.getElementById("profilePhone").value = currentUser.phone || "";
    document.getElementById("profileAvatar").value = currentUser.avatar || "";
    
    document.getElementById("profileModal").classList.remove("hidden");
    document.getElementById("profileModal").style.display = "flex";
};

window.closeProfileModal = () => {
    document.getElementById("profileModal").classList.add("hidden");
    document.getElementById("profileModal").style.display = "";
};

window.saveProfile = async () => {
    if (!currentUser) return;
    const name = document.getElementById("profileName").value.trim();
    const phone = document.getElementById("profilePhone").value.trim();
    const avatar = document.getElementById("profileAvatar").value.trim();

    const saveBtn = event.target;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    try {
        const res = await apiCall("/auth/profile", {
            method: "PUT",
            body: JSON.stringify({
                id: currentUser.id,
                name,
                phone,
                avatar
            })
        });

        if (res.user) {
            currentUser = res.user;
            setAuthUser(currentUser);
            
            // Update UI
            const nameEl = document.getElementById("navUserName");
            if (nameEl) nameEl.textContent = currentUser.name;
            
            const newAvatar = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=22c55e&color=fff`;
            
            const picEl = document.getElementById("navProfilePic");
            if (picEl) picEl.src = newAvatar;

            const dropdownPicEl = document.getElementById("dropdownProfilePic");
            if (dropdownPicEl) dropdownPicEl.src = newAvatar;
            
            const recPicEl = document.getElementById("recProfilePic");
            if (recPicEl) recPicEl.src = newAvatar;
            
            // Re-render UI pieces that might depend on name
            if (typeof updateGreeting === "function") updateGreeting();
            
            window.closeProfileModal();
        }
    } catch (err) {
        console.error("Failed to save profile:", err);
        alert(err.message || "Failed to save profile.");
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
};
