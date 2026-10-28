// Global State
let allTrades = [];
let filteredDashboardTrades = [];
let dashboardFilters = {
    symbol: 'ALL',
    dateRange: 'ALL',
    equityMode: 'trade'
};
let currentSort = { column: 'tradeDate', direction: 'desc' };
let currentPage = 1;
const pageSize = 20;
let filteredLogTrades = [];

// Chart.js instances registry
const chartInstances = {};

function renderChart(canvasId, config) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, config);
    chartInstances[canvasId] = chart;
    return chart;
}

// Global Chart.js styling defaults
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Plus Jakarta Sans', -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.tooltip.backgroundColor = '#162032';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.12)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
}

async function init() {
    setupTabNavigation();
    setupActions();
    setupDashboardControls();
    setupTradeLogControls();

    await loadTrades();
    await updateStatus();
}

// Tab Switching
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            if (targetTab === 'dashboard') {
                // Ensure Chart.js recalculates dimensions on tab restore
                setTimeout(() => {
                    Object.values(chartInstances).forEach(c => c.resize());
                }, 50);
            }
        });
    });
}

// Header Actions (Sync, Upload, Clear)
function setupActions() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.disabled = true;
            setConnectionStatus('syncing', 'Syncing...');
            try {
                const res = await API.syncFromIBKR();
                if (res.notice) {
                    setBannerStatus(res.notice);
                } else if (res.error) {
                    setBannerStatus(`Error: ${res.error}`);
                } else {
                    await loadTrades();
                }
            } catch (e) {
                setBannerStatus(`Sync error: ${e.message}`);
            } finally {
                syncBtn.disabled = false;
                await updateStatus();
            }
        });
    }

    const uploadInput = document.getElementById('uploadInput');
    if (uploadInput) {
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const res = await API.uploadXML(file);
                if (res.error) {
                    setBannerStatus(`Upload error: ${res.error}`);
                } else {
                    await loadTrades();
                }
            } catch (e) {
                setBannerStatus(`Upload error: ${e.message}`);
            }
            e.target.value = '';
        });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear all locally stored trades?')) return;
            try {
                await API.clearData();
                allTrades = [];
                renderAll();
            } catch (e) {
                setBannerStatus(`Error: ${e.message}`);
            }
        });
    }
}

// Dashboard Toolbar (Filters, Mode Toggle)
function setupDashboardControls() {
    const symbolSelect = document.getElementById('dashSymbolFilter');
    symbolSelect.addEventListener('change', () => {
        dashboardFilters.symbol = symbolSelect.value;
        renderDashboard();
    });

    const dateFilters = document.getElementById('dashDateFilters');
    dateFilters.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            dateFilters.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dashboardFilters.dateRange = btn.dataset.range;
            renderDashboard();
        });
    });

    const equityToggle = document.getElementById('equityModeToggle');
    equityToggle.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            equityToggle.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dashboardFilters.equityMode = btn.dataset.mode;
            renderEquityChart();
        });
    });
}

// Trade Log Controls (Search, Side Filter, Sorting, Pagination)
function setupTradeLogControls() {
    const searchInput = document.getElementById('logSearch');
    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTradeLog();
    });

    const sideSelect = document.getElementById('logFilterSide');
    sideSelect.addEventListener('change', () => {
        currentPage = 1;
        renderTradeLog();
    });

    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTradeLog();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredLogTrades.length / pageSize) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            renderTradeLog();
        }
    });

    document.querySelectorAll('#tradeLogTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = col;
                currentSort.direction = 'desc';
            }
            updateSortIcons();
            currentPage = 1;
            renderTradeLog();
        });
    });
}

function updateSortIcons() {
    document.querySelectorAll('#tradeLogTable th[data-sort]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (th.dataset.sort === currentSort.column) {
            icon.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
            icon.style.opacity = '1';
        } else {
            icon.textContent = '';
            icon.style.opacity = '0.4';
        }
    });
}

// Status Updates
function setBannerStatus(msg) {
    const bar = document.getElementById('statusBar');
    if (!msg) {
        bar.className = 'status-banner';
        bar.textContent = '';
        return;
    }
    bar.textContent = msg;
    bar.className = 'status-banner show';
}

function setConnectionStatus(type, text) {
    const badge = document.getElementById('connBadge');
    const label = document.getElementById('connBadgeText');
    badge.className = `connection-badge ${type}`;
    label.textContent = text;
}

async function updateStatus() {
    try {
        const status = await API.getStatus();
        if (status.hasToken || status.staticMode) {
            let info = 'Connected';
            if (status.lastSync) {
                const date = new Date(status.lastSync);
                info = `Updated ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            setConnectionStatus('connected', info);
        } else {
            setConnectionStatus('warning', 'Offline');
        }
    } catch (e) {
        setConnectionStatus('warning', 'Service Offline');
    }
}

async function loadTrades() {
    try {
        allTrades = await API.getTrades();
        updateSymbolDropdown();
        renderAll();
    } catch (e) {
        setBannerStatus(`Error loading trades: ${e.message}`);
    }
}

function updateSymbolDropdown() {
    const symbolSelect = document.getElementById('dashSymbolFilter');
    const currentVal = symbolSelect.value;
    const realized = Utils.getRealizedTrades(allTrades);
    const symbols = [...new Set(realized.map(t => t.symbol).filter(Boolean))].sort();

    symbolSelect.innerHTML = '<option value="ALL">All Instruments</option>';
    symbols.forEach(sym => {
        const opt = document.createElement('option');
        opt.value = sym;
        opt.textContent = sym;
        symbolSelect.appendChild(opt);
    });

    if (symbols.includes(currentVal)) {
        symbolSelect.value = currentVal;
        dashboardFilters.symbol = currentVal;
    } else {
        symbolSelect.value = 'ALL';
        dashboardFilters.symbol = 'ALL';
    }
}

function renderAll() {
    const realizedTrades = Utils.getRealizedTrades(allTrades);
    document.getElementById('tabTradeCountBadge').textContent = realizedTrades.length;

    renderDashboard();
    renderTradeLog();
    renderDailySummary();
}

// ==========================================================================
// Dashboard Rendering
// ==========================================================================

function renderDashboard() {
    filteredDashboardTrades = Utils.filterTrades(allTrades, dashboardFilters);
    const m = Utils.calculateComprehensiveMetrics(filteredDashboardTrades);

    // Summary badge in toolbar
    document.getElementById('dashFilterSummary').textContent =
        `Showing ${m.totalTrades} trades across ${m.tradingDays} sessions`;

    // 1. Net P&L Card
    const netEl = document.getElementById('dashNetPnl');
    netEl.textContent = Utils.formatCurrency(m.netPnl, true);
    netEl.className = `kpi-main-val ${Utils.getPnlClass(m.netPnl)}`;

    const netBadge = document.getElementById('dashNetBadge');
    if (m.totalTrades === 0) {
        netBadge.textContent = '--';
        netBadge.className = 'kpi-tag neutral';
    } else if (m.netPnl >= 0) {
        netBadge.textContent = 'Profitable';
        netBadge.className = 'kpi-tag positive';
    } else {
        netBadge.textContent = 'Drawdown';
        netBadge.className = 'kpi-tag negative';
    }

    document.getElementById('dashGrossProfit').textContent = Utils.formatCurrency(m.grossProfit);
    document.getElementById('dashGrossLoss').textContent = Utils.formatCurrency(-m.grossLoss);
    document.getElementById('dashCommissions').textContent = Utils.formatCurrency(m.commissions + m.fees);

    // 2. Win Rate Gauge Card
    document.getElementById('dashWinRate').textContent = Utils.formatPercent(m.winRate);
    document.getElementById('dashWinLossPill').textContent = `${m.wins}W / ${m.losses}L`;
    document.getElementById('dashWinLossPill').className = `kpi-tag ${m.winRate >= 50 ? 'positive' : m.winRate > 0 ? 'negative' : 'neutral'}`;

    document.getElementById('dashWinners').textContent = m.wins;
    document.getElementById('dashLosers').textContent = m.losses;
    document.getElementById('dashBreakeven').textContent = m.breakeven;

    // Semicircle SVG Gauge Arc (length = 141.37)
    const arc = document.getElementById('gaugeActiveArc');
    const arcTotal = 141.37;
    const clampedRate = Math.min(Math.max(m.winRate, 0), 100);
    const offset = arcTotal * (1 - clampedRate / 100);
    arc.style.strokeDashoffset = offset;

    // 3. Profit Factor & Volume Bar
    const pfEl = document.getElementById('dashProfitFactor');
    pfEl.textContent = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);
    pfEl.className = `kpi-main-val ${m.profitFactor >= 1.5 ? 'positive' : m.profitFactor >= 1.0 ? '' : 'negative'}`;

    const pfBadge = document.getElementById('dashPfBadge');
    if (m.totalTrades === 0) {
        pfBadge.textContent = 'Edge: --';
        pfBadge.className = 'kpi-tag neutral';
    } else if (m.profitFactor >= 2.0) {
        pfBadge.textContent = 'High Edge';
        pfBadge.className = 'kpi-tag positive';
    } else if (m.profitFactor >= 1.0) {
        pfBadge.textContent = 'Positive Edge';
        pfBadge.className = 'kpi-tag positive';
    } else {
        pfBadge.textContent = 'Negative Edge';
        pfBadge.className = 'kpi-tag negative';
    }

    const totalVol = m.grossProfit + m.grossLoss;
    const winVolPct = totalVol > 0 ? (m.grossProfit / totalVol) * 100 : 50;
    const lossVolPct = 100 - winVolPct;
    document.getElementById('ratioWinBar').style.width = `${winVolPct}%`;
    document.getElementById('ratioLossBar').style.width = `${lossVolPct}%`;
    document.getElementById('dashProfitVol').textContent = Utils.formatCurrency(m.grossProfit);
    document.getElementById('dashLossVol').textContent = Utils.formatCurrency(-m.grossLoss);

    const expEl = document.getElementById('dashExpectancy');
    expEl.textContent = Utils.formatCurrency(m.expectancy, true);
    expEl.className = `footer-val ${Utils.getPnlClass(m.expectancy)}`;

    // 4. Payoff Card
    document.getElementById('dashAvgWin').textContent = Utils.formatCurrency(m.avgWin);
    document.getElementById('dashAvgLoss').textContent = Utils.formatCurrency(-m.avgLoss);
    document.getElementById('dashWLRatio').textContent = `${m.wlRatio.toFixed(2)}x Payoff`;
    document.getElementById('dashLargestWin').textContent = Utils.formatCurrency(m.largestWin);
    document.getElementById('dashLargestLoss').textContent = Utils.formatCurrency(m.largestLoss);

    // 5. Risk & Consistency Card
    document.getElementById('dashMaxDD').textContent = Utils.formatCurrency(-m.maxDrawdown);
    document.getElementById('dashRecovery').textContent = m.recoveryFactor === Infinity ? '∞' : m.recoveryFactor.toFixed(2);
    document.getElementById('dashWinStreak').textContent = m.maxWinStreak;
    document.getElementById('dashLossStreak').textContent = m.maxLossStreak;
    document.getElementById('dashSharpe').textContent = m.sharpe.toFixed(2);

    const streakBadge = document.getElementById('dashStreakBadge');
    if (m.currStreak > 0) {
        streakBadge.textContent = `🔥 +${m.currStreak} Streak`;
        streakBadge.className = 'kpi-tag positive';
    } else if (m.currStreak < 0) {
        streakBadge.textContent = `❄️ -${Math.abs(m.currStreak)} Streak`;
        streakBadge.className = 'kpi-tag negative';
    } else {
        streakBadge.textContent = 'Streak: 0';
        streakBadge.className = 'kpi-tag neutral';
    }

    // Secondary Cards & Side Breakdown
    renderSideBreakdown();
    renderMatrix(m);

    // Render Charts
    renderEquityChart();
    renderDailyPnlChart(m);
    renderDayOfWeekChart();
    renderWinLossDonut(m);
    renderSymbolChart();
}

// Side Breakdown (Long vs Short exits)
function renderSideBreakdown() {
    const side = Utils.calculateSideStats(filteredDashboardTrades);

    // BUY
    const buyPnl = document.getElementById('sideBuyPnl');
    buyPnl.textContent = Utils.formatCurrency(side.BUY.pnl, true);
    buyPnl.className = `side-pnl ${Utils.getPnlClass(side.BUY.pnl)}`;
    document.getElementById('sideBuyCount').textContent = side.BUY.trades;
    document.getElementById('sideBuyWinRate').textContent = Utils.formatPercent(side.BUY.winRate);
    document.getElementById('sideBuyWL').textContent = `${side.BUY.wins}W / ${side.BUY.losses}L`;

    // SELL
    const sellPnl = document.getElementById('sideSellPnl');
    sellPnl.textContent = Utils.formatCurrency(side.SELL.pnl, true);
    sellPnl.className = `side-pnl ${Utils.getPnlClass(side.SELL.pnl)}`;
    document.getElementById('sideSellCount').textContent = side.SELL.trades;
    document.getElementById('sideSellWinRate').textContent = Utils.formatPercent(side.SELL.winRate);
    document.getElementById('sideSellWL').textContent = `${side.SELL.wins}W / ${side.SELL.losses}L`;
}

// Detailed Performance Matrix Grid
function renderMatrix(m) {
    document.getElementById('matTotalTrades').textContent = m.totalTrades;
    document.getElementById('matTotalContracts').textContent = m.totalContracts;
    document.getElementById('matNetPnl').textContent = Utils.formatCurrency(m.netPnl, true);
    document.getElementById('matNetPnl').className = `m-val ${Utils.getPnlClass(m.netPnl)}`;
    document.getElementById('matGrossProfit').textContent = Utils.formatCurrency(m.grossProfit);
    document.getElementById('matGrossLoss').textContent = Utils.formatCurrency(-m.grossLoss);
    document.getElementById('matCommissions').textContent = Utils.formatCurrency(m.commissions);
    document.getElementById('matFees').textContent = Utils.formatCurrency(m.fees);

    document.getElementById('matWinRate').textContent = Utils.formatPercent(m.winRate);
    document.getElementById('matProfitFactor').textContent = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);
    document.getElementById('matExpectancy').textContent = Utils.formatCurrency(m.expectancy, true);
    document.getElementById('matExpectancy').className = `m-val ${Utils.getPnlClass(m.expectancy)}`;
    document.getElementById('matSharpe').textContent = m.sharpe.toFixed(2);
    document.getElementById('matMaxDD').textContent = Utils.formatCurrency(-m.maxDrawdown);
    document.getElementById('matRecovery').textContent = m.recoveryFactor === Infinity ? '∞' : m.recoveryFactor.toFixed(2);

    document.getElementById('matWinners').textContent = m.wins;
    document.getElementById('matLosers').textContent = m.losses;
    document.getElementById('matBreakeven').textContent = m.breakeven;
    document.getElementById('matAvgWin').textContent = Utils.formatCurrency(m.avgWin);
    document.getElementById('matAvgLoss').textContent = Utils.formatCurrency(-m.avgLoss);
    document.getElementById('matWLRatio').textContent = `${m.wlRatio.toFixed(2)}x`;
    document.getElementById('matLargestWin').textContent = Utils.formatCurrency(m.largestWin);
    document.getElementById('matLargestLoss').textContent = Utils.formatCurrency(m.largestLoss);

    document.getElementById('matTradingDays').textContent = m.tradingDays;
    document.getElementById('matProfDays').textContent = m.profitableDays;
    document.getElementById('matProfDaysPct').textContent = Utils.formatPercent(m.profitableDaysPct);
    document.getElementById('matBestDay').textContent = Utils.formatCurrency(m.bestDay);
    document.getElementById('matWorstDay').textContent = Utils.formatCurrency(m.worstDay);
    document.getElementById('matAvgDaily').textContent = Utils.formatCurrency(m.avgDailyPnl, true);
    document.getElementById('matAvgDaily').className = `m-val ${Utils.getPnlClass(m.avgDailyPnl)}`;
    document.getElementById('matWinStreak').textContent = m.maxWinStreak;
    document.getElementById('matLossStreak').textContent = m.maxLossStreak;
}

// ==========================================================================
// Chart.js Visualizations
// ==========================================================================

// 1. Equity Curve Chart
function renderEquityChart() {
    const curve = Utils.calculateEquityCurve(filteredDashboardTrades, dashboardFilters.equityMode);
    const lastVal = curve.cumulative.length > 0 ? curve.cumulative[curve.cumulative.length - 1] : 0;

    const badge = document.getElementById('equityFinalBadge');
    badge.textContent = Utils.formatCurrency(lastVal, true);
    badge.className = `badge-pill ${Utils.getPnlClass(lastVal)}`;

    const canvas = document.getElementById('chartEquity');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    const isNetPositive = lastVal >= 0;
    if (isNetPositive) {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
    } else {
        gradient.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
        gradient.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
    }

    const lineColor = isNetPositive ? '#10b981' : '#f43f5e';

    renderChart('chartEquity', {
        type: 'line',
        data: {
            labels: curve.labels,
            datasets: [{
                label: 'Cumulative Net P&L',
                data: curve.cumulative,
                borderColor: lineColor,
                backgroundColor: gradient,
                fill: true,
                tension: 0.25,
                borderWidth: 2.5,
                pointRadius: curve.cumulative.length > 50 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: lineColor,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            if (!items.length) return '';
                            const idx = items[0].dataIndex;
                            const pt = curve.points[idx];
                            if (!pt) return '';
                            return pt.date === 'Start' ? 'Start' : `${pt.date} ${pt.time || ''}`;
                        },
                        label: (item) => {
                            const idx = item.dataIndex;
                            const pt = curve.points[idx];
                            if (!pt) return '';
                            const pnlStr = Utils.formatCurrency(pt.net, true);
                            const cumStr = Utils.formatCurrency(item.raw, true);
                            return [
                                `Trade Net: ${pnlStr}`,
                                `Equity: ${cumStr}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    grid: {
                        color: (context) => {
                            if (context.tick.value === 0) {
                                return 'rgba(255, 255, 255, 0.25)';
                            }
                            return 'rgba(255, 255, 255, 0.04)';
                        },
                        drawBorder: false
                    },
                    ticks: {
                        callback: (val) => Utils.formatCurrency(val)
                    }
                }
            }
        }
    });
}

// 2. Daily Performance Bar Chart
function renderDailyPnlChart(m) {
    const daily = Utils.calculateDailyPnl(filteredDashboardTrades);

    const badge = document.getElementById('dashDailyWinRateBadge');
    badge.textContent = `${m.profitableDays} / ${m.tradingDays} Sessions (${m.profitableDaysPct.toFixed(0)}%)`;
    badge.className = `badge-pill ${m.profitableDaysPct >= 50 ? 'positive' : 'negative'}`;

    renderChart('chartDailyPnl', {
        type: 'bar',
        data: {
            labels: daily.labels,
            datasets: [{
                label: 'Session Net P&L',
                data: daily.data,
                backgroundColor: daily.colors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            const idx = item.dataIndex;
                            const d = daily.details[idx];
                            return [
                                `Net P&L: ${Utils.formatCurrency(item.raw, true)}`,
                                `Trades: ${d.trades} (${d.wins}W / ${d.losses}L)`,
                                `Commissions: ${Utils.formatCurrency(d.commissions + d.fees)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    grid: {
                        color: (context) => {
                            if (context.tick.value === 0) {
                                return 'rgba(255, 255, 255, 0.25)';
                            }
                            return 'rgba(255, 255, 255, 0.04)';
                        }
                    },
                    ticks: {
                        callback: (val) => Utils.formatCurrency(val)
                    }
                }
            }
        }
    });
}

// 3. Performance by Weekday
function renderDayOfWeekChart() {
    const dow = Utils.calculateDayOfWeekStats(filteredDashboardTrades);
    const labels = dow.map(d => d.short);
    const data = dow.map(d => d.pnl);
    const colors = dow.map(d => d.pnl >= 0 ? '#10b981' : '#f43f5e');

    renderChart('chartDayOfWeek', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Weekday Net P&L',
                data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            const d = dow[item.dataIndex];
                            return [
                                `Net P&L: ${Utils.formatCurrency(item.raw, true)}`,
                                `Win Rate: ${Utils.formatPercent(d.winRate)}`,
                                `Trades: ${d.trades} (${d.wins}W / ${d.losses}L)`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { callback: (val) => Utils.formatCurrency(val) }
                }
            }
        }
    });
}

// 4. Win / Loss Doughnut
function renderWinLossDonut(m) {
    const total = m.wins + m.losses + m.breakeven;
    const data = total > 0 ? [m.wins, m.losses, m.breakeven] : [0, 0, 0];

    renderChart('chartWinLoss', {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Losses', 'Breakeven'],
            datasets: [{
                data,
                backgroundColor: ['#10b981', '#f43f5e', '#64748b'],
                borderColor: '#121927',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        padding: 12,
                        color: '#94a3b8'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            const val = item.raw;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${item.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 5. Performance by Symbol
function renderSymbolChart() {
    const syms = Utils.calculateSymbolStats(filteredDashboardTrades);
    const labels = syms.map(s => s.symbol);
    const data = syms.map(s => s.pnl);
    const colors = syms.map(s => s.pnl >= 0 ? '#06b6d4' : '#f43f5e');

    renderChart('chartSymbolPnl', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Symbol Net P&L',
                data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            const s = syms[item.dataIndex];
                            return [
                                `Net P&L: ${Utils.formatCurrency(item.raw, true)}`,
                                `Trades: ${s.trades}`,
                                `Win Rate: ${Utils.formatPercent(s.winRate)}`,
                                `Volume: ${s.volume} contracts`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { callback: (val) => Utils.formatCurrency(val) }
                }
            }
        }
    });
}

// ==========================================================================
// Trade Log Tab
// ==========================================================================

function renderTradeLog() {
    const tbody = document.querySelector('#tradeLogTable tbody');
    tbody.innerHTML = '';

    const search = (document.getElementById('logSearch').value || '').toLowerCase();
    const sideFilter = document.getElementById('logFilterSide').value;

    const realizedTrades = Utils.getRealizedTrades(allTrades);

    let filtered = realizedTrades.filter(t => {
        const matchSearch = !search ||
            (t.symbol || '').toLowerCase().includes(search) ||
            (t.id || '').toString().toLowerCase().includes(search);
        const matchSide = sideFilter === 'ALL' || t.side === sideFilter;
        return matchSearch && matchSide;
    });

    // Sorting
    filtered.sort((a, b) => {
        let av = a[currentSort.column];
        let bv = b[currentSort.column];

        if (currentSort.column === 'qty' || currentSort.column === 'price' ||
            currentSort.column === 'commission' || currentSort.column === 'fees' ||
            currentSort.column === 'realizedPnL' || currentSort.column === 'net') {
            av = parseFloat(av) || 0;
            bv = parseFloat(bv) || 0;
        } else {
            av = (av || '').toString();
            bv = (bv || '').toString();
        }

        if (av < bv) return currentSort.direction === 'asc' ? -1 : 1;
        if (av > bv) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    filteredLogTrades = filtered;
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    document.getElementById('pageInfo').textContent =
        `Page ${currentPage} of ${totalPages} (${filtered.length} trades)`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;

    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    if (paged.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="10" style="text-align: center; padding: 24px; color: var(--text-muted);">No matching trades found.</td>`;
        tbody.appendChild(tr);
        return;
    }

    for (const t of paged) {
        const tr = document.createElement('tr');
        const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
        const sideClass = (t.side || '').toUpperCase() === 'BUY' ? 'buy' : 'sell';

        tr.innerHTML = `
            <td>${Utils.formatDisplayDate(t.tradeDate)}</td>
            <td class="mono">${Utils.formatDisplayTime(t.datetime)}</td>
            <td><strong>${t.symbol || ''}</strong></td>
            <td><span class="badge-side ${sideClass}">${t.side || ''}</span></td>
            <td class="text-right mono">${t.qty || 0}</td>
            <td class="text-right mono">${Utils.formatNumber(t.price, 2)}</td>
            <td class="text-right mono">${Utils.formatCurrency(t.commission || 0)}</td>
            <td class="text-right mono">${Utils.formatCurrency(t.fees || 0)}</td>
            <td class="text-right mono ${Utils.getPnlClass(t.realizedPnL)}">${Utils.formatCurrency(t.realizedPnL || 0, true)}</td>
            <td class="text-right mono ${Utils.getPnlClass(net)}"><strong>${Utils.formatCurrency(net, true)}</strong></td>
        `;
        tbody.appendChild(tr);
    }
}

// ==========================================================================
// Daily Summary Tab
// ==========================================================================

function renderDailySummary() {
    const tbody = document.querySelector('#dailyTable tbody');
    tbody.innerHTML = '';

    const realizedTrades = Utils.getRealizedTrades(allTrades);
    const daily = Utils.groupByDay(realizedTrades);

    if (daily.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No daily sessions recorded yet.</td>`;
        tbody.appendChild(tr);
        return;
    }

    for (const d of daily) {
        const tr = document.createElement('tr');
        const wl = `<span class="badge-wl">${d.wins}W / ${d.losses}L</span>`;
        tr.innerHTML = `
            <td><strong>${Utils.formatDisplayDate(d.date)}</strong> (${Utils.getDayOfWeek(d.date)})</td>
            <td class="text-right mono">${d.trades}</td>
            <td class="text-right mono">${Utils.formatCurrency(d.commissions)}</td>
            <td class="text-right mono">${Utils.formatCurrency(d.fees)}</td>
            <td class="text-right mono ${Utils.getPnlClass(d.net)}"><strong>${Utils.formatCurrency(d.net, true)}</strong></td>
            <td class="text-center">${wl}</td>
        `;
        tbody.appendChild(tr);
    }
}

document.addEventListener('DOMContentLoaded', init);
