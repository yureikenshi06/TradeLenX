export function generateMockTrades(count = 150) {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT']
  const trades = []
  let equity = 10000
  let time = Date.now() - count * 1.5 * 24 * 3600 * 1000
  for (let i = 0; i < count; i++) {
    const sym = symbols[Math.floor(Math.random() * symbols.length)]
    const side = Math.random() > 0.48 ? 'BUY' : 'SELL'
    const qty = +(Math.random() * 0.5 + 0.01).toFixed(4)
    const price = sym.startsWith('BTC') ? 42000 + Math.random() * 20000
      : sym.startsWith('ETH') ? 2200 + Math.random() * 1000
      : sym.startsWith('BNB') ? 300 + Math.random() * 150
      : sym.startsWith('SOL') ? 90 + Math.random() * 100
      : 5 + Math.random() * 60
    const fee = price * qty * 0.0004
    const pnl = (Math.random() - 0.44) * price * qty * 0.06
    equity += pnl - fee
    time += Math.random() * 1.5 * 24 * 3600 * 1000
    const lev = [2, 3, 5, 10, 20, 25][Math.floor(Math.random() * 6)]
    trades.push({
      id: `F${1000 + i}`,
      symbol: sym,
      side,
      qty,
      price: +price.toFixed(2),
      fee: +fee.toFixed(4),
      pnl: +pnl.toFixed(4),
      equity: +equity.toFixed(2),
      time,
      leverage: lev,
      entryPrice: +price.toFixed(2),
      exitPrice: +(price * (1 + (Math.random() - 0.5) * 0.04)).toFixed(2),
      riskPercent: +(Math.random() * 4).toFixed(2),
      source: 'futures',
    })
  }
  return trades
}

export function localDateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthKeyFromTs(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function loadCashFlow() {
  try { return JSON.parse(localStorage.getItem('tl_cashflow') || '[]') } catch { return [] }
}

export function saveCashFlow(cf) {
  try { localStorage.setItem('tl_cashflow', JSON.stringify(cf)) } catch {}
}

export function normalizeCashFlow(entries = []) {
  return [...entries]
    .map((entry) => {
      const type = String(entry.type || '').toLowerCase()
      return {
        ...entry,
        type: type === 'withdrawal' ? 'withdraw' : type,
        amount: Math.abs(+entry.amount || 0),
        time: entry.time || new Date(`${entry.date}T12:00:00`).getTime(),
      }
    })
    .filter((entry) => entry.amount > 0 && (entry.type === 'deposit' || entry.type === 'withdraw'))
    .sort((a, b) => a.time - b.time)
}

export function monthProfitMapFromTrades(trades = []) {
  return trades.reduce((map, trade) => {
    const key = monthKeyFromTs(trade.time)
    if (!map[key]) {
      map[key] = {
        key,
        label: monthLabelFromKey(key),
        grossProfit: 0,
        fees: 0,
        netProfit: 0,
        trades: 0,
      }
    }
    map[key].grossProfit += trade.pnl || 0
    map[key].fees += trade.fee || 0
    map[key].netProfit += (trade.pnl || 0) - (trade.fee || 0)
    map[key].trades += 1
    return map
  }, {})
}

export function buildCapitalByMonth(entries = [], monthKeys = [], trades = []) {
  const flow = normalizeCashFlow(entries)
  const monthlyProfit = monthProfitMapFromTrades(trades)
  const allKeys = [...new Set([
    ...flow.map((entry) => monthKeyFromTs(entry.time)),
    ...monthKeys,
    ...Object.keys(monthlyProfit),
  ])].sort()

  let runningCapital = 0
  const map = {}

  allKeys.forEach((key) => {
    const monthEntries = flow.filter((entry) => monthKeyFromTs(entry.time) === key)
    const startCapital = runningCapital
    const deposits = monthEntries.filter((entry) => entry.type === 'deposit').reduce((sum, entry) => sum + entry.amount, 0)
    const withdrawals = monthEntries.filter((entry) => entry.type === 'withdraw').reduce((sum, entry) => sum + entry.amount, 0)
    const grossProfit = monthlyProfit[key]?.grossProfit || 0
    const fees = monthlyProfit[key]?.fees || 0
    const netProfit = monthlyProfit[key]?.netProfit || 0
    const netFlow = deposits - withdrawals
    const endCapital = startCapital + deposits + netProfit - withdrawals
    const averageCapital = Math.max(0, startCapital + (deposits + netProfit - withdrawals) / 2)

    map[key] = {
      key,
      label: monthLabelFromKey(key),
      startCapital: +startCapital.toFixed(2),
      deposits: +deposits.toFixed(2),
      withdrawals: +withdrawals.toFixed(2),
      grossProfit: +grossProfit.toFixed(2),
      fees: +fees.toFixed(2),
      netProfit: +netProfit.toFixed(2),
      netFlow: +netFlow.toFixed(2),
      endCapital: +endCapital.toFixed(2),
      averageCapital: +averageCapital.toFixed(2),
      trades: monthlyProfit[key]?.trades || 0,
    }

    runningCapital = endCapital
  })

  return map
}

export function buildRollingCashFlowInsights(entries = [], type = 'deposit') {
  const flow = normalizeCashFlow(entries).filter((entry) => entry.type === type)
  const now = Date.now()
  const windows = {
    week: 7,
    month: 30,
    quarter: 90,
    year: 365,
  }

  const totals = Object.fromEntries(
    Object.entries(windows).map(([label, days]) => {
      const cutoff = now - days * 24 * 60 * 60 * 1000
      const total = flow.filter((entry) => entry.time >= cutoff).reduce((sum, entry) => sum + entry.amount, 0)
      return [label, +total.toFixed(2)]
    })
  )

  const allTime = flow.reduce((sum, entry) => sum + entry.amount, 0)
  const highest = flow.reduce((max, entry) => Math.max(max, entry.amount), 0)
  const average = flow.length ? flow.reduce((sum, entry) => sum + entry.amount, 0) / flow.length : 0
  const latest = flow[flow.length - 1] || null

  return {
    count: flow.length,
    highest: +highest.toFixed(2),
    average: +average.toFixed(2),
    allTime: +allTime.toFixed(2),
    latest,
    ...totals,
  }
}

function getTradeRiskValue(trade) {
  if (trade.riskPercent != null && trade.riskPercent > 0) return +trade.riskPercent
  const notional = Math.abs((trade.qty || 0) * (trade.price || trade.entryPrice || 0))
  const leverage = Math.max(1, trade.leverage || 1)
  const equity = Math.max(1, trade.equity || 0)
  const estimatedMarginUse = (notional / leverage) / equity * 100
  return +Math.max(0, estimatedMarginUse).toFixed(2)
}

export function computeStats(trades, dateRange) {
  if (!trades?.length) return {}

  const filtered = dateRange
    ? trades.filter((t) => t.time >= dateRange.start && t.time <= dateRange.end)
    : trades

  if (!filtered.length) return { total: 0, empty: true }

  const winners = filtered.filter((t) => t.pnl > 0)
  const losers = filtered.filter((t) => t.pnl < 0)
  const decidedTrades = winners.length + losers.length

  const grossPnL = filtered.reduce((s, t) => s + t.pnl, 0)
  const totalFees = filtered.reduce((s, t) => s + t.fee, 0)
  const netPnL = grossPnL - totalFees

  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss ? grossProfit / grossLoss : Infinity
  const avgWin = winners.length ? grossProfit / winners.length : 0
  const avgLoss = losers.length ? grossLoss / losers.length : 0
  const winRate = decidedTrades > 0 ? (winners.length / decidedTrades) * 100 : 0

  let ddPeak = 0
  let maxDD = 0
  let runCum = 0
  filtered.forEach((t) => {
    runCum += t.pnl
    if (runCum > ddPeak) ddPeak = runCum
    const dd = ddPeak > 0 ? (ddPeak - runCum) / ddPeak * 100 : 0
    if (dd > maxDD) maxDD = dd
  })

  let dsPeak = 0
  let dsRun = 0
  const drawdownSeries = filtered.map((t, i) => {
    dsRun += t.pnl
    if (dsRun > dsPeak) dsPeak = dsRun
    const dd = dsPeak > 0 ? -((dsPeak - dsRun) / dsPeak * 100) : 0
    return { i, dd: +dd.toFixed(2), date: localDateKey(t.time) }
  })

  const bySymbol = {}
  filtered.forEach((t) => {
    if (!bySymbol[t.symbol]) {
      bySymbol[t.symbol] = { pnl: 0, fees: 0, count: 0, wins: 0, losses: 0, longs: 0, shorts: 0, longPnl: 0, shortPnl: 0, leverage: [] }
    }
    const s = bySymbol[t.symbol]
    s.pnl += t.pnl
    s.fees += t.fee
    s.count++
    s.leverage.push(t.leverage || 1)
    if (t.pnl > 0) s.wins++
    if (t.pnl < 0) s.losses++
    if (t.side === 'BUY') {
      s.longs++
      s.longPnl += t.pnl
    } else {
      s.shorts++
      s.shortPnl += t.pnl
    }
  })

  const symbolArr = Object.entries(bySymbol).map(([sym, d]) => ({
    sym,
    ...d,
    wr: +(d.wins / Math.max(1, d.wins + d.losses) * 100).toFixed(1),
    avgPnl: +(d.pnl / d.count).toFixed(2),
    netPnl: +(d.pnl - d.fees).toFixed(2),
    avgLev: d.leverage.length ? +(d.leverage.reduce((a, b) => a + b, 0) / d.leverage.length).toFixed(1) : 1,
    rr: d.losses && d.wins ? +((d.pnl / d.wins) / Math.abs(d.pnl / d.losses)).toFixed(2) : '∞',
  })).sort((a, b) => b.pnl - a.pnl)

  let cum = 0
  const equityCurve = filtered.map((t, i) => {
    cum += t.pnl
    return { i, equity: t.equity, time: t.time, pnl: t.pnl, cumPnL: +cum.toFixed(2), date: localDateKey(t.time) }
  })

  const buildPeriod = (keyFn, extraFn = () => ({})) => {
    const map = {}
    filtered.forEach((t) => {
      const key = keyFn(t)
      if (!map[key]) map[key] = { pnl: 0, fees: 0, trades: 0, wins: 0, ts: t.time, label: key, ...extraFn(t) }
      map[key].pnl += t.pnl
      map[key].fees += t.fee
      map[key].trades++
      if (t.pnl > 0) map[key].wins++
    })
    return Object.values(map).sort((a, b) => a.ts - b.ts).map((d) => ({
      ...d,
      pnl: +d.pnl.toFixed(2),
      fees: +d.fees.toFixed(2),
      netPnl: +(d.pnl - d.fees).toFixed(2),
      wr: +(d.wins / d.trades * 100).toFixed(1),
    }))
  }

  const monthlyArr = buildPeriod(
    (t) => monthKeyFromTs(t.time),
    (t) => {
      const monthKey = monthKeyFromTs(t.time)
      const d = new Date(t.time)
      return {
        monthKey,
        monthLabel: monthLabelFromKey(monthKey),
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        m: monthLabelFromKey(monthKey),
        label: monthLabelFromKey(monthKey),
      }
    }
  )
  const weeklyArr = buildPeriod((t) => {
    const d = new Date(t.time)
    const jan = new Date(d.getFullYear(), 0, 1)
    const wk = Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7)
    return `W${wk} ${d.getFullYear()}`
  })
  const quarterlyArr = buildPeriod((t) => {
    const d = new Date(t.time)
    return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
  })
  const yearlyArr = buildPeriod((t) => String(new Date(t.time).getFullYear()))

  const dailyPnL = {}
  filtered.forEach((t) => {
    const key = localDateKey(t.time)
    if (!dailyPnL[key]) dailyPnL[key] = { pnl: 0, fees: 0, trades: 0, wins: 0 }
    dailyPnL[key].pnl += t.pnl
    dailyPnL[key].fees += t.fee
    dailyPnL[key].trades++
    if (t.pnl > 0) dailyPnL[key].wins++
  })

  let maxWinStreak = 0
  let maxLossStreak = 0
  let curW = 0
  let curL = 0
  let currentStreak = 0
  filtered.forEach((t) => {
    if (t.pnl > 0) {
      curW++
      curL = 0
      maxWinStreak = Math.max(maxWinStreak, curW)
      currentStreak = curW
    } else if (t.pnl < 0) {
      curL++
      curW = 0
      maxLossStreak = Math.max(maxLossStreak, curL)
      currentStreak = -curL
    }
  })

  const longs = filtered.filter((t) => t.side === 'BUY')
  const shorts = filtered.filter((t) => t.side === 'SELL')

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, pnl: 0, count: 0, wins: 0 }))
  filtered.forEach((t) => {
    const h = new Date(t.time).getHours()
    byHour[h].pnl += t.pnl
    byHour[h].count++
    if (t.pnl > 0) byHour[h].wins++
  })

  const byDay = Array.from({ length: 7 }, (_, d) => ({
    day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
    pnl: 0,
    count: 0,
    wins: 0,
    fees: 0,
  }))
  filtered.forEach((t) => {
    const d = new Date(t.time).getDay()
    byDay[d].pnl += t.pnl
    byDay[d].count++
    byDay[d].fees += t.fee
    if (t.pnl > 0) byDay[d].wins++
  })

  const activeDays = [...byDay].filter((d) => d.count > 0)
  const dayStats = {
    mostProfitable: [...activeDays].sort((a, b) => b.pnl - a.pnl)[0],
    leastProfitable: [...activeDays].sort((a, b) => a.pnl - b.pnl)[0],
    mostActive: [...activeDays].sort((a, b) => b.count - a.count)[0],
    leastActive: [...activeDays].sort((a, b) => a.count - b.count)[0],
    bestWinRate: [...activeDays].filter((d) => d.count >= 3).sort((a, b) => (b.wins / b.count) - (a.wins / a.count))[0],
    worstWinRate: [...activeDays].filter((d) => d.count >= 3).sort((a, b) => (a.wins / a.count) - (b.wins / b.count))[0],
  }

  const pnlVals = filtered.map((t) => t.pnl)
  const minPnl = Math.min(...pnlVals)
  const maxPnl = Math.max(...pnlVals)
  const step = (maxPnl - minPnl) / 24 || 1
  const distribution = Array.from({ length: 24 }, (_, i) => {
    const from = minPnl + i * step
    return { label: `$${from.toFixed(0)}`, from, count: filtered.filter((t) => t.pnl >= from && t.pnl < from + step).length, isPositive: from >= 0 }
  })

  const mean = pnlVals.reduce((a, b) => a + b, 0) / pnlVals.length
  const std = Math.sqrt(pnlVals.map((r) => (r - mean) ** 2).reduce((a, b) => a + b, 0) / pnlVals.length) || 1
  const sharpe = +(mean / std * Math.sqrt(252)).toFixed(2)

  const startEquity = filtered[0]?.equity - filtered[0]?.pnl + (filtered[0]?.fee || 0)
  const endEquity = filtered[filtered.length - 1]?.equity || startEquity
  const totalReturn = startEquity > 0 ? (endEquity - startEquity) / startEquity * 100 : 0

  const riskArr = filtered
    .map((trade) => ({
      trade,
      riskValue: getTradeRiskValue(trade),
      riskSource: trade.riskPercent != null && trade.riskPercent > 0 ? 'riskPercent' : 'estimated margin use',
    }))
    .filter((item) => item.riskValue > 0)

  return {
    total: filtered.length,
    winners: winners.length,
    losers: losers.length,
    grossPnL: +grossPnL.toFixed(2),
    totalFees: +totalFees.toFixed(4),
    netPnL: +netPnL.toFixed(2),
    totalPnL: +grossPnL.toFixed(2),
    grossProfit: +grossProfit.toFixed(2),
    grossLoss: +grossLoss.toFixed(2),
    avgWin,
    avgLoss,
    winRate,
    profitFactor,
    rr: avgLoss ? +(avgWin / avgLoss).toFixed(2) : '∞',
    maxDD: +maxDD.toFixed(2),
    drawdownSeries,
    symbolArr,
    equityCurve,
    dailyPnL,
    monthlyArr,
    weeklyArr,
    quarterlyArr,
    yearlyArr,
    longs: longs.length,
    shorts: shorts.length,
    longPnL: +longs.reduce((s, t) => s + t.pnl, 0).toFixed(2),
    shortPnL: +shorts.reduce((s, t) => s + t.pnl, 0).toFixed(2),
    longWR: longs.length ? longs.filter((t) => t.pnl > 0).length / longs.length * 100 : 0,
    shortWR: shorts.length ? shorts.filter((t) => t.pnl > 0).length / shorts.length * 100 : 0,
    maxWinStreak,
    maxLossStreak,
    currentStreak,
    largestWin: Math.max(...pnlVals),
    largestLoss: Math.min(...pnlVals),
    byHour,
    byDay,
    dayStats,
    distribution,
    sharpe,
    avgRiskPct: riskArr.length ? riskArr.reduce((s, item) => s + item.riskValue, 0) / riskArr.length : 0,
    riskArr,
    startEquity,
    endEquity,
    totalReturn,
    dateRange: dateRange || { start: filtered[0]?.time, end: filtered[filtered.length - 1]?.time },
    firstDate: filtered[0]?.time,
    lastDate: filtered[filtered.length - 1]?.time,
  }
}

export const fmt = (n, d = 2) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtUSD = (n) => (n >= 0 ? '+$' : '-$') + fmt(Math.abs(n))
export const fmtPct = (n) => (n >= 0 ? '+' : '') + fmt(n) + '%'
export const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
