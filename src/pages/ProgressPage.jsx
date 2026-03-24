import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ComposedChart, Line, Legend
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, buildCapitalByMonth, loadCashFlow, monthKeyFromTs, monthLabelFromKey } from '../lib/data'
import { Card, SectionHead, KpiCard, Select } from '../components/UI'

const DEFAULT_GOALS = {
  monthlyTarget: 500,
  winRateTarget: 55,
  maxDDTarget: 15,
  rrTarget: 1.5,
  tradesPerMonth: 30,
}

const GOALS_KEY = 'tlx_goals'
const GOAL_HISTORY_KEY = 'tlx_goal_history'

function GoalBar({ label, current, target, unit = '$', invert = false }) {
  const pct = target > 0 ? Math.min(100, Math.abs(current) / Math.abs(target) * 100) : 0
  const good = invert ? current <= target : current >= target
  const color = good ? T.green : pct > 60 ? T.accent : T.red
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: T.fontMono }}>
          <span style={{ color, fontWeight: 700 }}>{unit === '$' ? '$' : ''}{fmt(current, 2)}{unit !== '$' ? unit : ''}</span>
          <span style={{ color: T.muted }}> / {unit === '$' ? '$' : ''}{fmt(target)}{unit !== '$' ? unit : ''}</span>
        </span>
      </div>
      <div style={{ height: 6, background: T.surface, borderRadius: 3, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 9, color: good ? T.green : T.muted, textAlign: 'right', marginTop: 3 }}>
        {good ? 'Target met' : `${fmt(pct, 0)}% of target`}
      </div>
    </div>
  )
}

function loadGoalHistory() {
  try { return JSON.parse(localStorage.getItem(GOAL_HISTORY_KEY) || '{}') } catch { return {} }
}

export default function ProgressPage({ trades, stats }) {
  const [goals, setGoals] = useState(() => {
    try { return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem(GOALS_KEY) || '{}') } } catch { return DEFAULT_GOALS }
  })
  const [goalHistory, setGoalHistory] = useState(loadGoalHistory)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...DEFAULT_GOALS, ...goals })
  const [capitalFlowEntries, setCapitalFlowEntries] = useState(() => loadCashFlow())

  const monthlyArr = stats.monthlyArr || []
  const monthOptions = monthlyArr.map((m) => ({ value: m.monthKey, label: m.monthLabel || m.label }))
  const latestMonthKey = monthOptions[monthOptions.length - 1]?.value || monthKeyFromTs(Date.now())
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    if (latestMonthKey) setSelectedMonthKey((current) => current || latestMonthKey)
  }, [latestMonthKey])

  useEffect(() => {
    try {
      import('../lib/supabase').then(({ supabase, fetchCapitalFlow }) => {
        supabase.auth.getUser().then(async ({ data }) => {
          const meta = data?.user?.user_metadata
          if (meta?.tlx_goals) {
            const remoteGoals = { ...DEFAULT_GOALS, ...meta.tlx_goals }
            setGoals(remoteGoals)
            setForm(remoteGoals)
            localStorage.setItem(GOALS_KEY, JSON.stringify(remoteGoals))
          }
          if (meta?.tlx_goal_history) {
            setGoalHistory(meta.tlx_goal_history)
            localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(meta.tlx_goal_history))
          }

          const uid = data?.user?.id
          if (uid) {
            const remoteFlow = await fetchCapitalFlow(uid).catch(() => [])
            if (remoteFlow?.length) {
              const normalized = remoteFlow.map((row) => ({ ...row, amount: +row.amount }))
              setCapitalFlowEntries(normalized)
              localStorage.setItem('tl_cashflow', JSON.stringify(normalized))
            }
          }
        })
      }).catch(() => {})
    } catch {}
  }, [])

  const saveGoals = () => {
    const saved = { ...DEFAULT_GOALS, ...form }
    const activeMonthKey = monthKeyFromTs(Date.now())
    const nextHistory = { ...goalHistory, [activeMonthKey]: saved }
    localStorage.setItem(GOALS_KEY, JSON.stringify(saved))
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(nextHistory))
    setGoals(saved)
    setGoalHistory(nextHistory)
    setEditing(false)
    try {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.auth.updateUser({ data: { tlx_goals: saved, tlx_goal_history: nextHistory } }).catch(() => {})
      }).catch(() => {})
    } catch {}
  }

  const capitalMap = useMemo(() => buildCapitalByMonth(capitalFlowEntries, monthlyArr.map((m) => m.monthKey)), [capitalFlowEntries, monthlyArr])

  const monthlyChartData = useMemo(() => monthlyArr.map((m) => {
    const monthGoals = goalHistory[m.monthKey] || (m.monthKey === latestMonthKey ? goals : DEFAULT_GOALS)
    const capital = capitalMap[m.monthKey] || { averageCapital: 0, deposits: 0, withdrawals: 0, endCapital: 0, startCapital: 0 }
    const returnPct = capital.averageCapital > 0 ? (m.netPnl / capital.averageCapital) * 100 : 0
    return {
      ...m,
      label: m.monthLabel || m.label,
      target: monthGoals.monthlyTarget,
      tradesTarget: monthGoals.tradesPerMonth,
      winRateTarget: monthGoals.winRateTarget,
      rrTarget: monthGoals.rrTarget,
      maxDDTarget: monthGoals.maxDDTarget,
      averageCapital: capital.averageCapital,
      deposits: capital.deposits,
      withdrawals: capital.withdrawals,
      endCapital: capital.endCapital,
      startCapital: capital.startCapital,
      returnPct,
      met: (m.netPnl || 0) >= monthGoals.monthlyTarget,
    }
  }), [monthlyArr, goalHistory, latestMonthKey, goals, capitalMap])

  const selectedMonth = monthlyChartData.find((m) => m.monthKey === selectedMonthKey) || monthlyChartData[monthlyChartData.length - 1]
  const selectedGoals = selectedMonth ? {
    monthlyTarget: selectedMonth.target,
    tradesPerMonth: selectedMonth.tradesTarget,
    winRateTarget: selectedMonth.winRateTarget,
    rrTarget: selectedMonth.rrTarget,
    maxDDTarget: selectedMonth.maxDDTarget,
  } : goals

  const selectedMonthTrades = useMemo(() => {
    if (!selectedMonthKey) return []
    return trades.filter((trade) => monthKeyFromTs(trade.time) === selectedMonthKey)
  }, [trades, selectedMonthKey])

  const selectedWinRate = selectedMonth?.wr || 0
  const selectedRR = selectedMonthTrades.length
    ? (() => {
        const winners = selectedMonthTrades.filter((t) => t.pnl > 0)
        const losers = selectedMonthTrades.filter((t) => t.pnl < 0)
        const avgWin = winners.length ? winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length : 0
        const avgLoss = losers.length ? Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0) / losers.length) : 0
        return avgLoss ? avgWin / avgLoss : 0
      })()
    : 0
  const selectedMaxDD = selectedMonthTrades.length
    ? (() => {
        let peak = 0
        let run = 0
        let dd = 0
        selectedMonthTrades.forEach((trade) => {
          run += trade.pnl
          if (run > peak) peak = run
          const next = peak > 0 ? (peak - run) / peak * 100 : 0
          if (next > dd) dd = next
        })
        return dd
      })()
    : 0

  const score = Math.round(
    Math.min(25, selectedWinRate / Math.max(1, selectedGoals.winRateTarget) * 25) +
    Math.min(25, selectedRR / Math.max(0.1, selectedGoals.rrTarget) * 25) +
    Math.min(25, (selectedMonth?.netPnl || 0) > 0 ? Math.min(1, (selectedMonth?.netPnl || 0) / Math.max(1, selectedGoals.monthlyTarget)) * 25 : 0) +
    Math.max(0, 25 - selectedMaxDD / Math.max(1, selectedGoals.maxDDTarget) * 25)
  )
  const scoreColor = score >= 75 ? T.green : score >= 50 ? T.accent : T.red

  const yearOptions = [...new Set(monthlyChartData.map((m) => String(m.year)))].map((year) => ({ value: year, label: year }))
  const filteredByYear = monthlyChartData.filter((m) => String(m.year) === selectedYear)

  useEffect(() => {
    if (yearOptions.length && !yearOptions.find((y) => y.value === selectedYear)) {
      setSelectedYear(yearOptions[yearOptions.length - 1].value)
    }
  }, [yearOptions, selectedYear])

  const totalCapital = capitalMap[monthlyChartData[monthlyChartData.length - 1]?.monthKey || '']?.endCapital || 0
  const totalReturn = totalCapital > 0 ? (stats.netPnL / totalCapital) * 100 : 0

  if (!trades?.length) return <div style={{ padding: 32, color: T.muted }}>No trade data.</div>

  return (
    <div className="page-enter" style={{ padding: '24px 28px', fontFamily: 'Inter,-apple-system,sans-serif' }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>Progress Tracker</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Goals & Progress</div>
          </div>
          <button onClick={() => setEditing((e) => !e)} style={{ background: editing ? T.accentDim : T.surface, border: `1px solid ${editing ? T.accent : T.border}`, color: editing ? T.accent : T.textMid, borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {editing ? 'Cancel' : 'Edit Goals'}
          </button>
        </div>
      </div>

      {editing && (
        <Card style={{ marginBottom: 16 }} glow>
          <SectionHead title="Set Current Month Goals" sub={`Snapshot saved for ${monthLabelFromKey(monthKeyFromTs(Date.now()))}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { key: 'monthlyTarget', label: 'Monthly P&L Target ($)' },
              { key: 'winRateTarget', label: 'Win Rate Goal (%)' },
              { key: 'maxDDTarget', label: 'Max Drawdown Limit (%)' },
              { key: 'rrTarget', label: 'Min Risk/Reward' },
              { key: 'tradesPerMonth', label: 'Trades per Month' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <input type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: +e.target.value }))}
                  style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 11px', color: T.text, fontFamily: 'JetBrains Mono,monospace', fontSize: 13, outline: 'none' }} />
              </div>
            ))}
          </div>
          <button onClick={saveGoals} style={{ background: T.accent, color: '#000', border: 'none', borderRadius: 7, padding: '9px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Save Goals</button>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, marginBottom: 14 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Score</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: scoreColor, fontFamily: 'JetBrains Mono,monospace', lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>for {selectedMonth?.label || 'selected month'}</div>
          <div style={{ marginTop: 10, width: '100%', height: 5, background: T.surface, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg,${T.red},${T.accent},${T.green})`, borderRadius: 3 }} />
          </div>
        </Card>

        <Card>
          <SectionHead
            title={`${selectedMonth?.label || 'Month'} Performance`}
            sub="Choose any previous month"
            action={<Select value={selectedMonthKey} onChange={setSelectedMonthKey} options={monthOptions} style={{ fontSize: 11 }} />}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { l: 'Gross P&L', v: `${selectedMonth?.pnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(selectedMonth?.pnl || 0), 2)}`, c: colorPnL(selectedMonth?.pnl || 0) },
              { l: 'Net P&L', v: `${selectedMonth?.netPnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(selectedMonth?.netPnl || 0), 2)}`, c: colorPnL(selectedMonth?.netPnl || 0) },
              { l: 'Trades', v: selectedMonth?.trades || 0, c: T.text },
              { l: 'Win Rate', v: `${fmt(selectedMonth?.wr || 0, 1)}%`, c: (selectedMonth?.wr || 0) >= 50 ? T.green : T.red },
              { l: 'Monthly Return', v: `${selectedMonth?.returnPct >= 0 ? '+' : ''}${fmt(selectedMonth?.returnPct || 0, 2)}%`, c: colorPnL(selectedMonth?.returnPct || 0) },
              { l: 'Avg Capital', v: `$${fmt(selectedMonth?.averageCapital || 0, 0)}`, c: T.accent },
            ].map((r) => (
              <div key={r.l} style={{ background: T.surface, borderRadius: 7, padding: '9px 11px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 8, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{r.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.c, fontFamily: 'JetBrains Mono,monospace' }}>{r.v}</div>
              </div>
            ))}
          </div>
          <GoalBar label="Monthly Net P&L" current={selectedMonth?.netPnl || 0} target={selectedGoals.monthlyTarget} />
          <GoalBar label="Win Rate" current={selectedWinRate} target={selectedGoals.winRateTarget} unit="%" />
          <GoalBar label="Risk/Reward" current={selectedRR} target={selectedGoals.rrTarget} unit="x" />
          <GoalBar label="Drawdown (lower is better)" current={selectedMaxDD} target={selectedGoals.maxDDTarget} unit="%" invert />
        </Card>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <SectionHead title="Monthly P&L vs Target" sub="Each month keeps its own saved goal" />
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData} barSize={Math.max(8, Math.min(28, 500 / monthlyChartData.length))} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tick={{ fill: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={65} />
              <ReferenceLine y={0} stroke={T.border} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: '10px 13px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
                    <div style={{ color: T.muted, marginBottom: 5, fontWeight: 600 }}>{label}</div>
                    <div style={{ color: colorPnL(d.pnl) }}>Gross: {d.pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(d.pnl), 2)}</div>
                    <div style={{ color: colorPnL(d.netPnl) }}>Net: {d.netPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(d.netPnl), 2)}</div>
                    <div style={{ color: T.accent }}>Goal: ${fmt(d.target, 0)}</div>
                    <div style={{ color: colorPnL(d.returnPct) }}>Return: {d.returnPct >= 0 ? '+' : ''}{fmt(d.returnPct, 2)}%</div>
                    <div style={{ color: T.muted }}>Trades: {d.trades} · WR: {fmt(d.wr, 1)}%</div>
                  </div>
                )
              }} />
              <Bar dataKey="netPnl" radius={[3, 3, 0, 0]}>
                {monthlyChartData.map((d, i) => <Cell key={i} fill={d.met ? T.green : d.netPnl >= 0 ? T.accent : T.red} opacity={0.9} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ color: T.muted, fontSize: 12, padding: '28px 0', textAlign: 'center' }}>No monthly data yet</div>}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <SectionHead
          title="Monthly Activity — P&L & Trades"
          sub="Combined view"
          action={<Select value={selectedYear} onChange={setSelectedYear} options={yearOptions} style={{ fontSize: 11 }} />}
        />
        {filteredByYear.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={filteredByYear} margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis yAxisId="pnl" tick={{ fill: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={65} />
              <YAxis yAxisId="trades" orientation="right" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}t`} width={32} />
              <ReferenceLine yAxisId="pnl" y={0} stroke={T.border} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: '10px 13px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
                    <div style={{ color: T.muted, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: colorPnL(d.netPnl) }}>Net: {d.netPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(d.netPnl), 2)}</div>
                    <div style={{ color: T.blue }}>Trades: {d.trades}</div>
                    <div style={{ color: colorPnL(d.returnPct) }}>Return: {d.returnPct >= 0 ? '+' : ''}{fmt(d.returnPct, 2)}%</div>
                  </div>
                )
              }} />
              <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />
              <Bar yAxisId="pnl" dataKey="netPnl" name="Net P&L ($)" radius={[3, 3, 0, 0]} opacity={0.85}>
                {filteredByYear.map((d, i) => <Cell key={i} fill={d.netPnl >= 0 ? T.green : T.red} />)}
              </Bar>
              <Line yAxisId="trades" type="monotone" dataKey="trades" name="Trades" stroke={T.blue} strokeWidth={2} dot={{ fill: T.blue, r: 3 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div style={{ color: T.muted, fontSize: 12, padding: '28px 0', textAlign: 'center' }}>No data for that year</div>}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <KpiCard label="Total Return" value={`${totalReturn >= 0 ? '+' : ''}${fmt(totalReturn, 2)}%`} color={colorPnL(totalReturn)} sub={`Net ${stats.netPnL >= 0 ? '+$' : '-$'}${fmt(Math.abs(stats.netPnL || 0), 2)} / Capital $${fmt(totalCapital, 0)}`} />
        <KpiCard label="Best Month" value={monthlyChartData.length ? `${Math.max(...monthlyChartData.map((m) => m.netPnl)) >= 0 ? '+$' : '-$'}${fmt(Math.abs(Math.max(...monthlyChartData.map((m) => m.netPnl))), 2)}` : '$0.00'} color={T.green} sub={monthlyChartData.slice().sort((a, b) => b.netPnl - a.netPnl)[0]?.label || '—'} />
        <KpiCard label="Worst Month" value={monthlyChartData.length ? `${Math.min(...monthlyChartData.map((m) => m.netPnl)) >= 0 ? '+$' : '-$'}${fmt(Math.abs(Math.min(...monthlyChartData.map((m) => m.netPnl))), 2)}` : '$0.00'} color={T.red} sub={monthlyChartData.slice().sort((a, b) => a.netPnl - b.netPnl)[0]?.label || '—'} />
        <KpiCard label="Green Months" value={`${monthlyChartData.filter((m) => m.netPnl > 0).length} / ${monthlyChartData.length}`} color={T.blue} sub="Profitable net months" />
      </div>
    </div>
  )
}
