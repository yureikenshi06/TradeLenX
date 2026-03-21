export function generateMockTrades(count = 150) {
  const symbols = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','ADAUSDT','XRPUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT','ARBUSDT','OPUSDT','INJUSDT']
  const trades = []
  let equity = 10000
  let time = Date.now() - count * 1.5 * 24 * 3600 * 1000
  for (let i = 0; i < count; i++) {
    const sym  = symbols[Math.floor(Math.random() * symbols.length)]
    const side = Math.random() > 0.48 ? 'BUY' : 'SELL'
    const qty  = +(Math.random() * 0.5 + 0.01).toFixed(4)
    const price = sym.startsWith('BTC') ? 42000 + Math.random() * 20000
      : sym.startsWith('ETH') ? 2200 + Math.random() * 1000
      : sym.startsWith('BNB') ? 300 + Math.random() * 150
      : sym.startsWith('SOL') ? 90 + Math.random() * 100
      : 5 + Math.random() * 60
    const fee = price * qty * 0.0004
    // PnL is the raw realized gain before fees (Binance gives realizedPnl this way)
    // Net per trade = pnl - fee
    const pnl = (Math.random() - 0.44) * price * qty * 0.06
    equity += pnl - fee
    time += Math.random() * 1.5 * 24 * 3600 * 1000
    const lev = [2,3,5,10,20,25][Math.floor(Math.random()*6)]
    trades.push({
      id: `F${1000+i}`, symbol: sym, side, qty,
      price: +price.toFixed(2), fee: +fee.toFixed(4),
      pnl: +pnl.toFixed(4), equity: +equity.toFixed(2),
      time, leverage: lev,
      entryPrice: +price.toFixed(2),
      exitPrice: +(price*(1+(Math.random()-0.5)*0.04)).toFixed(2),
      riskPercent: +(Math.random()*4).toFixed(2),
      source: 'futures',
    })
  }
  return trades
}

export function localDateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Load/save cash flow from localStorage
export function loadCashFlow() {
  try { return JSON.parse(localStorage.getItem('tl_cashflow') || '[]') } catch { return [] }
}
export function saveCashFlow(cf) {
  try { localStorage.setItem('tl_cashflow', JSON.stringify(cf)) } catch {}
}

export function computeStats(trades, dateRange) {
  if (!trades?.length) return {}

  // Apply date range filter if provided
  const filtered = dateRange
    ? trades.filter(t => t.time >= dateRange.start && t.time <= dateRange.end)
    : trades

  if (!filtered.length) return { total:0, empty:true }

  const winners      = filtered.filter(t => t.pnl > 0)
  const losers       = filtered.filter(t => t.pnl < 0)
  // Win rate: winners / (winners + losers) — excludes breakeven trades
  const decidedTrades = winners.length + losers.length

  // PnL: gross = sum of realizedPnl; net = gross - fees
  const grossPnL     = filtered.reduce((s,t) => s + t.pnl, 0)
  const totalFees    = filtered.reduce((s,t) => s + t.fee, 0)
  const netPnL       = grossPnL - totalFees

  const grossProfit  = winners.reduce((s,t)=>s+t.pnl, 0)
  const grossLoss    = Math.abs(losers.reduce((s,t)=>s+t.pnl, 0))
  const profitFactor = grossLoss ? grossProfit/grossLoss : Infinity
  const avgWin       = winners.length ? grossProfit/winners.length : 0
  const avgLoss      = losers.length  ? grossLoss/losers.length : 0
  // Correct win rate: % of decided trades that were winners
  const winRate      = decidedTrades > 0 ? (winners.length/decidedTrades)*100 : 0

  // Drawdown: peak-to-trough on running cumulative PnL (not equity which includes deposits)
  // Start from 0, track high watermark of cumPnL
  let ddPeak = 0, maxDD = 0, runCum = 0
  filtered.forEach(t => {
    runCum += t.pnl
    if (runCum > ddPeak) ddPeak = runCum
    const dd = ddPeak > 0 ? (ddPeak - runCum) / ddPeak * 100 : (ddPeak < runCum ? 0 : 0)
    if (dd > maxDD) maxDD = dd
  })

  // Drawdown series for chart - based on cumulative PnL watermark
  let dsPeak = 0, dsRun = 0
  const drawdownSeries = filtered.map((t,i) => {
    dsRun += t.pnl
    if (dsRun > dsPeak) dsPeak = dsRun
    const dd = dsPeak > 0 ? -((dsPeak - dsRun) / dsPeak * 100) : 0
    return { i, dd: +dd.toFixed(2), date: localDateKey(t.time) }
  })

  // By symbol — no duration
  const bySymbol = {}
  filtered.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnl:0, fees:0, count:0, wins:0, losses:0, longs:0, shorts:0, longPnl:0, shortPnl:0, leverage:[] }
    const s = bySymbol[t.symbol]
    s.pnl   += t.pnl
    s.fees  += t.fee
    s.count++
    s.leverage.push(t.leverage||1)
    t.pnl > 0 ? s.wins++ : s.losses++
    if (t.side==='BUY')  { s.longs++;  s.longPnl  += t.pnl }
    else                  { s.shorts++; s.shortPnl += t.pnl }
  })
  const symbolArr = Object.entries(bySymbol).map(([sym,d]) => ({
    sym, ...d,
    wr:        +(d.wins/d.count*100).toFixed(1),
    avgPnl:    +(d.pnl/d.count).toFixed(2),
    netPnl:    +(d.pnl - d.fees).toFixed(2),
    avgLev:    d.leverage.length ? +(d.leverage.reduce((a,b)=>a+b,0)/d.leverage.length).toFixed(1) : 1,
    rr:        d.losses && d.wins ? +((d.pnl/d.wins) / Math.abs((d.pnl/d.losses))).toFixed(2) : '∞',
  })).sort((a,b)=>b.pnl-a.pnl)

  // Equity curve with cumPnL
  let cum = 0
  const equityCurve = filtered.map((t,i) => {
    cum += t.pnl
    return { i, equity:t.equity, time:t.time, pnl:t.pnl, cumPnL:+cum.toFixed(2), date:localDateKey(t.time) }
  })

  // Asset value curve = equity adjusted for deposits/withdrawals (built in Dashboard)
  // Monthly/Weekly/Quarterly/Yearly
  const buildPeriod = (keyFn) => {
    const map = {}
    filtered.forEach(t => {
      const key = keyFn(t)
      if (!map[key]) map[key] = { pnl:0,fees:0,trades:0,wins:0,ts:t.time,label:key }
      map[key].pnl += t.pnl; map[key].fees += t.fee; map[key].trades++
      if (t.pnl>0) map[key].wins++
    })
    return Object.values(map).sort((a,b)=>a.ts-b.ts).map(d=>({
      ...d, pnl:+d.pnl.toFixed(2), fees:+d.fees.toFixed(2),
      netPnl:+(d.pnl-d.fees).toFixed(2),
      wr:+(d.wins/d.trades*100).toFixed(1),
    }))
  }
  const monthlyArr   = buildPeriod(t => new Date(t.time).toLocaleDateString('en-US',{month:'short',year:'2-digit'}))
  const weeklyArr    = buildPeriod(t => { const d=new Date(t.time),jan=new Date(d.getFullYear(),0,1),wk=Math.ceil(((d-jan)/86400000+jan.getDay()+1)/7); return `W${wk} ${d.getFullYear()}` })
  const quarterlyArr = buildPeriod(t => { const d=new Date(t.time); return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}` })
  const yearlyArr    = buildPeriod(t => String(new Date(t.time).getFullYear()))

  // Daily PnL (calendar)
  const dailyPnL = {}
  filtered.forEach(t => {
    const key = localDateKey(t.time)
    if (!dailyPnL[key]) dailyPnL[key] = { pnl:0,fees:0,trades:0,wins:0 }
    dailyPnL[key].pnl += t.pnl; dailyPnL[key].fees += t.fee; dailyPnL[key].trades++
    if (t.pnl>0) dailyPnL[key].wins++
  })

  // Streaks
  let maxWinStreak=0,maxLossStreak=0,curW=0,curL=0,currentStreak=0
  filtered.forEach(t => {
    if (t.pnl>0) { curW++; curL=0; maxWinStreak=Math.max(maxWinStreak,curW); currentStreak=curW }
    else          { curL++; curW=0; maxLossStreak=Math.max(maxLossStreak,curL); currentStreak=-curL }
  })

  // Long/Short
  const longs  = filtered.filter(t => t.side==='BUY')
  const shorts = filtered.filter(t => t.side==='SELL')

  // Hour heatmap
  const byHour = Array.from({length:24},(_,h) => ({ hour:h, pnl:0, count:0, wins:0 }))
  filtered.forEach(t => {
    const h = new Date(t.time).getHours()
    byHour[h].pnl += t.pnl; byHour[h].count++
    if (t.pnl>0) byHour[h].wins++
  })

  // Day of week
  const byDay = Array.from({length:7},(_,d) => ({
    day:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d],
    short:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d],
    pnl:0, count:0, wins:0, fees:0
  }))
  filtered.forEach(t => {
    const d = new Date(t.time).getDay()
    byDay[d].pnl += t.pnl; byDay[d].count++; byDay[d].fees += t.fee
    if (t.pnl>0) byDay[d].wins++
  })
  const activeDays = [...byDay].filter(d => d.count > 0)
  const dayStats = {
    mostProfitable:  [...activeDays].sort((a,b) => b.pnl-a.pnl)[0],
    leastProfitable: [...activeDays].sort((a,b) => a.pnl-b.pnl)[0],
    mostActive:      [...activeDays].sort((a,b) => b.count-a.count)[0],
    leastActive:     [...activeDays].sort((a,b) => a.count-b.count)[0],
    bestWinRate:     [...activeDays].filter(d=>d.count>=3).sort((a,b)=>(b.wins/b.count)-(a.wins/a.count))[0],
    worstWinRate:    [...activeDays].filter(d=>d.count>=3).sort((a,b)=>(a.wins/a.count)-(b.wins/b.count))[0],
  }

  // PnL distribution
  const pnlVals = filtered.map(t=>t.pnl)
  const minPnl = Math.min(...pnlVals), maxPnl = Math.max(...pnlVals)
  const step = (maxPnl-minPnl)/24||1
  const distribution = Array.from({length:24},(_,i) => {
    const from = minPnl+i*step
    return { label:`$${from.toFixed(0)}`, from, count:filtered.filter(t=>t.pnl>=from&&t.pnl<from+step).length, isPositive:from>=0 }
  })

  // Sharpe
  const mean = pnlVals.reduce((a,b)=>a+b,0)/pnlVals.length
  const std  = Math.sqrt(pnlVals.map(r=>(r-mean)**2).reduce((a,b)=>a+b,0)/pnlVals.length) || 1
  const sharpe = +(mean/std*Math.sqrt(252)).toFixed(2)

  const startEquity = filtered[0]?.equity - filtered[0]?.pnl + (filtered[0]?.fee||0)
  const endEquity   = filtered[filtered.length-1]?.equity || startEquity
  const totalReturn = startEquity > 0 ? (endEquity-startEquity)/startEquity*100 : 0

  return {
    total:filtered.length, winners:winners.length, losers:losers.length,
    // PnL — always: netPnL = grossPnL - totalFees
    grossPnL:+grossPnL.toFixed(2),
    totalFees:+totalFees.toFixed(4),
    netPnL:+netPnL.toFixed(2),
    // keep totalPnL as alias for grossPnL for backward compat
    totalPnL:+grossPnL.toFixed(2),
    grossProfit:+grossProfit.toFixed(2),
    grossLoss:+grossLoss.toFixed(2),
    avgWin, avgLoss, winRate, profitFactor,
    rr: avgLoss ? +(avgWin/avgLoss).toFixed(2) : '∞',
    maxDD:+maxDD.toFixed(2), drawdownSeries,
    symbolArr, equityCurve, dailyPnL,
    monthlyArr, weeklyArr, quarterlyArr, yearlyArr,
    longs:longs.length, shorts:shorts.length,
    longPnL:  +longs.reduce((s,t)=>s+t.pnl,0).toFixed(2),
    shortPnL: +shorts.reduce((s,t)=>s+t.pnl,0).toFixed(2),
    longWR:   longs.length  ? longs.filter(t=>t.pnl>0).length/longs.length*100  : 0,
    shortWR:  shorts.length ? shorts.filter(t=>t.pnl>0).length/shorts.length*100 : 0,
    maxWinStreak, maxLossStreak, currentStreak,
    largestWin:  Math.max(...pnlVals),
    largestLoss: Math.min(...pnlVals),
    byHour, byDay, dayStats, distribution, sharpe,
    avgRiskPct: filtered.reduce((s,t)=>s+(t.riskPercent||0),0)/filtered.length,
    startEquity, endEquity, totalReturn,
    dateRange: dateRange || { start:filtered[0]?.time, end:filtered[filtered.length-1]?.time },
    firstDate: filtered[0]?.time,
    lastDate:  filtered[filtered.length-1]?.time,
  }
}

export const fmt     = (n,d=2) => n==null||isNaN(n)?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})
export const fmtUSD  = (n) => (n>=0?'+$':'-$')+fmt(Math.abs(n))
export const fmtPct  = (n) => (n>=0?'+':'')+fmt(n)+'%'
export const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
