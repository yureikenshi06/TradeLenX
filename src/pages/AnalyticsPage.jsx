import {
  ScatterChart, Scatter, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt } from '../lib/data'
import { Card, SectionHead, ChartTooltip } from '../components/UI'

export default function AnalyticsPage({ trades, stats }) {
  if (!trades?.length) return null

  const waterfallData = trades.slice(0, 80).map((t, i) => ({ i: i + 1, pnl: t.pnl, sym: t.symbol }))
  const leverageTrades = trades.filter((t) => Math.abs(t.pnl || 0) > 0.000001)

  const byLev = {}
  leverageTrades.forEach((t) => {
    const leverage = Math.max(1, Math.round(Number(t.leverage) || 1))
    const key = `${leverage}x`
    if (!byLev[key]) byLev[key] = { lev: key, leverage, pnl: 0, netPnl: 0, count: 0, wins: 0 }
    byLev[key].pnl += t.pnl || 0
    byLev[key].netPnl += (t.pnl || 0) - (t.fee || 0)
    byLev[key].count++
    if (t.pnl > 0) byLev[key].wins++
  })
  const levArr = Object.values(byLev)
    .sort((a, b) => a.leverage - b.leverage)
    .map((item) => ({
      ...item,
      avgNetPnl: item.count ? +(item.netPnl / item.count).toFixed(2) : 0,
      wr: item.count ? +(item.wins / item.count * 100).toFixed(1) : 0,
    }))

  const pnlVals = trades.map((t) => t.pnl)
  const minPnl = Math.min(...pnlVals)
  const maxPnl = Math.max(...pnlVals)
  const bucketCount = 20
  const step = (maxPnl - minPnl) / bucketCount || 1
  const histogram = Array.from({ length: bucketCount }, (_, i) => {
    const from = minPnl + i * step
    const count = trades.filter((t) => t.pnl >= from && t.pnl < from + step).length
    return { label: `$${from.toFixed(0)}`, from, count, isPos: from >= 0 }
  })

  const byHour = stats.byHour || []

  const riskBands = [
    { min: 0, max: 0.5, label: '0-0.5%' },
    { min: 0.5, max: 1, label: '0.5-1%' },
    { min: 1, max: 2, label: '1-2%' },
    { min: 2, max: 3, label: '2-3%' },
    { min: 3, max: 5, label: '3-5%' },
    { min: 5, max: Infinity, label: '5%+' },
  ]

  const riskTrades = stats.riskArr || []
  const riskBuckets = riskBands.map((band) => {
    const items = riskTrades.filter((item) => item.riskValue > band.min && item.riskValue <= band.max)
    const wins = items.filter((item) => item.trade.pnl > 0).length
    const pnl = items.reduce((sum, item) => sum + item.trade.pnl, 0)
    const fees = items.reduce((sum, item) => sum + (item.trade.fee || 0), 0)
    const avgRisk = items.length ? items.reduce((sum, item) => sum + item.riskValue, 0) / items.length : 0
    return {
      label: band.label,
      count: items.length,
      netPnl: pnl - fees,
      avgRisk,
      winRate: items.length ? wins / items.length * 100 : 0,
    }
  }).filter((item) => item.count > 0)

  return (
    <div className="page-enter" style={{ padding: '24px 28px', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>Deep Dive</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Advanced Analytics</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card>
          <SectionHead title="Trade P&L Waterfall" sub="Each trade result" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfallData} barSize={Math.max(3, Math.min(14, 600 / waterfallData.length))} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="i" tick={{ fill: T.muted, fontSize: 9 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={56} />
              <ReferenceLine y={0} stroke={T.border} />
              <Tooltip content={<ChartTooltip formatter={(v) => `$${fmt(v)}`} />} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]} name="P&L">
                {waterfallData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? T.green : T.red} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead title="P&L Distribution" sub="Trade outcome histogram" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histogram} barSize={16} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 9 }} tickLine={false} axisLine={{ stroke: T.border }} interval={4} />
              <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} trades`} />} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {histogram.map((d, i) => <Cell key={i} fill={d.isPos ? T.green : T.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card>
          <SectionHead title="P&L by Leverage" sub="Risk vs reward by leverage used" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levArr} barSize={28} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="lev" tick={{ fill: T.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={60} />
              <ReferenceLine y={0} stroke={T.border} />
              <Tooltip content={<ChartTooltip formatter={(v, n) => n === 'Net P&L' || n === 'Avg/Trade' ? `$${fmt(v)}` : `${v} trades`} />} />
              <Bar dataKey="netPnl" radius={[4, 4, 0, 0]} name="Net P&L">
                {levArr.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? T.green : T.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead title="Win Rate by Leverage" sub="Are higher leverage trades less disciplined?" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levArr} barSize={28} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="lev" tick={{ fill: T.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={40} />
              <ReferenceLine y={50} stroke={T.muted} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip formatter={(v) => `${fmt(v)}%`} />} />
              <Bar dataKey="wr" radius={[4, 4, 0, 0]} name="Win Rate">
                {levArr.map((d, i) => <Cell key={i} fill={d.wr >= 60 ? T.green : d.wr >= 40 ? T.accent : T.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <SectionHead title="24-Hour P&L Heatmap" sub="Best and worst hours to trade" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 4, alignItems: 'end' }}>
          {byHour.map((h, i) => {
            const maxAbs = Math.max(1, ...byHour.map((x) => Math.abs(x.pnl)))
            const intensity = Math.abs(h.pnl) / maxAbs
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ fontSize: 8, color: colorPnL(h.pnl), fontWeight: 700, height: 16, display: 'flex', alignItems: 'flex-end' }}>
                  {h.count > 0 ? `${h.pnl >= 0 ? '+' : ''}${fmt(h.pnl, 0)}` : ''}
                </div>
                <div style={{
                  width: '100%',
                  borderRadius: '3px 3px 0 0',
                  height: Math.max(6, intensity * 120),
                  background: h.count === 0 ? T.surface : h.pnl >= 0
                    ? `rgba(34,197,94,${0.15 + intensity * 0.85})`
                    : `rgba(239,68,68,${0.15 + intensity * 0.85})`,
                  border: `1px solid ${T.border}`,
                }} />
                <div style={{ fontSize: 8, color: T.muted, transform: 'rotate(-45deg)', transformOrigin: 'center', marginTop: 6 }}>{i}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: T.muted, textAlign: 'center', marginTop: 20 }}>Hour of day (local time)</div>
      </Card>

      <Card>
        <SectionHead title="Risk % Breakdown" sub="Performance by real or estimated risk per trade" />
        {riskBuckets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: T.muted, fontSize: 12 }}>
            No usable risk data was found for the loaded trades.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Risk Range', 'Trades', 'Net P&L', 'Avg Risk', 'Win Rate'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: T.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riskBuckets.map((r, i) => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? 'transparent' : `${T.surface}44` }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: T.accent }}>{r.label}</td>
                  <td style={{ padding: '9px 12px', color: T.textMid }}>{r.count}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: colorPnL(r.netPnl), fontFamily: 'JetBrains Mono,monospace' }}>{r.netPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(r.netPnl))}</td>
                  <td style={{ padding: '9px 12px', color: T.textMid, fontFamily: 'JetBrains Mono,monospace' }}>{fmt(r.avgRisk, 2)}%</td>
                  <td style={{ padding: '9px 12px', color: r.winRate >= 50 ? T.green : T.red }}>{fmt(r.winRate, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 10, fontSize: 10, color: T.muted }}>
          Uses saved <span style={{ color: T.accent, fontFamily: 'JetBrains Mono,monospace' }}>riskPercent</span> when present, otherwise estimates risk from margin used versus account equity.
        </div>
      </Card>
    </div>
  )
}
