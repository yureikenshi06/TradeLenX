import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt } from '../lib/data'
import { Card, SectionHead, ProgressBar, Select, ChartTooltip } from '../components/UI'

const PERIOD_OPTS = [
  { value: 'all', label: 'All Time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

class SymbolDetailBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Symbols detail render failed:', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <SectionHead title="Symbol Detail Unavailable" sub="This symbol's detail panel hit a render error" />
          <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.7 }}>
            The symbol summary is still safe, but the detail panel could not render.
            Try another symbol or reload the page. The page should no longer go fully blank.
          </div>
        </Card>
      )
    }
    return this.props.children
  }
}

function TradeTable({ title, trades, color }) {
  const visibleTrades = trades.slice(0, 150)
  return (
    <Card>
      <SectionHead title={title} sub={`${trades.length} trades${trades.length > visibleTrades.length ? ` · showing first ${visibleTrades.length}` : ''}`} />
      {visibleTrades.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 360, overflowY: 'auto' }}>
          {visibleTrades.map((t, i) => (
            <div key={`${t.id}-${i}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: `${color}12`, borderRadius: 7, border: `1px solid ${color}22` }}>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: T.fontMono, textAlign: 'center' }}>#{i + 1}</div>
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid }}>{t.side}</span>
                  <span style={{ fontSize: 10, color: T.muted }}>{fmt(t.qty, 4)} @ ${fmt(t.price)}</span>
                  <span style={{ fontSize: 9, color: T.muted }}>{t.leverage}x</span>
                </div>
                <div style={{ fontSize: 9, color: T.muted }}>
                  {new Date(t.time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} {new Date(t.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {t.fee ? <span style={{ color: T.red }}> · fee: -${fmt(t.fee, 4)}</span> : null}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: T.fontMono }}>{t.pnl >= 0 ? '+' : '-'}{fmt(Math.abs(t.pnl), 2)}</div>
                <div style={{ fontSize: 9, color: T.muted }}>net: {t.pnl - (t.fee || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(t.pnl - (t.fee || 0)), 2)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: T.muted, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>No trades in this section.</div>
      )}
    </Card>
  )
}

export default function SymbolsPage({ trades, stats }) {
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('pnl')
  const [filterMin, setFilterMin] = useState(0)
  const [chartPeriod, setChartPeriod] = useState('monthly')

  const SORT_OPTIONS = [
    { value: 'pnl', label: 'Sort: Gross P&L' },
    { value: 'netPnl', label: 'Sort: Net P&L' },
    { value: 'count', label: 'Sort: Trades' },
    { value: 'wr', label: 'Sort: Win Rate' },
    { value: 'fees', label: 'Sort: Fees' },
    { value: 'maxDD', label: 'Sort: Drawdown' },
  ]

  const symData = useMemo(() => {
    return (stats.symbolArr || []).map((sym) => {
      const symTrades = trades.filter((t) => t.symbol === sym.sym).sort((a, b) => a.time - b.time)
      const winners = symTrades.filter((t) => t.pnl > 0)
      const losers = symTrades.filter((t) => t.pnl < 0)

      let cum = 0
      let dsPeak = 0
      let maxDD = 0
      const curve = symTrades.map((t) => {
        cum += t.pnl
        if (cum > dsPeak) dsPeak = cum
        const dd = dsPeak > 0 ? (dsPeak - cum) / dsPeak * 100 : 0
        if (dd > maxDD) maxDD = dd
        return { cum: +cum.toFixed(2), pnl: t.pnl }
      })

      const buildPeriod = (keyFn) => {
        const map = {}
        symTrades.forEach((t) => {
          const key = keyFn(t)
          if (!map[key]) map[key] = { label: key, pnl: 0, count: 0, wins: 0, ts: t.time }
          map[key].pnl += t.pnl
          map[key].count++
          if (t.pnl > 0) map[key].wins++
        })
        return Object.values(map).sort((a, b) => a.ts - b.ts)
      }

      const periods = {
        all: curve.map((c, i) => ({ label: String(i + 1), ...c })),
        weekly: buildPeriod((t) => {
          const d = new Date(t.time)
          const j = new Date(d.getFullYear(), 0, 1)
          const w = Math.ceil(((d - j) / 86400000 + j.getDay() + 1) / 7)
          return `W${w}`
        }),
        monthly: buildPeriod((t) => new Date(t.time).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
        quarterly: buildPeriod((t) => {
          const d = new Date(t.time)
          return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
        }),
        yearly: buildPeriod((t) => String(new Date(t.time).getFullYear())),
      }

      const longTrades = symTrades.filter((t) => t.side === 'BUY')
      const shortTrades = symTrades.filter((t) => t.side === 'SELL')
      const leverages = symTrades.map((t) => t.leverage || 1)

      return {
        ...sym,
        symTrades,
        winners,
        losers,
        curve: curve.filter((point) => Number.isFinite(point.cum) && Number.isFinite(point.pnl)),
        periods,
        maxDD: +maxDD.toFixed(2),
        netPnl: +(sym.pnl - sym.fees).toFixed(2),
        avgWin: winners.length ? +(winners.reduce((s, t) => s + t.pnl, 0) / winners.length).toFixed(2) : 0,
        avgLoss: losers.length ? +(Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)).toFixed(2) : 0,
        avgPnl: symTrades.length ? +(symTrades.reduce((s, t) => s + t.pnl, 0) / symTrades.length).toFixed(2) : 0,
        maxWin: symTrades.length ? Math.max(...symTrades.map((t) => t.pnl)) : 0,
        maxLoss: symTrades.length ? Math.min(...symTrades.map((t) => t.pnl)) : 0,
        longTrades,
        shortTrades,
        longPnl: +longTrades.reduce((s, t) => s + t.pnl, 0).toFixed(2),
        shortPnl: +shortTrades.reduce((s, t) => s + t.pnl, 0).toFixed(2),
        longWR: longTrades.length ? +(longTrades.filter((t) => t.pnl > 0).length / longTrades.length * 100).toFixed(1) : 0,
        shortWR: shortTrades.length ? +(shortTrades.filter((t) => t.pnl > 0).length / shortTrades.length * 100).toFixed(1) : 0,
        avgLev: leverages.length ? +(leverages.reduce((a, b) => a + b, 0) / leverages.length).toFixed(1) : 1,
        rr: losers.length && winners.length ? +((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) / Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)).toFixed(2) : '∞',
      }
    })
  }, [trades, stats.symbolArr])

  const sorted = [...symData].filter((s) => s.count >= filterMin).sort((a, b) => {
    if (sortBy === 'wr') return parseFloat(b.wr) - parseFloat(a.wr)
    return (b[sortBy] || 0) - (a[sortBy] || 0)
  })

  const sel = symData.find((s) => s.sym === selected)
  const maxAbsPnl = Math.max(1, ...symData.map((s) => Math.abs(s.pnl)))
  const periodChartData = sel ? (sel.periods[chartPeriod] || []) : []
  const profitableTrades = sel ? [...sel.symTrades].filter((t) => t.pnl > 0).sort((a, b) => b.pnl - a.pnl) : []
  const losingTrades = sel ? [...sel.symTrades].filter((t) => t.pnl < 0).sort((a, b) => a.pnl - b.pnl) : []
  const safeSel = sel ? {
    ...sel,
    pnl: sel.pnl || 0,
    netPnl: sel.netPnl || 0,
    fees: sel.fees || 0,
    wr: sel.wr || 0,
    rr: sel.rr ?? '∞',
    maxDD: sel.maxDD || 0,
    avgWin: sel.avgWin || 0,
    avgLoss: sel.avgLoss || 0,
    avgPnl: sel.avgPnl || 0,
    maxWin: sel.maxWin || 0,
    maxLoss: sel.maxLoss || 0,
    avgLev: sel.avgLev || 1,
    longTrades: sel.longTrades || [],
    shortTrades: sel.shortTrades || [],
    longPnl: sel.longPnl || 0,
    shortPnl: sel.shortPnl || 0,
    longWR: sel.longWR || 0,
    shortWR: sel.shortWR || 0,
  } : null
  const safePeriodChartData = (periodChartData || []).filter((item) => Number.isFinite(item.pnl ?? item.cum ?? 0))
  const safeCurve = safeSel?.curve || []

  return (
    <div className="page-enter" style={{ padding: '24px 28px', fontFamily: 'Inter,-apple-system,sans-serif' }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>Symbol Breakdown</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Symbol Analysis</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{symData.length} symbols · click any for deep-dive</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ fontSize: 11 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
              Min trades:
              <input type="number" value={filterMin} min={0} onChange={(e) => setFilterMin(+e.target.value)}
                style={{ width: 46, background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', color: T.text, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, outline: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: sel ? 16 : 0 }}>
        {sorted.map((sym) => (
          <div key={sym.sym} onClick={() => setSelected(sym.sym === selected ? null : sym.sym)} style={{
            background: selected === sym.sym ? T.accentDim : T.card,
            border: `1px solid ${selected === sym.sym ? T.accent : `${colorPnL(sym.pnl)}44`}`,
            borderRadius: 10, padding: '14px', cursor: 'pointer', transition: 'all 0.12s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{sym.sym.replace('USDT', '')}<span style={{ color: T.muted, fontSize: 10 }}>/USDT</span></div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{sym.count} trades · {sym.wr}% WR</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: colorPnL(sym.pnl), fontFamily: 'JetBrains Mono,monospace' }}>{sym.pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(sym.pnl))}</div>
                <div style={{ fontSize: 10, color: T.red }}>-${fmt(sym.fees)} fees</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={44}>
              <AreaChart data={sym.curve}>
                <defs><linearGradient id={`sg${sym.sym}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorPnL(sym.pnl)} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colorPnL(sym.pnl)} stopOpacity={0} />
                </linearGradient></defs>
                <ReferenceLine y={0} stroke={T.muted} strokeDasharray="2 2" />
                <Area type="monotone" dataKey="cum" stroke={colorPnL(sym.pnl)} fill={`url(#sg${sym.sym})`} strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
              {[
                { l: 'Net', v: `${sym.netPnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(sym.netPnl))}`, c: colorPnL(sym.netPnl) },
                { l: 'R:R', v: `${sym.rr}x`, c: parseFloat(sym.rr) >= 1.5 ? T.green : T.red },
                { l: 'DD', v: `${fmt(sym.maxDD)}%`, c: T.red },
              ].map((r) => (
                <div key={r.l} style={{ textAlign: 'center', background: T.surface, borderRadius: 5, padding: '4px 2px' }}>
                  <div style={{ fontSize: 8, color: T.muted, textTransform: 'uppercase' }}>{r.l}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: r.c, fontFamily: 'JetBrains Mono,monospace' }}>{r.v}</div>
                </div>
              ))}
            </div>
            <ProgressBar value={Math.abs(sym.pnl)} max={maxAbsPnl} color={colorPnL(sym.pnl)} height={3} />
          </div>
        ))}
      </div>

      {safeSel && (
        <SymbolDetailBoundary resetKey={safeSel.sym}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: T.card, borderRadius: 10, border: `1px solid ${T.accentGlow}` }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>{safeSel.sym.replace('USDT', '')}<span style={{ color: T.muted, fontSize: 12 }}>/USDT</span></div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{safeSel.count} total trades · avg leverage {safeSel.avgLev}x</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            {[
              { l: 'Gross P&L', v: `${safeSel.pnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(safeSel.pnl))}`, c: colorPnL(safeSel.pnl) },
              { l: 'Net P&L', v: `${safeSel.netPnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(safeSel.netPnl))}`, c: colorPnL(safeSel.netPnl) },
              { l: 'Total Fees', v: `-$${fmt(safeSel.fees)}`, c: T.red },
              { l: 'Win Rate', v: `${safeSel.wr}%`, c: parseFloat(safeSel.wr) >= 50 ? T.green : T.red },
              { l: 'R:R', v: `${safeSel.rr}x`, c: Number.isFinite(parseFloat(safeSel.rr)) && parseFloat(safeSel.rr) >= 1.5 ? T.green : T.red },
              { l: 'Max DD', v: `${fmt(safeSel.maxDD)}%`, c: T.red },
              { l: 'Avg Win', v: `+$${fmt(safeSel.avgWin)}`, c: T.green },
              { l: 'Avg Loss', v: `-$${fmt(safeSel.avgLoss)}`, c: T.red },
              { l: 'Best Trade', v: `+$${fmt(safeSel.maxWin)}`, c: T.green },
              { l: 'Worst Trade', v: `-$${fmt(Math.abs(safeSel.maxLoss))}`, c: T.red },
              { l: 'Avg Lev', v: `${safeSel.avgLev}x`, c: safeSel.avgLev >= 10 ? T.red : T.accent },
              { l: 'Avg P&L', v: `${safeSel.avgPnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(safeSel.avgPnl))}`, c: colorPnL(safeSel.avgPnl) },
            ].map((r) => (
              <div key={r.l} style={{ background: T.surface, borderRadius: 8, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{r.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.c, fontFamily: 'JetBrains Mono,monospace' }}>{r.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { side: 'LONG', trades: safeSel.longTrades, pnl: safeSel.longPnl, wr: safeSel.longWR, c: T.blue },
              { side: 'SHORT', trades: safeSel.shortTrades, pnl: safeSel.shortPnl, wr: safeSel.shortWR, c: T.purple },
            ].map((s) => (
              <div key={s.side} style={{ background: T.surface, borderRadius: 8, padding: '12px 16px', border: `1px solid ${s.c}33` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: s.c, fontWeight: 600, marginBottom: 4 }}>{s.side} ({s.trades.length} trades)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: colorPnL(s.pnl), fontFamily: 'JetBrains Mono,monospace' }}>{s.pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(s.pnl))}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Win Rate</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: parseFloat(s.wr) >= 50 ? T.green : T.red }}>{fmt(s.wr)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <SectionHead title="Cumulative P&L" sub="Trade-by-trade" />
              {safeCurve.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={safeCurve} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                    <defs><linearGradient id={`selG-${safeSel.sym}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorPnL(safeSel.pnl)} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colorPnL(safeSel.pnl)} stopOpacity={0} />
                    </linearGradient></defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                    <XAxis hide />
                    <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={56} />
                    <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip formatter={(v) => `$${fmt(v)}`} />} />
                    <Area type="monotone" dataKey="cum" stroke={colorPnL(safeSel.pnl)} fill={`url(#selG-${safeSel.sym})`} strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: T.muted, fontSize: 12, padding: '40px 0', textAlign: 'center' }}>No curve data for this symbol.</div>
              )}
            </Card>

            <Card>
              <SectionHead title="P&L by Period" sub="" action={<Select value={chartPeriod} onChange={setChartPeriod} options={PERIOD_OPTS} style={{ fontSize: 11, padding: '4px 8px' }} />} />
              {safePeriodChartData.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={safePeriodChartData} barSize={20} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 9 }} tickLine={false} axisLine={{ stroke: T.border }} />
                    <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={56} />
                    <ReferenceLine y={0} stroke={T.border} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `$${fmt(v)}`} />} />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {safePeriodChartData.map((d, i) => <Cell key={i} fill={(d.pnl || 0) >= 0 ? T.green : T.red} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: T.muted, fontSize: 12, padding: '40px 0', textAlign: 'center' }}>No period data for this symbol.</div>
              )}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TradeTable title={`Winning Trades — ${safeSel.sym.replace('USDT', '/USDT')}`} trades={profitableTrades} color={T.green} />
            <TradeTable title={`Losing Trades — ${safeSel.sym.replace('USDT', '/USDT')}`} trades={losingTrades} color={T.red} />
          </div>
          </div>
        </SymbolDetailBoundary>
      )}
    </div>
  )
}
