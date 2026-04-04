import { apiCall, getAuthUser, logout, setAuthUser } from "./api.js";

let currentUser = getAuthUser();
let marketData = [];
let watchlist = JSON.parse(localStorage.getItem("labh_watchlist") || "[]");
let marketSearchQuery = "";

// Currency helper: returns $ for intl stocks, ₹ for NSE
const cur = (stock) => (stock.intl ? "$" : "₹");

document.addEventListener("DOMContentLoaded", async () => {
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("app").style.display = "block";
  document.getElementById("navUserName").textContent = currentUser.name;
  const dropdownEmail = document.getElementById("dropdownEmail");
  if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
  document.getElementById("welcomeName").textContent = `${currentUser.name}`;
  document.getElementById("logoutBtn").addEventListener("click", logout);

  const navProfilePic = document.getElementById("navProfilePic");
  if (navProfilePic) {
    navProfilePic.src =
      currentUser.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=22c55e&color=fff`;
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

  document.getElementById("marketSearch")?.addEventListener("input", (e) => {
    marketSearchQuery = e.target.value.toLowerCase();
    updateMarketsTable();
  });

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

  // News
  fetchNewsLoop();

  // Sentiment Engine
  setupSentiment();
});

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
      return `
        <div class="commodity-card">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="material-symbols-outlined" style="font-size:16px; color:${color};">${icon}</span>
                <span class="c-name">${c.name}</span>
            </div>
            <div class="c-unit">${c.unit}</div>
            <div class="c-price" style="color: var(--text); font-family: var(--font-mono);">${c.price > 0 ? c.price.toFixed(2) : "—"}</div>
            <div class="c-change tint-${isUp ? "up" : "down"}">${c.price > 0 ? (isUp ? "+" : "") + c.change.toFixed(2) + "%" : "Loading..."}</div>
        </div>`;
    })
    .join("");
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

  // Visual feedback
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<span class="material-symbols-outlined" style="font-size: 16px; animation: chartSpin 0.8s linear infinite;">refresh</span> Analyzing...';
  }

  // Show skeleton while loading
  if (grid && !sentimentData) {
    grid.innerHTML = Array(4)
      .fill(
        '<div class="sentiment-card skeleton" style="height: 180px;"></div>',
      )
      .join("");
  }

  try {
    sentimentData = await apiCall("/sentiment");
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

  // AI Badge
  const aiBadge = document.getElementById("sentimentAiBadge");
  if (aiBadge) aiBadge.style.display = aiPowered ? "inline-flex" : "none";

  // Gauge
  const scoreDisplay = document.getElementById("sentimentScoreDisplay");
  const moodLabel = document.getElementById("sentimentMoodLabel");
  const arc = document.getElementById("sentimentArc");
  const timestamp = document.getElementById("sentimentTimestamp");

  if (scoreDisplay) scoreDisplay.textContent = moodScore;

  const moodColor =
    moodScore >= 60
      ? "var(--green)"
      : moodScore <= 40
        ? "var(--red)"
        : "var(--gold)";
  const moodEmoji =
    moodScore >= 70
      ? "🟢"
      : moodScore >= 55
        ? "🟡"
        : moodScore <= 30
          ? "🔴"
          : moodScore <= 45
            ? "🟠"
            : "⚪";

  if (moodLabel) {
    moodLabel.textContent = `${moodEmoji} ${overallMood}`;
    moodLabel.style.color = moodColor;
  }

  // Arc: total semicircle length ≈ 251.33
  const arcLen = 251.33;
  const fill = (moodScore / 100) * arcLen;
  if (arc) {
    arc.setAttribute("stroke", moodColor);
    arc.setAttribute("stroke-dasharray", `${fill}, ${arcLen}`);
  }

  if (timestamp && analyzedAt) {
    timestamp.textContent = `Analyzed ${timeAgo(analyzedAt)}`;
  }

  // Summary
  const summary = document.getElementById("sentimentSummary");
  if (summary)
    summary.textContent =
      marketSummary || "AI summary available when GROQ_API_KEY is configured.";

  // Breakdown Stats
  const bullCount = headlines.filter((h) => h.sentiment === "bullish").length;
  const bearCount = headlines.filter((h) => h.sentiment === "bearish").length;
  const neutralCount = headlines.filter(
    (h) => h.sentiment === "neutral",
  ).length;
  const total = headlines.length || 1;

  document.getElementById("sentimentBullCount").textContent = bullCount;
  document.getElementById("sentimentNeutralCount").textContent = neutralCount;
  document.getElementById("sentimentBearCount").textContent = bearCount;
  document.getElementById("sentimentBreakdownText").textContent =
    `${bullCount}B / ${neutralCount}N / ${bearCount}Be`;

  // Breakdown bar widths
  document.getElementById("sentimentBarBull").style.width =
    `${(bullCount / total) * 100}%`;
  document.getElementById("sentimentBarNeutral").style.width =
    `${(neutralCount / total) * 100}%`;
  document.getElementById("sentimentBarBear").style.width =
    `${(bearCount / total) * 100}%`;

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
                <span class="sentiment-badge ${h.sentiment}">
                    <span class="material-symbols-outlined" style="font-size: 14px;">${sentIcon}</span>
                    ${h.sentiment}
                </span>
            </div>
            <div style="font-size: 12px; color: var(--muted); font-style: italic;">\"${h.reasoning}\"</div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div class="confidence-bar" style="flex: 1;">
                    <div class="confidence-fill" style="width: ${confPct}%; background: ${sentColor};"></div>
                </div>
                <span style="font-size: 10px; font-family: var(--font-mono); color: var(--muted); white-space: nowrap;">${confPct}% conf</span>
            </div>
            ${keywordsHTML ? `<div class="sentiment-keywords">${keywordsHTML}</div>` : ""}
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

  // Lazy load: fetch on tab switch to Sentiment
  const origSwitchTab = window.switchTab;
  window.switchTab = (tabId) => {
    origSwitchTab(tabId);
    if (tabId === "sentiment" && !sentimentData && !sentimentLoading) {
      fetchSentiment();
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
    updateMarketsTable();
  } catch (e) {
    console.error(e);
  }
  setTimeout(fetchMarketsLoop, 5000); // Poll purely for demonstration
}

function updateDashboardUI() {
  // Balances
  const displayBalance = `₹${currentUser.balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  document.getElementById("homeCash").textContent = displayBalance;
  const dropBal = document.getElementById("dropdownBalance");
  if (dropBal) dropBal.textContent = displayBalance;

  let portValue = 0;
  currentUser.portfolio.forEach((p) => {
    const mStock = marketData.find((m) => m.sym === p.ticker);
    portValue += p.qty * (mStock ? mStock.price : p.avgPrice);
  });
  document.getElementById("homePortfolioValue").textContent =
    `₹${portValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

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
                    <td style="font-family:var(--font-mono);">₹${p.avgPrice.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono);">₹${currentPrice.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isProfit ? "up" : "down"}">${isProfit ? "+" : ""}₹${pl.toFixed(2)}</span></td>
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
                <div style="font-weight:600; font-size:15px; font-family:var(--font-mono);">${cur(stock)}${stock.price.toFixed(2)}</div>
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
            <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; margin:4px 0;">${cur(stock)}${stock.price.toFixed(2)}</div>
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
                <td style="font-family:var(--font-mono); font-weight:bold;">${cur(stock)}${stock.price.toFixed(2)}</td>
                <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isUp ? "up" : "down"}">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</span></td>
                <td><button class="trade-action-btn" onclick="window.openTradeModal('${stock.sym}', 'BUY')">Trade</button></td>
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
      return `<div class="ticker-item"><span style="color:var(--muted)">${stock.sym}</span> <span style="font-family:var(--font-mono);">${cur(stock)}${stock.price.toFixed(2)}</span> <span class="tint-${isUp ? "up" : "down"}">${isUp ? "+" : ""}${stock.change.toFixed(2)}%</span></div>`;
    })
    .join("");
  // Duplicate for smooth infinite scrolling
  tickerContainer.innerHTML += tickerContainer.innerHTML;

  // Auto-update portfolio calculations since prices changed
  updateDashboardUI();
}

// Global Tab switcher
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
};

function setupTabs() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => switchTab(el.dataset.tab));
  });
}

// Chat
function setupChat() {
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const msgContainer = document.getElementById("chatMessages");
  const attachBtn = document.getElementById("chatAttachBtn");
  const fileInput = document.getElementById("chatFileInput");
  const previewContainer = document.getElementById("chatAttachmentPreview");

  if (!input || !sendBtn || !msgContainer) return;

  let attachedFiles = [];

  // File selection logic
  attachBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileData = {
          name: file.name,
          type: file.type,
          data: event.target.result, // Base64 for images
          id: Date.now() + Math.random(),
        };
        attachedFiles.push(fileData);
        renderPreviews();
        sendBtn.classList.add("active");
      };
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file.slice(0, 1000)); // Read start of text files
      }
    }
    fileInput.value = ""; // Reset for same file selection
  });

  function renderPreviews() {
    if (!previewContainer) return;
    if (attachedFiles.length === 0) {
      previewContainer.classList.add("hidden");
      return;
    }
    previewContainer.classList.remove("hidden");
    previewContainer.innerHTML = attachedFiles
      .map(
        (f) => `
            <div class="preview-item">
                ${f.type.startsWith("image/") ? `<img src="${f.data}">` : `<span class="material-symbols-outlined file-icon">description</span>`}
                <div class="remove-btn" onclick="window.removeAttachment(${f.id})">×</div>
            </div>
        `,
      )
      .join("");
  }

  window.removeAttachment = (id) => {
    attachedFiles = attachedFiles.filter((f) => f.id !== id);
    renderPreviews();
    if (attachedFiles.length === 0 && input.value.trim() === "")
      sendBtn.classList.remove("active");
  };

  // Auto-resize textarea
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
    if (input.value.trim().length > 0 || attachedFiles.length > 0)
      sendBtn.classList.add("active");
    else sendBtn.classList.remove("active");
  });

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text && attachedFiles.length === 0) return;

    const currentAttachments = [...attachedFiles];

    // Reset UI
    input.value = "";
    input.style.height = "auto";
    attachedFiles = [];
    renderPreviews();
    sendBtn.classList.remove("active");

    // User Message HTML (showing attachments)
    let attachmentsHTML = currentAttachments
      .map((f) => {
        if (f.type.startsWith("image/"))
          return `<img src="${f.data}" style="max-width: 200px; border-radius: 8px; margin-top: 8px; display: block;">`;
        return `<div style="margin-top:8px; display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; font-size:12px;"><span class="material-symbols-outlined" style="font-size:16px;">description</span> ${f.name}</div>`;
      })
      .join("");

    msgContainer.innerHTML += `
            <div class="msg-user-wrap fade-in">
                <div class="msg-content-user">
                    ${text ? `<div>${text}</div>` : ""}
                    ${attachmentsHTML}
                </div>
            </div>
        `;
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const data = await apiCall("/vibe-trade", {
        method: "POST",
        body: JSON.stringify({
          prompt: text,
          attachments: currentAttachments.map((f) => ({
            name: f.name,
            type: f.type,
            data: f.data,
          })),
        }),
      });

      // ... (rest of AI rendering logic remains same)
      let extraHtml = "";
      if (
        data.tradeSymbol &&
        marketData.some((m) => m.sym === data.tradeSymbol)
      ) {
        extraHtml = `
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button style="flex: 1; padding: 10px 14px; border-radius: 10px; border: none; background: rgba(34,197,94,0.15); color: var(--green); font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--green)'; this.style.color='#000';" onmouseout="this.style.background='rgba(34,197,94,0.15)'; this.style.color='var(--green)';" onclick="window.openTradeModal('${data.tradeSymbol}', 'BUY')">Buy ${data.tradeSymbol}</button>
                    <button style="flex: 1; padding: 10px 14px; border-radius: 10px; border: none; background: rgba(239,68,68,0.15); color: var(--red); font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--red)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239,68,68,0.15)'; this.style.color='var(--red)';" onclick="window.openTradeModal('${data.tradeSymbol}', 'SELL')">Sell ${data.tradeSymbol}</button>
                </div>`;
      }

      msgContainer.innerHTML += `
                <div class="msg-ai-wrap fade-in">
                    <div class="ai-avatar-sparkle">
                        <span class="material-symbols-outlined ai-sparkle-icon">auto_awesome</span>
                    </div>
                    <div class="msg-content-ai">
                        <div>${data.reply}</div>
                        ${extraHtml}
                    </div>
                </div>
            `;
    } catch (e) {
      msgContainer.innerHTML += `
                <div class="msg-ai-wrap fade-in">
                    <div class="ai-avatar-sparkle" style="border-color:var(--red);">
                        <span class="material-symbols-outlined" style="color:var(--red); font-size:18px;">error</span>
                    </div>
                    <div class="msg-content-ai" style="color:var(--red);">Error: ${e.message}</div>
                </div>
            `;
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  };

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

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
      resultDiv.innerHTML = `<h3 style="color:var(--red); font-family:var(--font-head); margin-bottom:8px;">AI Roast:</h3><p style="font-size:15px; line-height:1.6;">${data.roastText}</p>`;
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

    // Candlestick series
    const candleSeries = currentChart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Volume series (histogram below candlesticks)
    const volumeSeries = currentChart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    if (candles.length > 0) {
      // Set candlestick data
      candleSeries.setData(
        candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );

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

      // Update price display if we got live meta
      if (meta.regularMarketPrice && !meta.mock) {
        const detailPrc = document.getElementById("detailPrc");
        const detailChg = document.getElementById("detailChg");
        const stockForCurrency = marketData.find(
          (m) => m.sym === currentChartSymbol,
        );
        const cs = stockForCurrency?.intl ? "$" : "₹";
        detailPrc.textContent = cs + meta.regularMarketPrice.toFixed(2);

        if (meta.previousClose) {
          const pctChange =
            ((meta.regularMarketPrice - meta.previousClose) /
              meta.previousClose) *
            100;
          detailChg.textContent =
            (pctChange >= 0 ? "+" : "") + pctChange.toFixed(2) + "%";
          detailChg.className = `tint-${pctChange >= 0 ? "up" : "down"}`;
          detailChg.style.color = "";
        }

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
            // Find the series (candles are usually the first series)
            const series = currentChart.series && currentChart.series()[0];
            if (series) {
              // Update with full data to catch any missing candles
              series.setData(
                candles.map((c) => ({
                  time: c.time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                })),
              );
            }

            // Update price labels
            if (meta.regularMarketPrice) {
              const detailPrc = document.getElementById("detailPrc");
              const detailChg = document.getElementById("detailChg");
              const stockForCurrency = marketData.find((m) => m.sym === sym);
              const cs = stockForCurrency?.intl ? "$" : "₹";
              detailPrc.textContent = cs + meta.regularMarketPrice.toFixed(2);

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
    cur(stock) + stock.price.toFixed(2);

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
    .querySelectorAll(".range-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const defaultBtn = document.querySelector('.range-btn[data-range="3mo"]');
  if (defaultBtn) defaultBtn.classList.add("active");

  // Load chart
  await loadChart(sym, "3mo", "1d");
};

// Range button click handlers
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn || !currentChartSymbol) return;

  document
    .querySelectorAll(".range-btn")
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
      const heightPct = Math.max(20, (finalVal / maxVal) * 160); // Max pixel height roughly 160
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="font-size: 11px; font-family: var(--font-mono); font-weight: 600;">${finalVal.toLocaleString()}</div>
            <div style="width: 24px; height: ${heightPct}px; background: var(--green); border-radius: 2px 2px 0 0; transition: height 0.3s ease;"></div>
            <div style="font-size: 11px; color: var(--muted);">${labels[idx]}</div>
        </div>`;
    })
    .join("");

  // Note disclaimer
  const discl = `<div style="position: absolute; right: 0; top: 0; font-size: 10px; color: var(--muted);">*All values are in Rs. ${mod === 4 ? "Crores (Yearly)" : "Crores"}</div>`;
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
                <td style="font-family: var(--font-mono); font-weight: 600;">₹${trade.price.toFixed(2)}</td>
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
  const confirmBtn = document.getElementById("modalConfirmBtn");

  let currentSide = initialSide;

  const updateSideUI = (side) => {
    currentSide = side;
    if (side === "BUY") {
      buyBtn.classList.add("active");
      sellBtn.classList.remove("active");
      sellBtn.style.color = "var(--muted)";
      confirmBtn.style.background = "var(--green)";
      confirmBtn.style.color = "#000";
      confirmBtn.textContent = `CONFIRM BUY ${ticker}`;
    } else {
      sellBtn.classList.add("active");
      buyBtn.classList.remove("active");
      buyBtn.style.color = "var(--muted)";
      confirmBtn.style.background = "var(--red)";
      confirmBtn.style.color = "#fff";
      confirmBtn.textContent = `CONFIRM SELL ${ticker}`;
    }
  };

  buyBtn.onclick = () => updateSideUI("BUY");
  sellBtn.onclick = () => updateSideUI("SELL");
  updateSideUI(initialSide);

  const typeSelect = document.getElementById("orderType");
  const priceInput = document.getElementById("tradePrice");
  const qtyInput = document.getElementById("tradeQty");
  const totalSpan = document.getElementById("modalTotal");

  typeSelect.onchange = () => {
    const isMarket = typeSelect.value === "MARKET";
    priceInput.disabled = isMarket;
    priceInput.style.opacity = isMarket ? "0.4" : "1";
    if (isMarket) priceInput.value = stock.price.toFixed(2);
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
  priceInput.value = (stock.price || 0).toFixed(2);
  priceInput.disabled = true;
  updateTotal();

  modal.classList.remove("hidden");

  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

  newBtn.onclick = async () => {
    const qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0) return alert("Please enter valid quantity");

    try {
      newBtn.textContent = "EXECUTING ORDER...";
      newBtn.disabled = true;

      // ACTUAL LIVE API CALL TO BACKEND
      const res = await apiCall("/trade", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          type: currentSide,
          ticker: ticker,
          quantity: qty,
        }),
      });

      // Update local user state immediately
      currentUser = res.user;
      setAuthUser(currentUser);

      // Refresh all Dashboard UIs
      updateDashboardUI();
      modal.classList.add("hidden");

      // Notification
      const tc = document.getElementById("toastContainer");
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.style.borderLeft = `4px solid ${currentSide === "BUY" ? "var(--green)" : "var(--red)"}`;
      toast.innerHTML = `<span class="material-symbols-outlined" style="color:var(--green)">check_circle</span> 
                <span>Trade ${currentSide} ${qty} ${ticker} Executed Successfully!</span>`;
      tc.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (e) {
      alert("Trade Error: " + e.message);
    } finally {
      newBtn.disabled = false;
    }
  };
};
