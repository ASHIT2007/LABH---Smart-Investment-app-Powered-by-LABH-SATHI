import { apiCall, getAuthUser, logout, setAuthUser } from './api.js';

let currentUser = getAuthUser();
let marketData = [];
let watchlist = JSON.parse(localStorage.getItem('labh_watchlist') || '[]');
let marketSearchQuery = '';

// Currency helper: returns $ for intl stocks, ₹ for NSE
const cur = (stock) => stock.intl ? '$' : '₹';

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('app').style.display = 'block';
    document.getElementById('navUserName').textContent = currentUser.name;
    document.getElementById('welcomeName').textContent = `${currentUser.name}`;
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Theme logic
    const savedTheme = localStorage.getItem('labh_theme') || 'dark';
    document.body.dataset.theme = savedTheme;
    document.getElementById('themeToggleBtn').innerHTML = savedTheme === 'dark' ? '<span class="material-symbols-outlined">light_mode</span>' : '<span class="material-symbols-outlined">dark_mode</span>';
    
    document.getElementById('themeToggleBtn').addEventListener('click', (e) => {
        const isDark = document.body.dataset.theme === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.body.dataset.theme = newTheme;
        e.currentTarget.innerHTML = newTheme === 'dark' ? '<span class="material-symbols-outlined">light_mode</span>' : '<span class="material-symbols-outlined">dark_mode</span>';
        localStorage.setItem('labh_theme', newTheme);
    });

    document.getElementById('marketSearch')?.addEventListener('input', (e) => {
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
    document.getElementById('aiWidgetBubble').addEventListener('click', () => {
        document.getElementById('aiWidgetPanel').classList.toggle('hidden');
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
let commodityFilter = 'all';

const CATEGORY_COLORS = {
    'Energy': '#F97316',
    'Precious Metals': '#F7931A',
    'Base Metals': '#6366F1',
    'Grains': '#22C55E',
    'Softs': '#EC4899',
};

const CATEGORY_ICONS = {
    'Energy': 'local_gas_station',
    'Precious Metals': 'diamond',
    'Base Metals': 'hardware',
    'Grains': 'grass',
    'Softs': 'coffee',
};

async function fetchCommoditiesLoop() {
    try {
        commoditiesData = await apiCall('/commodities');
        renderCommodities();
    } catch (e) { console.error('Commodities fetch error:', e); }
    setTimeout(fetchCommoditiesLoop, 10000);
}

function renderCommodities() {
    const grid = document.getElementById('commoditiesGrid');
    if (!grid) return;

    const filtered = commodityFilter === 'all'
        ? commoditiesData
        : commoditiesData.filter(c => c.category === commodityFilter);

    grid.innerHTML = filtered.map(c => {
        const isUp = c.change >= 0;
        const color = CATEGORY_COLORS[c.category] || '#8E929B';
        const icon = CATEGORY_ICONS[c.category] || 'sell';
        return `
        <div class="commodity-card">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="material-symbols-outlined" style="font-size:16px; color:${color};">${icon}</span>
                <span class="c-name">${c.name}</span>
            </div>
            <div class="c-unit">${c.unit}</div>
            <div class="c-price" style="color: var(--text); font-family: var(--font-mono);">${c.price > 0 ? c.price.toFixed(2) : '—'}</div>
            <div class="c-change tint-${isUp ? 'up' : 'down'}">${c.price > 0 ? ((isUp ? '+' : '') + c.change.toFixed(2) + '%') : 'Loading...'}</div>
        </div>`;
    }).join('');
}

function setupCommodityFilters() {
    const container = document.getElementById('commodityFilters');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        container.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        commodityFilter = btn.dataset.cat;
        renderCommodities();
    });
}

// --- STOCK NEWS ---
async function fetchNewsLoop() {
    try {
        const news = await apiCall('/news');
        renderNews(news);
    } catch (e) { console.error('News fetch error:', e); }
    setTimeout(fetchNewsLoop, 60000); // Refresh every 60s
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function renderNews(news) {
    const grid = document.getElementById('stockNewsGrid');
    if (!grid || !news.length) return;

    // Show up to 6 cards
    const items = news.slice(0, 6);

    grid.innerHTML = items.map(item => {
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

        const name = stock ? stock.name : (item.source || 'Market News');
        const isUp = stock ? stock.change >= 0 : true;
        const changeHTML = stock
            ? `<span class="news-change tint-${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${stock.change.toFixed(2)}%</span>`
            : '';

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
    }).join('');
}

// --- SENTIMENT ENGINE ---
let sentimentData = null;
let sentimentLoading = false;

async function fetchSentiment() {
    if (sentimentLoading) return;
    sentimentLoading = true;

    const btn = document.getElementById('sentimentRefreshBtn');
    const grid = document.getElementById('sentimentHeadlines');

    // Visual feedback
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; animation: chartSpin 0.8s linear infinite;">refresh</span> Analyzing...';
    }

    // Show skeleton while loading
    if (grid && !sentimentData) {
        grid.innerHTML = Array(4).fill('<div class="sentiment-card skeleton" style="height: 180px;"></div>').join('');
    }

    try {
        sentimentData = await apiCall('/sentiment');
        renderSentiment();
    } catch (e) {
        console.error('Sentiment fetch error:', e);
        if (grid) grid.innerHTML = `<div style="text-align:center; color:var(--muted); padding: 40px; grid-column: 1 / -1;">
            <span class="material-symbols-outlined" style="font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.5;">sentiment_dissatisfied</span>
            Failed to load sentiment analysis. Try again later.
        </div>`;
    } finally {
        sentimentLoading = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">refresh</span> Re-Analyze';
        }
    }
}

function renderSentiment() {
    if (!sentimentData) return;

    const { headlines, overallMood, moodScore, marketSummary, analyzedAt, aiPowered } = sentimentData;

    // AI Badge
    const aiBadge = document.getElementById('sentimentAiBadge');
    if (aiBadge) aiBadge.style.display = aiPowered ? 'inline-flex' : 'none';

    // Gauge
    const scoreDisplay = document.getElementById('sentimentScoreDisplay');
    const moodLabel = document.getElementById('sentimentMoodLabel');
    const arc = document.getElementById('sentimentArc');
    const timestamp = document.getElementById('sentimentTimestamp');

    if (scoreDisplay) scoreDisplay.textContent = moodScore;

    const moodColor = moodScore >= 60 ? 'var(--green)' : moodScore <= 40 ? 'var(--red)' : 'var(--gold)';
    const moodEmoji = moodScore >= 70 ? '🟢' : moodScore >= 55 ? '🟡' : moodScore <= 30 ? '🔴' : moodScore <= 45 ? '🟠' : '⚪';

    if (moodLabel) {
        moodLabel.textContent = `${moodEmoji} ${overallMood}`;
        moodLabel.style.color = moodColor;
    }

    // Arc: total semicircle length ≈ 251.33
    const arcLen = 251.33;
    const fill = (moodScore / 100) * arcLen;
    if (arc) {
        arc.setAttribute('stroke', moodColor);
        arc.setAttribute('stroke-dasharray', `${fill}, ${arcLen}`);
    }

    if (timestamp && analyzedAt) {
        timestamp.textContent = `Analyzed ${timeAgo(analyzedAt)}`;
    }

    // Summary
    const summary = document.getElementById('sentimentSummary');
    if (summary) summary.textContent = marketSummary || 'AI summary available when GROQ_API_KEY is configured.';

    // Breakdown Stats
    const bullCount = headlines.filter(h => h.sentiment === 'bullish').length;
    const bearCount = headlines.filter(h => h.sentiment === 'bearish').length;
    const neutralCount = headlines.filter(h => h.sentiment === 'neutral').length;
    const total = headlines.length || 1;

    document.getElementById('sentimentBullCount').textContent = bullCount;
    document.getElementById('sentimentNeutralCount').textContent = neutralCount;
    document.getElementById('sentimentBearCount').textContent = bearCount;
    document.getElementById('sentimentBreakdownText').textContent = `${bullCount}B / ${neutralCount}N / ${bearCount}Be`;

    // Breakdown bar widths
    document.getElementById('sentimentBarBull').style.width = `${(bullCount / total) * 100}%`;
    document.getElementById('sentimentBarNeutral').style.width = `${(neutralCount / total) * 100}%`;
    document.getElementById('sentimentBarBear').style.width = `${(bearCount / total) * 100}%`;

    // Headline Cards
    const grid = document.getElementById('sentimentHeadlines');
    if (!grid) return;

    grid.innerHTML = headlines.map(h => {
        const sentColor = h.sentiment === 'bullish' ? 'var(--green)' : h.sentiment === 'bearish' ? 'var(--red)' : 'var(--muted)';
        const sentIcon = h.sentiment === 'bullish' ? 'trending_up' : h.sentiment === 'bearish' ? 'trending_down' : 'trending_flat';
        const confPct = Math.round(h.confidence * 100);
        const stockTag = h.stock ? `<span style="font-size: 11px; color: var(--accent); font-weight: 600;">${h.stock.sym}</span>` : '';
        const keywordsHTML = (h.keywords || []).map(k => `<span class="keyword-tag">${k}</span>`).join('');

        return `
        <a href="${h.link}" target="_blank" rel="noopener" class="sentiment-card sentiment-${h.sentiment}" style="text-decoration: none; color: inherit;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 600; line-height: 1.5; margin-bottom: 2px; color: var(--text);">${h.title}</div>
                    <div style="font-size: 11px; color: var(--muted); display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                        <span>${h.source}</span>
                        <span>·</span>
                        <span>${timeAgo(h.pubDate)}</span>
                        ${stockTag ? `<span>·</span> ${stockTag}` : ''}
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
            ${keywordsHTML ? `<div class="sentiment-keywords">${keywordsHTML}</div>` : ''}
        </a>`;
    }).join('');
}

function setupSentiment() {
    const btn = document.getElementById('sentimentRefreshBtn');
    if (btn) btn.addEventListener('click', () => {
        sentimentData = null;
        fetchSentiment();
    });

    // Lazy load: fetch on tab switch to Sentiment
    const origSwitchTab = window.switchTab;
    window.switchTab = (tabId) => {
        origSwitchTab(tabId);
        if (tabId === 'sentiment' && !sentimentData && !sentimentLoading) {
            fetchSentiment();
        }
    };
}
// --- END SENTIMENT ENGINE ---

function setupDragAndDrop() {
    const container = document.getElementById('dashboardWidgets');
    if(!container) return;
    
    const savedOrder = JSON.parse(localStorage.getItem('labh_widget_order') || '[]');
    if (savedOrder.length > 0) {
        savedOrder.forEach(id => {
            const el = document.querySelector(`[data-widget-id="${id}"]`);
            if(el) container.appendChild(el);
        });
    }

    let draggedEl = null;

    container.addEventListener('dragstart', e => {
        draggedEl = e.target.closest('.dashboard-widget');
        if(draggedEl) setTimeout(() => draggedEl.style.opacity = '0.5', 0);
    });

    container.addEventListener('dragend', e => {
        if(draggedEl) draggedEl.style.opacity = '1';
        draggedEl = null;
        const newOrder = [...container.querySelectorAll('.dashboard-widget')].map(el => el.dataset.widgetId);
        localStorage.setItem('labh_widget_order', JSON.stringify(newOrder));
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const widget = e.target.closest('.dashboard-widget');
        
        if (draggedEl && widget && draggedEl !== widget) {
            if (afterElement == null) {
                container.appendChild(draggedEl);
            } else {
                container.insertBefore(draggedEl, afterElement);
            }
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.dashboard-widget:not([style*="opacity: 0.5"])')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

async function fetchMe() {
    try {
        const data = await apiCall(`/auth/me?email=${currentUser.email}`);
        currentUser = data.user;
        setAuthUser(currentUser);
        updateDashboardUI();
    } catch (e) {
        if(e.message === 'Not found') logout();
    }
}

window.toggleWatchlist = (sym) => {
    if (watchlist.includes(sym)) {
        watchlist = watchlist.filter(s => s !== sym);
    } else {
        watchlist.push(sym);
    }
    localStorage.setItem('labh_watchlist', JSON.stringify(watchlist));
    updateMarketsTable();
};

async function fetchMarketsLoop() {
    try {
        marketData = await apiCall('/markets');
        updateMarketsTable();
    } catch (e) { console.error(e); }
    setTimeout(fetchMarketsLoop, 5000); // Poll purely for demonstration 
}


function updateDashboardUI() {
    // Balances
    document.getElementById('homeCash').textContent = `₹${currentUser.balance.toLocaleString('en-IN', {maximumFractionDigits:2})}`;
    
    let portValue = 0;
    currentUser.portfolio.forEach(p => {
        const mStock = marketData.find(m => m.sym === p.ticker);
        portValue += p.qty * (mStock ? mStock.price : p.avgPrice);
    });
    document.getElementById('homePortfolioValue').textContent = `₹${portValue.toLocaleString('en-IN', {maximumFractionDigits:2})}`;

    // Portfolio Table
    const tbody = document.querySelector('#portfolioTable tbody');
    if (currentUser.portfolio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No holdings yet.</td></tr>';
    } else {
        tbody.innerHTML = currentUser.portfolio.map(p => {
            const currentPrice = marketData.find(m => m.sym === p.ticker)?.price || p.avgPrice;
            const pl = (currentPrice - p.avgPrice) * p.qty;
            const isProfit = pl >= 0;
            return `
                <tr>
                    <td style="font-weight:bold;">${p.ticker}</td>
                    <td>${p.qty}</td>
                    <td style="font-family:var(--font-mono);">₹${p.avgPrice.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono);">₹${currentPrice.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isProfit ? 'up' : 'down'}">${isProfit ? '+' : ''}₹${pl.toFixed(2)}</span></td>
                    <td><button class="trade-action-btn" onclick="window.openTradeModal('${p.ticker}', 'SELL')">Sell</button></td>
                </tr>
            `;
        }).join('');
    }

    // History Table
    const htbody = document.querySelector('#historyTable tbody');
    const trades = currentUser.trades || [];
    if (trades.length === 0) {
        htbody.innerHTML = '<tr><td colspan="6">No trading history yet.</td></tr>';
    } else {
        htbody.innerHTML = [...trades].reverse().map(t => {
            const dateStr = new Date(t.date).toLocaleString('en-IN');
            return `
                <tr>
                    <td style="color:var(--muted); font-size:13px;">${dateStr}</td>
                    <td style="font-weight:bold;"><span class="tint-${t.type==='BUY'?'up':'down'}">${t.type}</span></td>
                    <td style="font-weight:bold;">${t.ticker}</td>
                    <td>${t.qty}</td>
                    <td style="font-family:var(--font-mono);">₹${t.price.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono); font-weight:bold;">₹${t.total.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }
}

// Reusable logo helper
function stockLogo(stock, size = 40) {
    if (stock.logo) {
        return `<img src="${stock.logo}" alt="${stock.sym}" style="width:${size}px; height:${size}px; border-radius:10px; object-fit:contain; background:#fff; border: 1px solid var(--border);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div style="display:none; width:${size}px; height:${size}px; border-radius:10px; background:var(--card-inset); align-items:center; justify-content:center; font-weight:bold; font-size:${Math.round(size*0.45)}px; border: 1px solid var(--border); flex-shrink:0;">${stock.sym[0]}</div>`;
    }
    return `<div style="width:${size}px; height:${size}px; border-radius:10px; background:var(--card-inset); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:${Math.round(size*0.45)}px; border: 1px solid var(--border); flex-shrink:0;">${stock.sym[0]}</div>`;
}

function updateMarketsTable() {
    // Movers List (Home tab)
    const homeMovers = document.getElementById('moversList');
    const top4 = [...marketData].sort((a,b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4);
    homeMovers.innerHTML = top4.map(stock => {
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
                <div class="tint-${isUp ? 'up' : 'down'}" style="font-size:12px; font-weight:600; font-family:var(--font-mono);">${isUp ? '+' : ''}${stock.change.toFixed(2)}%</div>
            </div>
        </div>
        `;
    }).join('');

    // Market Overview horizontal scroller (Home Tab)
    const marketScroll = document.getElementById('marketOverviewList');
    marketScroll.innerHTML = [...marketData].slice(0,5).map(stock => {
        const isUp = stock.change >= 0;
        return `
        <div class="market-item" style="cursor:pointer;" onclick="window.openStockDetail('${stock.sym}')">
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                ${stockLogo(stock, 28)}
                <div style="font-size:13px; color:var(--muted); font-weight:600;">${stock.sym}</div>
            </div>
            <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; margin:4px 0;">${cur(stock)}${stock.price.toFixed(2)}</div>
            <div class="tint-${isUp ? 'up' : 'down'}" style="font-size:13px; font-weight:600; font-family:var(--font-mono);">${isUp?'+':''}${stock.change.toFixed(2)}%</div>
        </div>
        `;
    }).join('');

    // Filtered Full Table (Markets tab)
    const ftbody = document.querySelector('#fullMarketTable tbody');
    const filteredMarket = marketData.filter(m => m.sym.toLowerCase().includes(marketSearchQuery) || m.name.toLowerCase().includes(marketSearchQuery));
    
    const rowHTML = (stock) => {
        const isUp = stock.change >= 0;
        const isWatched = watchlist.includes(stock.sym);
        return `
            <tr>
                <td><button onclick="window.toggleWatchlist('${stock.sym}')" style="background:transparent; border:none; cursor:pointer; color: var(--${isWatched ? 'gold' : 'muted'}); transition: 0.2s; display: flex; align-items: center; justify-content: center;" title="Toggle Watchlist"><span class="material-symbols-outlined" style="font-size:24px; font-variation-settings: 'FILL' ${isWatched ? 1 : 0};">star</span></button></td>
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
                <td style="font-family:var(--font-mono); font-weight:bold;"><span class="tint-${isUp?'up':'down'}">${isUp?'+':''}${stock.change.toFixed(2)}%</span></td>
                <td><button class="trade-action-btn" onclick="window.openTradeModal('${stock.sym}', 'BUY')">Trade</button></td>
            </tr>
        `;
    };

    ftbody.innerHTML = filteredMarket.map(rowHTML).join('');

    // Watchlist Table
    const wtbody = document.querySelector('#watchlistTable tbody');
    const wContainer = document.getElementById('watchlistContainer');
    const wHeader = document.getElementById('watchlistHeader');
    
    const watchedStocks = marketData.filter(m => watchlist.includes(m.sym));
    if (watchedStocks.length > 0 && wContainer) {
        wContainer.classList.remove('hidden');
        wHeader.classList.remove('hidden');
        wtbody.innerHTML = watchedStocks.map(rowHTML).join('');
    } else if (wContainer) {
        wContainer.classList.add('hidden');
        wHeader.classList.add('hidden');
    }

    // Ticker Update
    const tickerContainer = document.getElementById('tickerContent');
    tickerContainer.innerHTML = marketData.map(stock => {
        const isUp = stock.change >= 0;
        return `<div class="ticker-item"><span style="color:var(--muted)">${stock.sym}</span> <span style="font-family:var(--font-mono);">${cur(stock)}${stock.price.toFixed(2)}</span> <span class="tint-${isUp?'up':'down'}">${isUp?'+':''}${stock.change.toFixed(2)}%</span></div>`;
    }).join('');
    // Duplicate for smooth infinite scrolling
    tickerContainer.innerHTML += tickerContainer.innerHTML;
    
    // Auto-update portfolio calculations since prices changed
    updateDashboardUI();
}

// Global Tab switcher
window.switchTab = (tabId) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.dashboard-wrap').forEach(el => el.classList.add('hidden'));
    
    const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if(navItem) navItem.classList.add('active');
    
    const target = document.getElementById(tabId + 'Tab');
    if(target) target.classList.remove('hidden');
};

function setupTabs() {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => switchTab(el.dataset.tab));
    });
}

// Chat
function setupChat() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    const msgContainer = document.getElementById('chatMessages');

    const sendMessage = async () => {
        const text = input.value.trim();
        if(!text) return;
        input.value = '';

        msgContainer.innerHTML += `<div style="max-width:80%; align-self:flex-end; background:rgba(255,255,255,0.1); border-radius:12px; padding:14px; margin-bottom:10px; font-size:15px; border-bottom-right-radius:2px; margin-left:auto;">${text}</div>`;
        msgContainer.scrollTop = msgContainer.scrollHeight;

        try {
            const data = await apiCall('/vibe-trade', {
                method: 'POST', body: JSON.stringify({ prompt: text })
            });
            msgContainer.innerHTML += `<div style="max-width:80%; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); border-radius:12px; padding:14px; margin-bottom:10px; font-size:15px; border-bottom-left-radius:2px;">${data.reply}</div>`;
        } catch (e) {
            msgContainer.innerHTML += `<div style="max-width:80%; color:var(--red); padding:14px;">Error: ${e.message}</div>`;
        }
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());
}

// Roast
function setupRoast() {
    const btn = document.getElementById('roastBtn');
    const resultDiv = document.getElementById('roastResult');

    btn.addEventListener('click', async () => {
        if(currentUser.portfolio.length === 0) return alert('Your portfolio is empty. Nothing to roast!');
        btn.textContent = 'Roasting...';
        try {
            const data = await apiCall('/roast', {
                method: 'POST', body: JSON.stringify({ portfolio: currentUser.portfolio })
            });
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = `<h3 style="color:var(--red); font-family:var(--font-head); margin-bottom:8px;">AI Roast:</h3><p style="font-size:15px; line-height:1.6;">${data.roastText}</p>`;
        } catch (e) {
            alert('Roast failed: ' + e.message);
        } finally {
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">local_fire_department</span> Roast My Portfolio';
        }
    });
}

// Chart Instance
let currentChart = null;
let currentChartSymbol = null;

async function loadChart(sym, range = '3mo', interval = '1d') {
    const container = document.getElementById('chartContainer');
    const loader = document.getElementById('chartLoader');
    const liveBadge = document.getElementById('chartLiveBadge');
    
    // Show loader
    if (loader) loader.style.display = 'flex';
    if (liveBadge) liveBadge.style.display = 'none';
    
    // Clean up previous chart
    if (currentChart) {
        currentChart.remove();
        currentChart = null;
    }
    // Remove any old chart canvas but keep the loader
    Array.from(container.children).forEach(child => {
        if (child.id !== 'chartLoader') child.remove();
    });

    const isDark = document.body.dataset.theme === 'dark';

    // --- Market Closed Detection (1D only) ---
    if (range === '1d') {
        const now = new Date();
        // Convert to IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
        const day = ist.getDay(); // 0=Sun, 6=Sat
        const mm = String(ist.getMonth() + 1).padStart(2, '0');
        const dd = String(ist.getDate()).padStart(2, '0');
        const dateStr = `${mm}-${dd}`;

        // NSE holidays 2025-2026 (MM-DD)
        const nseHolidays = [
            '01-26','02-26','03-14','03-31','04-10','04-14','04-18',
            '05-01','06-27','08-15','08-16','08-27','10-02','10-20',
            '10-21','10-22','11-05','11-26','12-25',
            '01-15','03-10','03-17','03-30','04-03','04-06',
            '04-14','05-01','06-17','07-07','08-15','08-19',
            '09-08','10-02','10-12','10-20','11-24','12-25'
        ];

        const isWeekend = (day === 0 || day === 6);
        const isHoliday = nseHolidays.includes(dateStr);

        if (isWeekend || isHoliday) {
            if (loader) loader.style.display = 'none';
            const reason = isWeekend
                ? (day === 0 ? 'Sunday' : 'Saturday')
                : 'a public holiday';
            container.insertAdjacentHTML('beforeend', `
                <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; z-index:15; background: var(--card-inset); border-radius: 8px;">
                    <span class="material-symbols-outlined" style="font-size:48px; color:var(--gold); opacity:0.8;">event_busy</span>
                    <div style="font-size:16px; font-weight:700; color:var(--text);">Market Closed Today</div>
                    <div style="font-size:13px; color:var(--muted); text-align:center; max-width:260px; line-height:1.5;">
                        The Indian stock market (NSE) is closed today because it's <strong style="color:var(--gold);">${reason}</strong>.<br>Intraday data will be available on the next trading day.
                    </div>
                    <div style="margin-top:8px; font-size:11px; color:var(--muted); font-family:var(--font-mono);">Try 1W, 1M, or 3M for historical data</div>
                </div>
            `);
            return;
        }
    }
    // --- End Market Closed Detection ---

    try {
        // Fetch data from our backend API
        const response = await apiCall(`/chart/${sym}?range=${range}&interval=${interval}`);
        const candles = response.candles || [];
        const meta = response.meta || {};

        // Create the chart
        currentChart = LightweightCharts.createChart(container, {
            autoSize: true,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: isDark ? '#D9D9D9' : '#191919',
            },
            grid: {
                vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
                horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', style: 0, width: 1 },
                horzLine: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', style: 0, width: 1 },
            },
            rightPriceScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            },
            timeScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                timeVisible: interval.includes('m'),
            },
        });

        // Candlestick series
        const candleSeries = currentChart.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Volume series (histogram below candlesticks)
        const volumeSeries = currentChart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        if (candles.length > 0) {
            // Set candlestick data
            candleSeries.setData(candles.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            })));

            // Set volume data with color
            volumeSeries.setData(candles.map(c => ({
                time: c.time,
                value: c.volume || 0,
                color: c.close >= c.open
                    ? 'rgba(34, 197, 94, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)',
            })));

            // Update price display if we got live meta
            if (meta.regularMarketPrice && !meta.mock) {
                const detailPrc = document.getElementById('detailPrc');
                const detailChg = document.getElementById('detailChg');
                const stockForCurrency = marketData.find(m => m.sym === currentChartSymbol);
                const cs = stockForCurrency?.intl ? '$' : '₹';
                detailPrc.textContent = cs + meta.regularMarketPrice.toFixed(2);

                if (meta.previousClose) {
                    const pctChange = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100);
                    detailChg.textContent = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%';
                    detailChg.className = `tint-${pctChange >= 0 ? 'up' : 'down'}`;
                    detailChg.style.color = '';
                }

                if (liveBadge) liveBadge.style.display = 'inline-block';
            }
        }

        // Fit content
        currentChart.timeScale().fitContent();
        setTimeout(() => {
            if (currentChart) currentChart.timeScale().fitContent();
        }, 150);

    } catch (e) {
        console.error('Chart loading failed:', e);
        container.insertAdjacentHTML('beforeend',
            `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">
                Chart data unavailable
            </div>`
        );
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

window.openStockDetail = async (sym) => {
    const stock = marketData.find(m => m.sym === sym);
    if (!stock) return;

    currentChartSymbol = sym;
    document.getElementById('stockDetailModal').classList.remove('hidden');

    // UI Updates
    document.getElementById('detailLogo').innerHTML = stockLogo(stock, 48);
    document.getElementById('detailSym').textContent = stock.sym;
    document.getElementById('detailName').textContent = stock.name;
    document.getElementById('detailPrc').textContent = cur(stock) + stock.price.toFixed(2);

    const chgEl = document.getElementById('detailChg');
    chgEl.textContent = (stock.change >= 0 ? '+' : '') + stock.change.toFixed(2) + '%';
    chgEl.className = `tint-${stock.change >= 0 ? 'up' : 'down'}`;
    chgEl.style.color = '';

    document.getElementById('detailTradeBtn').onclick = () => {
        document.getElementById('stockDetailModal').classList.add('hidden');
        window.openTradeModal(stock.sym, 'BUY');
    };

    // Financials
    document.getElementById('detailMktCap').textContent = stock.mktCap || 'N/A';
    document.getElementById('detailPE').textContent = stock.peRatio || 'N/A';
    document.getElementById('detail52W').textContent = `${cur(stock)}${stock.week52High || '-'} / ${cur(stock)}${stock.week52Low || '-'}`;
    document.getElementById('detailVol').textContent = stock.volume || 'N/A';

    // Reset range buttons to 3M active
    document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
    const defaultBtn = document.querySelector('.range-btn[data-range="3mo"]');
    if (defaultBtn) defaultBtn.classList.add('active');

    // Load chart
    await loadChart(sym, '3mo', '1d');
};

// Range button click handlers
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.range-btn');
    if (!btn || !currentChartSymbol) return;

    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const range = btn.dataset.range;
    const interval = btn.dataset.interval;
    await loadChart(currentChartSymbol, range, interval);
});

// Trade Modal Global Functions
window.openTradeModal = (ticker, type) => {
    const stock = marketData.find(m => m.sym === ticker);
    if(!stock) return;

    const modal = document.getElementById('tradeModal');
    const actionSpan = document.getElementById('modalAction');
    
    actionSpan.textContent = type;
    actionSpan.style.color = type === 'BUY' ? 'var(--green)' : 'var(--red)';
    document.getElementById('modalSym').textContent = ticker;
    document.getElementById('modalPrc').textContent = stock.price.toFixed(2);
    
    const qtyInput = document.getElementById('tradeQty');
    const totalSpan = document.getElementById('modalTotal');
    qtyInput.value = 1;

    const updateTotal = () => { totalSpan.textContent = (stock.price * Math.max(1, qtyInput.value)).toFixed(2); };
    qtyInput.oninput = updateTotal;
    updateTotal();

    modal.classList.remove('hidden');

    const confirmBtn = document.getElementById('modalConfirmBtn');
    confirmBtn.style.background = type === 'BUY' ? 'var(--green)' : 'var(--red)';
    confirmBtn.style.color = type === 'BUY' ? '#000' : '#fff';

    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', async () => {
        const qty = qtyInput.value;
        try {
            newBtn.textContent = 'Executing...';
            newBtn.disabled = true;
            await apiCall('/trade', {
                method: 'POST',
                body: JSON.stringify({ userId: currentUser.id, type, ticker, quantity: parseInt(qty) })
            });
            modal.classList.add('hidden');
            
            // Show toast
            const tc = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<span class="material-symbols-outlined" style="color: var(--green); font-size:20px; vertical-align: middle; margin-right: 8px;">check_circle</span> <span>Executed ${type} for ${qty} ${ticker}</span>`;
            tc.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

            await fetchMe(); 
        } catch (e) {
            alert('Trade Error: ' + e.message);
        } finally {
            newBtn.textContent = 'Confirm';
            newBtn.disabled = false;
        }
    });
};
