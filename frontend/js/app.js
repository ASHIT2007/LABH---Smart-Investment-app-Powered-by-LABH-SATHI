import { apiCall, getAuthUser, logout, setAuthUser } from './api.js';

let currentUser = getAuthUser();
let marketData = [];
let watchlist = JSON.parse(localStorage.getItem('labh_watchlist') || '[]');
let marketSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('app').style.display = 'block';
    document.getElementById('navUserName').textContent = currentUser.name;
    document.getElementById('welcomeName').textContent = `${currentUser.name} 👋`;
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Theme logic
    const savedTheme = localStorage.getItem('labh_theme') || 'dark';
    document.body.dataset.theme = savedTheme;
    document.getElementById('themeToggleBtn').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    
    document.getElementById('themeToggleBtn').addEventListener('click', (e) => {
        const isDark = document.body.dataset.theme === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.body.dataset.theme = newTheme;
        e.target.textContent = newTheme === 'dark' ? '☀️' : '🌙';
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
});

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
                    <td style="font-family:var(--font-mono); color:var(--${isProfit ? 'green' : 'red'}); font-weight:bold;">${isProfit ? '+' : ''}₹${pl.toFixed(2)}</td>
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
                    <td style="font-weight:bold; color:var(--${t.type==='BUY'?'green':'red'});">${t.type}</td>
                    <td style="font-weight:bold;">${t.ticker}</td>
                    <td>${t.qty}</td>
                    <td style="font-family:var(--font-mono);">₹${t.price.toFixed(2)}</td>
                    <td style="font-family:var(--font-mono); font-weight:bold;">₹${t.total.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }
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
                <div style="width:40px; height:40px; border-radius:8px; background:var(--card-inset); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">${stock.sym[0]}</div>
                <div onclick="window.openStockDetail('${stock.sym}')" class="symbol-link" style="cursor:pointer;">
                    <div style="font-weight:600; font-size:15px;">${stock.sym}</div>
                    <div style="font-size:12px; color:var(--muted);">${stock.name}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:600; font-size:15px; font-family:var(--font-mono);">₹${stock.price.toFixed(2)}</div>
                <div style="font-size:12px; font-weight:600; font-family:var(--font-mono); color:var(--${isUp ? 'green' : 'red'});">${isUp ? '+' : ''}${stock.change.toFixed(2)}%</div>
            </div>
        </div>
        `;
    }).join('');

    // Market Overview horizontal scroller (Home Tab)
    const marketScroll = document.getElementById('marketOverviewList');
    marketScroll.innerHTML = [...marketData].slice(0,5).map(stock => {
        const isUp = stock.change >= 0;
        return `
        <div class="market-item">
            <div style="font-size:13px; color:var(--muted); font-weight:600;">${stock.sym}</div>
            <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; margin:6px 0;">₹${stock.price.toFixed(2)}</div>
            <div style="font-size:13px; font-weight:600; font-family:var(--font-mono); color:var(--${isUp?'green':'red'});">${isUp?'+':''}${stock.change.toFixed(2)}%</div>
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
                <td><button onclick="window.toggleWatchlist('${stock.sym}')" style="background:transparent; border:none; font-size:20px; cursor:pointer; color: var(--${isWatched ? 'gold' : 'muted'}); transition: 0.2s;" title="Toggle Watchlist">${isWatched ? '★' : '☆'}</button></td>
                <td style="font-weight:bold; cursor:pointer;" onclick="window.openStockDetail('${stock.sym}')" class="symbol-link">${stock.sym}</td>
                <td style="color:var(--muted); font-size:13px;">${stock.name}</td>
                <td style="font-family:var(--font-mono); font-weight:bold;">₹${stock.price.toFixed(2)}</td>
                <td style="font-family:var(--font-mono); font-weight:bold; color:var(--${isUp?'green':'red'});">${isUp?'+':''}${stock.change.toFixed(2)}%</td>
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
        return `<div class="ticker-item"><span style="color:var(--muted)">${stock.sym}</span> ₹${stock.price.toFixed(2)} <span style="color:var(--${isUp?'green':'red'})">${isUp?'+':''}${stock.change.toFixed(2)}%</span></div>`;
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
            btn.textContent = '🔥 Roast My Portfolio';
        }
    });
}

// Chart Instance
let currentChart = null;
window.openStockDetail = (sym) => {
    const stock = marketData.find(m => m.sym === sym);
    if(!stock) return;

    document.getElementById('stockDetailModal').classList.remove('hidden');

    // UI Updates
    document.getElementById('detailSym').textContent = stock.sym;
    document.getElementById('detailName').textContent = stock.name;
    document.getElementById('detailPrc').textContent = '₹' + stock.price.toFixed(2);
    
    const chgEl = document.getElementById('detailChg');
    chgEl.textContent = (stock.change >= 0 ? '+' : '') + stock.change.toFixed(2) + '%';
    chgEl.style.color = stock.change >= 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('detailTradeBtn').onclick = () => {
        document.getElementById('stockDetailModal').classList.add('hidden');
        window.openTradeModal(stock.sym, 'BUY');
    };

    // Financials
    document.getElementById('detailMktCap').textContent = stock.mktCap || 'N/A';
    document.getElementById('detailPE').textContent = stock.peRatio || 'N/A';
    document.getElementById('detail52W').textContent = `₹${stock.week52High || '-'} / ₹${stock.week52Low || '-'}`;
    document.getElementById('detailVol').textContent = stock.volume || 'N/A';

    // Charting
    const container = document.getElementById('chartContainer');
    container.innerHTML = ''; // Clear old chart
    
    const isDark = document.body.dataset.theme === 'dark';
    
    try {
        currentChart = LightweightCharts.createChart(container, {
            layout: {
                background: { type: LightweightCharts.ColorType.Solid, color: 'transparent' },
                textColor: isDark ? '#D9D9D9' : '#111827',
            },
            grid: {
                vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)' },
                horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)' }
            },
            width: container.clientWidth,
            height: container.clientHeight,
        });

        const candlestickSeries = currentChart.addCandlestickSeries({
            upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        });

        const data = [];
        let curPrice = stock.price * 0.9;
        const now = new Date();
        for(let i=30; i>=0; i--) {
            const time = new Date(now);
            time.setDate(now.getDate() - i);
            const open = curPrice;
            const close = i === 0 ? stock.price : curPrice * (1 + (Math.random()*0.04 - 0.02));
            const high = Math.max(open, close) * (1 + Math.random()*0.01);
            const low = Math.min(open, close) * (1 - Math.random()*0.01);
            // Format object correctly for Lightweight charts (string year-month-day)
            data.push({ time: time.toISOString().split('T')[0], open, high, low, close });
            curPrice = close;
        }

        candlestickSeries.setData(data);
        setTimeout(() => currentChart.timeScale().fitContent(), 100);
    } catch (e) { console.error("Chart loading failed:", e); }
};

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
            toast.innerHTML = `<span style="font-size:18px;">✅</span> <span>Executed ${type} for ${qty} ${ticker}</span>`;
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
