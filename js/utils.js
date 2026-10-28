const Utils = {
    parseDate(dStr) {
        if (!dStr) return new Date();
        const str = dStr.toString().trim();
        const cleaned = str.replace(/-/g, '').split(';')[0];
        if (cleaned.length >= 8) {
            const y = parseInt(cleaned.substring(0, 4), 10);
            const m = parseInt(cleaned.substring(4, 6), 10) - 1;
            const d = parseInt(cleaned.substring(6, 8), 10);
            return new Date(y, m, d);
        }
        const parsed = new Date(str);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    },

    formatCurrency(val, includeSign = false) {
        const num = parseFloat(val) || 0;
        const formatted = Math.abs(num).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        if (num < 0) return `-${formatted}`;
        if (num > 0 && includeSign) return `+${formatted}`;
        return formatted;
    },

    formatNumber(val, decimals = 0) {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatPercent(val, decimals = 1) {
        const num = parseFloat(val) || 0;
        return `${num.toFixed(decimals)}%`;
    },

    getPnlClass(val) {
        const num = parseFloat(val) || 0;
        if (num > 0.0001) return 'positive';
        if (num < -0.0001) return 'negative';
        return 'neutral';
    },

    formatDisplayDate(dateStr) {
        if (!dateStr) return '';
        const cleaned = dateStr.toString().replace(/-/g, '').split(';')[0];
        if (cleaned.length >= 8) {
            const year = parseInt(cleaned.substring(0, 4), 10);
            const month = parseInt(cleaned.substring(4, 6), 10) - 1;
            const day = parseInt(cleaned.substring(6, 8), 10);
            const d = new Date(year, month, day);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        } catch (e) {}
        return dateStr;
    },

    formatDisplayTime(datetimeStr) {
        if (!datetimeStr) return '';
        if (datetimeStr.includes(';')) {
            const timePart = datetimeStr.split(';')[1];
            if (timePart && timePart.length >= 4) {
                const hh = timePart.substring(0, 2);
                const mm = timePart.substring(2, 4);
                return `${hh}:${mm}`;
            }
        }
        try {
            const d = new Date(datetimeStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        } catch (e) {}
        return datetimeStr;
    },

    getDayOfWeek(dateStr) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const d = this.parseDate(dateStr);
        return days[d.getDay()];
    },

    getRealizedTrades(trades) {
        if (!Array.isArray(trades)) return [];
        return trades.filter(t => parseFloat(t.realizedPnL || 0) !== 0);
    },

    sortChronological(trades) {
        return [...trades].sort((a, b) => {
            const da = (a.datetime || a.tradeDate || '').toString();
            const db = (b.datetime || b.tradeDate || '').toString();
            return da.localeCompare(db);
        });
    },

    calculateComprehensiveMetrics(trades) {
        const realized = this.getRealizedTrades(trades);
        if (realized.length === 0) {
            return {
                totalTrades: 0,
                totalContracts: 0,
                netPnl: 0,
                grossProfit: 0,
                grossLoss: 0,
                commissions: 0,
                fees: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                winRate: 0,
                lossRate: 0,
                profitFactor: 0,
                expectancy: 0,
                avgWin: 0,
                avgLoss: 0,
                wlRatio: 0,
                largestWin: 0,
                largestLoss: 0,
                maxWinStreak: 0,
                maxLossStreak: 0,
                currStreak: 0,
                sharpe: 0,
                maxDrawdown: 0,
                recoveryFactor: 0,
                tradingDays: 0,
                profitableDays: 0,
                profitableDaysPct: 0,
                bestDay: 0,
                worstDay: 0,
                avgDailyPnl: 0
            };
        }

        const sorted = this.sortChronological(realized);

        let totalNet = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let totalCommissions = 0;
        let totalFees = 0;
        let totalContracts = 0;

        const wins = [];
        const losses = [];
        let breakevenCount = 0;

        // Streaks
        let currWin = 0;
        let currLoss = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;

        // Drawdown
        let peak = 0;
        let maxDrawdown = 0;
        let cumPnl = 0;

        for (const t of sorted) {
            const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
            const comm = parseFloat(t.commission || 0);
            const fee = parseFloat(t.fees || 0);
            const qty = parseFloat(t.qty || 0);

            totalNet += net;
            totalCommissions += comm;
            totalFees += fee;
            totalContracts += qty;

            if (net > 0.0001) {
                wins.push(net);
                grossProfit += net;
                currWin++;
                currLoss = 0;
                if (currWin > maxWinStreak) maxWinStreak = currWin;
            } else if (net < -0.0001) {
                losses.push(net);
                grossLoss += Math.abs(net);
                currLoss++;
                currWin = 0;
                if (currLoss > maxLossStreak) maxLossStreak = currLoss;
            } else {
                breakevenCount++;
                currWin = 0;
                currLoss = 0;
            }

            cumPnl += net;
            if (cumPnl > peak) peak = cumPnl;
            const dd = peak - cumPnl;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        const currStreak = currWin > 0 ? currWin : (currLoss > 0 ? -currLoss : 0);
        const winCount = wins.length;
        const lossCount = losses.length;
        const totalTrades = sorted.length;

        const winRate = (winCount / totalTrades) * 100;
        const lossRate = (lossCount / totalTrades) * 100;
        const beRate = (breakevenCount / totalTrades) * 100;

        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
        const expectancy = totalNet / totalTrades;
        const avgWin = winCount > 0 ? grossProfit / winCount : 0;
        const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
        const wlRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);

        const largestWin = winCount > 0 ? Math.max(...wins) : 0;
        const largestLoss = lossCount > 0 ? Math.min(...losses) : 0;

        // Sharpe Ratio (annualized approximation)
        let sharpe = 0;
        if (totalTrades > 1) {
            const variance = sorted.reduce((sum, t) => {
                const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
                return sum + Math.pow(net - expectancy, 2);
            }, 0) / totalTrades;
            const stdDev = Math.sqrt(variance);
            if (stdDev > 0) {
                sharpe = (expectancy / stdDev) * Math.sqrt(252);
            }
        }

        const recoveryFactor = maxDrawdown > 0 ? totalNet / maxDrawdown : (totalNet > 0 ? Infinity : 0);

        // Daily aggregation
        const dailySummary = this.groupByDay(sorted);
        const tradingDays = dailySummary.length;
        let profitableDays = 0;
        let bestDay = tradingDays > 0 ? -Infinity : 0;
        let worstDay = tradingDays > 0 ? Infinity : 0;

        for (const d of dailySummary) {
            if (d.net > 0) profitableDays++;
            if (d.net > bestDay) bestDay = d.net;
            if (d.net < worstDay) worstDay = d.net;
        }

        const profitableDaysPct = tradingDays > 0 ? (profitableDays / tradingDays) * 100 : 0;
        const avgDailyPnl = tradingDays > 0 ? totalNet / tradingDays : 0;

        return {
            totalTrades,
            totalContracts,
            netPnl: totalNet,
            grossProfit,
            grossLoss,
            commissions: totalCommissions,
            fees: totalFees,
            wins: winCount,
            losses: lossCount,
            breakeven: breakevenCount,
            winRate,
            lossRate,
            beRate,
            profitFactor,
            expectancy,
            avgWin,
            avgLoss,
            wlRatio,
            largestWin,
            largestLoss,
            maxWinStreak,
            maxLossStreak,
            currStreak,
            sharpe,
            maxDrawdown,
            recoveryFactor,
            tradingDays,
            profitableDays,
            profitableDaysPct,
            bestDay: bestDay === -Infinity ? 0 : bestDay,
            worstDay: worstDay === Infinity ? 0 : worstDay,
            avgDailyPnl
        };
    },

    calculateEquityCurve(trades, mode = 'trade') {
        const realized = this.getRealizedTrades(trades);
        if (realized.length === 0) return { labels: [], points: [], cumulative: [] };

        const sorted = this.sortChronological(realized);

        if (mode === 'day') {
            const daily = this.groupByDayChronological(sorted);
            let cum = 0;
            const labels = [];
            const points = [];
            const cumulative = [];

            // Add starting zero point
            labels.push('Start');
            cumulative.push(0);
            points.push({ date: 'Start', net: 0, cum: 0 });

            for (const d of daily) {
                cum += d.net;
                labels.push(this.formatDisplayDate(d.date));
                cumulative.push(parseFloat(cum.toFixed(2)));
                points.push({
                    date: d.date,
                    label: this.formatDisplayDate(d.date),
                    net: d.net,
                    cum: parseFloat(cum.toFixed(2)),
                    trades: d.trades,
                    wins: d.wins,
                    losses: d.losses
                });
            }

            return { labels, points, cumulative };
        }

        // Default: by trade
        let cum = 0;
        const labels = ['#0'];
        const points = [{ index: 0, date: 'Start', net: 0, cum: 0 }];
        const cumulative = [0];

        sorted.forEach((t, idx) => {
            const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
            cum += net;
            const formattedDate = this.formatDisplayDate(t.tradeDate);
            const formattedTime = this.formatDisplayTime(t.datetime);
            labels.push(`#${idx + 1}`);
            cumulative.push(parseFloat(cum.toFixed(2)));
            points.push({
                index: idx + 1,
                date: formattedDate,
                time: formattedTime,
                symbol: t.symbol,
                side: t.side,
                net,
                cum: parseFloat(cum.toFixed(2))
            });
        });

        return { labels, points, cumulative };
    },

    calculateDailyPnl(trades) {
        const realized = this.getRealizedTrades(trades);
        const daily = this.groupByDayChronological(realized);
        const labels = [];
        const data = [];
        const colors = [];
        const details = [];

        for (const d of daily) {
            labels.push(this.formatDisplayDate(d.date));
            data.push(parseFloat(d.net.toFixed(2)));
            colors.push(d.net >= 0 ? '#10b981' : '#f43f5e');
            details.push(d);
        }

        return { labels, data, colors, details };
    },

    calculateDayOfWeekStats(trades) {
        const realized = this.getRealizedTrades(trades);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const map = {
            Monday: { day: 'Monday', short: 'Mon', pnl: 0, trades: 0, wins: 0, losses: 0 },
            Tuesday: { day: 'Tuesday', short: 'Tue', pnl: 0, trades: 0, wins: 0, losses: 0 },
            Wednesday: { day: 'Wednesday', short: 'Wed', pnl: 0, trades: 0, wins: 0, losses: 0 },
            Thursday: { day: 'Thursday', short: 'Thu', pnl: 0, trades: 0, wins: 0, losses: 0 },
            Friday: { day: 'Friday', short: 'Fri', pnl: 0, trades: 0, wins: 0, losses: 0 }
        };

        for (const t of realized) {
            const dayName = this.getDayOfWeek(t.tradeDate || t.datetime);
            if (map[dayName]) {
                const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
                map[dayName].pnl += net;
                map[dayName].trades++;
                if (net > 0) map[dayName].wins++;
                else if (net < 0) map[dayName].losses++;
            }
        }

        return days.map(d => {
            const item = map[d];
            const winRate = item.trades > 0 ? (item.wins / item.trades) * 100 : 0;
            return {
                ...item,
                pnl: parseFloat(item.pnl.toFixed(2)),
                winRate
            };
        });
    },

    calculateSymbolStats(trades) {
        const realized = this.getRealizedTrades(trades);
        const map = {};

        for (const t of realized) {
            const sym = t.symbol || 'Unknown';
            if (!map[sym]) {
                map[sym] = { symbol: sym, pnl: 0, trades: 0, wins: 0, losses: 0, volume: 0 };
            }
            const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
            map[sym].pnl += net;
            map[sym].trades++;
            map[sym].volume += parseFloat(t.qty || 0);
            if (net > 0) map[sym].wins++;
            else if (net < 0) map[sym].losses++;
        }

        return Object.values(map)
            .map(s => ({
                ...s,
                pnl: parseFloat(s.pnl.toFixed(2)),
                winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0
            }))
            .sort((a, b) => b.pnl - a.pnl);
    },

    calculateSideStats(trades) {
        const realized = this.getRealizedTrades(trades);
        const result = {
            BUY: { side: 'BUY', pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 },
            SELL: { side: 'SELL', pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 }
        };

        for (const t of realized) {
            const side = (t.side || '').toUpperCase().startsWith('B') ? 'BUY' : 'SELL';
            const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
            result[side].pnl += net;
            result[side].trades++;
            if (net > 0) result[side].wins++;
            else if (net < 0) result[side].losses++;
        }

        ['BUY', 'SELL'].forEach(s => {
            result[s].pnl = parseFloat(result[s].pnl.toFixed(2));
            result[s].winRate = result[s].trades > 0 ? (result[s].wins / result[s].trades) * 100 : 0;
        });

        return result;
    },

    groupByDay(trades) {
        const map = {};
        for (const t of trades) {
            const date = t.tradeDate || (t.datetime || '').split(';')[0] || (t.datetime || '').split(' ')[0] || 'Unknown';
            if (!map[date]) {
                map[date] = {
                    date,
                    trades: 0,
                    gross: 0,
                    commissions: 0,
                    fees: 0,
                    net: 0,
                    wins: 0,
                    losses: 0
                };
            }
            const net = parseFloat(t.net !== undefined ? t.net : t.realizedPnL || 0);
            map[date].trades++;
            map[date].gross += parseFloat(t.gross || 0);
            map[date].commissions += parseFloat(t.commission || 0);
            map[date].fees += parseFloat(t.fees || 0);
            map[date].net += net;
            if (net > 0.0001) map[date].wins++;
            else if (net < -0.0001) map[date].losses++;
        }
        return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
    },

    groupByDayChronological(trades) {
        return this.groupByDay(trades).sort((a, b) => a.date.localeCompare(b.date));
    },

    filterTrades(trades, { symbol = 'ALL', dateRange = 'ALL' } = {}) {
        let list = trades || [];
        if (symbol && symbol !== 'ALL') {
            list = list.filter(t => t.symbol === symbol);
        }

        if (dateRange && dateRange !== 'ALL') {
            const realized = this.getRealizedTrades(list);
            if (realized.length > 0) {
                const dates = realized.map(t => this.parseDate(t.tradeDate || t.datetime)).sort((a, b) => b - a);
                const maxDate = dates[0];
                let cutoffDate = new Date(maxDate);

                if (dateRange === '7D') cutoffDate.setDate(cutoffDate.getDate() - 7);
                else if (dateRange === '30D') cutoffDate.setDate(cutoffDate.getDate() - 30);
                else if (dateRange === '90D') cutoffDate.setDate(cutoffDate.getDate() - 90);

                list = list.filter(t => {
                    const d = this.parseDate(t.tradeDate || t.datetime);
                    return d >= cutoffDate;
                });
            }
        }

        return list;
    }
};

// CommonJS support for node testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
