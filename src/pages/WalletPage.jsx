import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import {
  fmt, fmtDate, fmtTime, localDateKey, loadCashFlow, saveCashFlow,
  normalizeCashFlow, buildCapitalByMonth, buildRollingCashFlowInsights, monthKeyFromTs,
} from '../lib/data'
import { Card, SectionHead, KpiCard, Badge, Btn, Input, ChartTooltip, Select } from '../components/UI'
import { fetchLiveAccount, loadKeys } from '../hooks/useTrades'
import { fetchCapitalFlow, upsertCapitalFlow, deleteCapitalFlow, supabase } from '../lib/supabase'

const RANGE_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

function useLiveData(savedKeys) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)

  const refresh = useCallback(async () => {
    const keys = savedKeys?.k && savedKeys?.s ? savedKeys : loadKeys()
    if (!keys?.k || !keys?.s) {
      setAccount(null)
      setError('No Binance keys found for live account. Connect Binance in Settings once and this tab will reuse them.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await fetchLiveAccount(keys.k, keys.s)
      setAccount(data)
      setLastRefresh(Date.now())
    } catch (e) {
      setAccount(null)
      setError(e.message || 'Could not load live account.')
    }
    setLoading(false)
  }, [savedKeys])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const interval = account?.positions?.length ? 7000 : 30000
    const timer = setInterval(refresh, interval)
    return () => clearInterval(timer)
  }, [refresh, account?.positions?.length])

  return { account, loading, error, lastRefresh, refresh }
}

function formatSignedUsd(value) {
  return `${value >= 0 ? '+$' : '-$'}${fmt(Math.abs(value))}`
}

function formatFlowAmount(type, amount) {
  return `${type === 'deposit' ? '-' : '+'}$${fmt(Math.abs(amount || 0))}`
}

function getRangeCutoff(range) {
  const now = Date.now()
  const days = { week: 7, month: 30, quarter: 90, year: 365 }
  return range === 'all' ? 0 : now - (days[range] || 30) * 24 * 60 * 60 * 1000
}

function FlowStatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 13px' }}>
      <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || T.text, fontFamily: T.fontMono }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function TransactionColumn({ title, type, entries, accent, onRemove }) {
  return (
    <Card>
      <SectionHead title={title} sub={`${entries.length} records`} />
      {entries.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: T.surface, borderRadius: 8, border: `1px solid ${accent}22` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{entry.note || (type === 'deposit' ? 'Deposit' : 'Withdrawal')}</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{fmtDate(entry.time)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: accent, fontFamily: T.fontMono }}>{type === 'deposit' ? '-' : '+'}${fmt(entry.amount)}</div>
                <button onClick={() => onRemove(entry.id)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>x</button>
              </div>
            </div>
          ))}
        </div>
      ) : <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: '24px 0' }}>No {title.toLowerCase()} yet.</div>}
    </Card>
  )
}

function CashFlowPanel({ trades = [] }) {
  const [entries, setEntries] = useState([])
  const [userId, setUserId] = useState(null)
  const [range, setRange] = useState('month')
  const [form, setForm] = useState({ type: 'deposit', amount: '', date: localDateKey(Date.now()), note: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      setUserId(uid)
      if (uid) {
        fetchCapitalFlow(uid).then((rows) => {
          if (rows.length) {
            const normalized = normalizeCashFlow(rows)
            setEntries(normalized)
            saveCashFlow(normalized)
          } else {
            const local = normalizeCashFlow(loadCashFlow())
            if (local.length) {
              setEntries(local)
              local.forEach((entry) => upsertCapitalFlow(entry, uid).catch(() => {}))
            }
          }
        }).catch(() => setEntries(normalizeCashFlow(loadCashFlow())))
      } else {
        setEntries(normalizeCashFlow(loadCashFlow()))
      }
    })
  }, [])

  const add = async () => {
    if (!form.amount || +form.amount <= 0) return
    const entry = normalizeCashFlow([{ ...form, amount: +form.amount, time: new Date(`${form.date}T12:00:00`).getTime(), id: String(Date.now()) }])[0]
    const updated = normalizeCashFlow([...entries, entry])
    setEntries(updated)
    saveCashFlow(updated)
    setForm((f) => ({ ...f, amount: '', note: '' }))
    setMsg('Saved!')
    setTimeout(() => setMsg(''), 2500)
    if (userId) { try { await upsertCapitalFlow(entry, userId) } catch {} }
  }

  const remove = async (id) => {
    const updated = entries.filter((entry) => entry.id !== id)
    setEntries(updated)
    saveCashFlow(updated)
    if (userId) { try { await deleteCapitalFlow(id) } catch {} }
  }

  const deposits = useMemo(() => entries.filter((entry) => entry.type === 'deposit'), [entries])
  const withdrawals = useMemo(() => entries.filter((entry) => entry.type === 'withdraw'), [entries])
  const totalIn = deposits.reduce((sum, entry) => sum + entry.amount, 0)
  const totalOut = withdrawals.reduce((sum, entry) => sum + entry.amount, 0)
  const net = totalOut - totalIn

  const chartData = useMemo(() => {
    let cumulative = 0
    return entries.map((entry) => {
      cumulative += entry.type === 'deposit' ? -entry.amount : entry.amount
      return {
        id: entry.id,
        date: entry.date || localDateKey(entry.time),
        runningCapital: +cumulative.toFixed(2),
        flowAmount: +(entry.type === 'deposit' ? -entry.amount : entry.amount).toFixed(2),
        type: entry.type,
        note: entry.note,
      }
    })
  }, [entries])

  const monthKeys = useMemo(() => [...new Set((trades || []).map((trade) => monthKeyFromTs(trade.time)))].sort(), [trades])
  const capitalByMonth = useMemo(() => Object.values(buildCapitalByMonth(entries, monthKeys, trades)), [entries, monthKeys, trades])
  const currentMonthKey = monthKeyFromTs(Date.now())
  const currentMonthCapital = capitalByMonth.find((item) => item.key === currentMonthKey)
  const latestCapitalMonth = capitalByMonth[capitalByMonth.length - 1] || null

  const depositInsights = useMemo(() => buildRollingCashFlowInsights(entries, 'deposit'), [entries])
  const withdrawalInsights = useMemo(() => buildRollingCashFlowInsights(entries, 'withdraw'), [entries])
  const cutoff = getRangeCutoff(range)
  const rangeDeposits = deposits.filter((entry) => entry.time >= cutoff).reduce((sum, entry) => sum + entry.amount, 0)
  const rangeWithdrawals = withdrawals.filter((entry) => entry.time >= cutoff).reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <KpiCard label="Total Deposited" value={`-$${fmt(totalIn)}`} color={T.red} sub="Capital added" />
        <KpiCard label="Total Withdrawn" value={`+$${fmt(totalOut)}`} color={T.green} sub="Capital taken out" />
        <KpiCard label="Net Capital Flow" value={`${net >= 0 ? '+$' : '-$'}${fmt(Math.abs(net))}`} color={colorPnL(net)} sub="Withdrawals minus deposits" />
      </div>

      <Card glow style={{ position: 'sticky', top: 14, zIndex: 5 }}>
        <SectionHead title="Add Transaction" sub="Record deposit or withdrawal" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Type</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'deposit', l: 'Deposit', color: T.red }, { v: 'withdraw', l: 'Withdraw', color: T.green }].map((option) => (
                <button key={option.v} onClick={() => setForm((f) => ({ ...f, type: option.v }))} style={{
                  flex: 1, padding: '7px', borderRadius: 6, cursor: 'pointer', fontFamily: T.fontSans, fontSize: 12, fontWeight: form.type === option.v ? 600 : 400,
                  background: form.type === option.v ? `${option.color}18` : T.surface,
                  border: `1px solid ${form.type === option.v ? option.color : T.border}`,
                  color: form.type === option.v ? option.color : T.muted,
                }}>{option.l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Amount (USDT)</div>
            <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1000" type="number" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Date</div>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Note</div>
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Initial deposit" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn variant="accent" onClick={add} style={{ padding: '9px 24px' }}>Add Transaction</Btn>
          {msg && <span style={{ fontSize: 12, color: T.green }}>{msg}</span>}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SectionHead title="Flow Insights" sub="Deposits and withdrawals in the selected period" />
        <Select value={range} onChange={setRange} options={RANGE_OPTIONS} style={{ minWidth: 110 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card>
          <SectionHead title="Deposit Insights" sub={`${RANGE_OPTIONS.find((opt) => opt.value === range)?.label} + all-time`} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FlowStatCard label="Highest Deposit" value={`$${fmt(depositInsights.highest)}`} color={T.red} />
            <FlowStatCard label="Average Deposit" value={`$${fmt(depositInsights.average)}`} color={T.textMid} />
            <FlowStatCard label={`${RANGE_OPTIONS.find((opt) => opt.value === range)?.label} Deposits`} value={`$${fmt(rangeDeposits)}`} color={T.red} />
            <FlowStatCard label="All-Time Deposits" value={`$${fmt(depositInsights.allTime)}`} color={T.red} />
            <FlowStatCard label="Transaction Count" value={depositInsights.count} color={T.text} />
            <FlowStatCard label="Latest Deposit" value={depositInsights.latest ? `$${fmt(depositInsights.latest.amount)}` : '$0.00'} color={T.textMid} sub={depositInsights.latest ? fmtDate(depositInsights.latest.time) : 'No deposits'} />
          </div>
        </Card>

        <Card>
          <SectionHead title="Withdrawal Insights" sub={`${RANGE_OPTIONS.find((opt) => opt.value === range)?.label} + all-time`} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FlowStatCard label="Highest Withdrawal" value={`$${fmt(withdrawalInsights.highest)}`} color={T.green} />
            <FlowStatCard label="Average Withdrawal" value={`$${fmt(withdrawalInsights.average)}`} color={T.textMid} />
            <FlowStatCard label={`${RANGE_OPTIONS.find((opt) => opt.value === range)?.label} Withdrawals`} value={`$${fmt(rangeWithdrawals)}`} color={T.green} />
            <FlowStatCard label="All-Time Withdrawals" value={`$${fmt(withdrawalInsights.allTime)}`} color={T.green} />
            <FlowStatCard label="Transaction Count" value={withdrawalInsights.count} color={T.text} />
            <FlowStatCard label="Latest Withdrawal" value={withdrawalInsights.latest ? `$${fmt(withdrawalInsights.latest.amount)}` : '$0.00'} color={T.textMid} sub={withdrawalInsights.latest ? fmtDate(withdrawalInsights.latest.time) : 'No withdrawals'} />
          </div>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card glow>
          <SectionHead title="Capital Flow History" sub="Deposits now plot red, withdrawals green" />
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="capitalLineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={T.blue} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tick={{ fill: T.muted, fontSize: 10, fontFamily: T.fontMono }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmt(v, 0)}`} width={65} />
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]?.payload
                return (
                  <div style={{ background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: '10px 14px', fontFamily: T.fontMono, fontSize: 11 }}>
                    <div style={{ color: T.muted, marginBottom: 6 }}>{label}</div>
                    <div style={{ color: row?.type === 'deposit' ? T.red : T.green }}>
                      {row?.type === 'deposit' ? 'Deposit' : 'Withdrawal'}: {formatFlowAmount(row?.type, row?.flowAmount || 0)}
                    </div>
                    <div style={{ color: T.blue }}>Net flow line: {formatSignedUsd(row?.runningCapital || 0)}</div>
                    {row?.note && <div style={{ color: T.muted, marginTop: 4 }}>{row.note}</div>}
                  </div>
                )
              }} />
              <Bar dataKey="flowAmount" name="Flow" barSize={18} radius={[4, 4, 0, 0]}>
                {chartData.map((row) => <Cell key={row.id} fill={row.type === 'deposit' ? T.red : T.green} />)}
              </Bar>
              <Area type="monotone" dataKey="runningCapital" stroke={T.blue} fill="url(#capitalLineFill)" strokeWidth={2} dot={false} isAnimationActive animationDuration={850} />
              <Line type="monotone" dataKey="runningCapital" stroke={T.cyan} strokeWidth={2} dot={{ r: 2, fill: T.cyan }} activeDot={{ r: 5 }} isAnimationActive animationDuration={850} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card glow>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <SectionHead title="Capital Engine" sub="Monthly starting capital now includes deposits, profit, and withdrawals" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
          <FlowStatCard label="Current Month Start" value={`$${fmt(currentMonthCapital?.startCapital || latestCapitalMonth?.startCapital || 0)}`} color={T.blue} sub="Opening capital" />
          <FlowStatCard label="Current Month End" value={`$${fmt(currentMonthCapital?.endCapital || latestCapitalMonth?.endCapital || 0)}`} color={T.accent} sub="After profit and flows" />
          <FlowStatCard label="Next Month Start" value={`$${fmt(currentMonthCapital?.endCapital || latestCapitalMonth?.endCapital || 0)}`} color={T.cyan} sub="Rolls forward automatically" />
          <FlowStatCard label={`${RANGE_OPTIONS.find((opt) => opt.value === range)?.label} Net Flow`} value={formatSignedUsd(rangeDeposits - rangeWithdrawals)} color={colorPnL(rangeDeposits - rangeWithdrawals)} sub={`Deposits ${fmt(rangeDeposits)} / Withdrawals ${fmt(rangeWithdrawals)}`} />
        </div>

        {capitalByMonth.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Month', 'Start', 'Deposits', 'Net Profit', 'Withdrawals', 'End'].map((header) => (
                    <th key={header} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.muted, letterSpacing: 1.1, textTransform: 'uppercase' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capitalByMonth.slice(-8).map((row, index) => (
                  <tr key={row.key} style={{ borderBottom: `1px solid ${T.border}`, background: index % 2 ? `${T.surface}55` : 'transparent' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: T.text }}>{row.label}</td>
                    <td style={{ padding: '10px', color: T.blue, fontFamily: T.fontMono }}>${fmt(row.startCapital)}</td>
                    <td style={{ padding: '10px', color: T.red, fontFamily: T.fontMono }}>-${fmt(row.deposits)}</td>
                    <td style={{ padding: '10px', color: colorPnL(row.netProfit), fontFamily: T.fontMono }}>{formatSignedUsd(row.netProfit)}</td>
                    <td style={{ padding: '10px', color: T.green, fontFamily: T.fontMono }}>+${fmt(row.withdrawals)}</td>
                    <td style={{ padding: '10px', color: T.accent, fontWeight: 700, fontFamily: T.fontMono }}>${fmt(row.endCapital)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Add deposits or withdrawals to start tracking monthly capital progression.</div>}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <TransactionColumn title="Deposits" type="deposit" entries={[...deposits].sort((a, b) => b.time - a.time)} accent={T.red} onRemove={remove} />
        <TransactionColumn title="Withdrawals" type="withdraw" entries={[...withdrawals].sort((a, b) => b.time - a.time)} accent={T.green} onRemove={remove} />
      </div>

    </div>
  )
}

function LiveAccountPanel({ account, loading, error, lastRefresh, refresh }) {
  if (error) {
    return (
      <Card glow>
        <div style={{ textAlign: 'center', padding: '36px 0' }}>
          <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.45 }}>O</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Live Account Unavailable</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16, lineHeight: 1.7 }}>{error}</div>
          <Btn onClick={refresh}>Retry</Btn>
        </div>
      </Card>
    )
  }

  if (loading && !account) {
    return (
      <Card glow style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 12, color: T.muted }}>Loading live account data...</div>
      </Card>
    )
  }

  if (!account) return null

  const hasLiveTrades = account.positions.length > 0

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <KpiCard label="Wallet Balance" value={`$${fmt(account.totalWalletBalance)}`} color={T.accent} sub="Total USDT" />
        <KpiCard label="Available Balance" value={`$${fmt(account.availableBalance)}`} color={T.blue} sub="Free to trade" />
        <KpiCard label="Running PnL" value={`${account.totalUnrealizedProfit >= 0 ? '+$' : '-$'}${fmt(Math.abs(account.totalUnrealizedProfit))}`} color={colorPnL(account.totalUnrealizedProfit)} sub="Unrealized" />
        <KpiCard label="Margin Balance" value={`$${fmt(account.totalMarginBalance)}`} color={T.textMid} sub="Including unrealized" />
      </div>

      <Card glow style={{ overflow: 'hidden' }}>
        {hasLiveTrades && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(120deg, rgba(6,182,212,0.06), transparent 35%, rgba(226,184,74,0.05) 70%, transparent)',
            animation: 'walletSweep 3.2s linear infinite',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'relative', zIndex: 1 }}>
          <SectionHead title="Open Positions" sub={`${account.positions.length} active`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasLiveTrades && <div className="live-pill">LIVE</div>}
            {lastRefresh && <div style={{ fontSize: 10, color: T.muted }}>Updated {fmtTime(lastRefresh)}</div>}
            <Btn onClick={refresh} disabled={loading} style={{ fontSize: 11, padding: '4px 12px' }}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Btn>
          </div>
        </div>

        {account.positions.length > 0 ? (
          <div style={{ overflowX: 'auto', position: 'relative', zIndex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  {['Symbol', 'Side', 'Size', 'Entry Price', 'Leverage', 'Unrealized PnL', 'Margin'].map((header) => (
                    <th key={header} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {account.positions.map((position, i) => (
                  <tr key={position.symbol} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? 'transparent' : `${T.surface}66` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{position.symbol.replace('USDT', '')}<span style={{ color: T.muted, fontSize: 10 }}>/USDT</span></td>
                    <td style={{ padding: '10px 12px' }}><Badge text={position.side} color={position.side === 'LONG' ? T.green : T.red} /></td>
                    <td style={{ padding: '10px 12px', fontFamily: T.fontMono }}>{Math.abs(position.size)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: T.fontMono }}>${fmt(position.entryPrice)}</td>
                    <td style={{ padding: '10px 12px', color: position.leverage >= 20 ? T.red : position.leverage >= 10 ? T.accent : T.textMid, fontWeight: 600 }}>{position.leverage}x</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: colorPnL(position.unrealizedPnl), fontFamily: T.fontMono }}>{position.unrealizedPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(position.unrealizedPnl))}</td>
                    <td style={{ padding: '10px 12px', color: T.muted, fontFamily: T.fontMono }}>${fmt(position.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: T.muted, fontSize: 12 }}>No open positions</div>
        )}
      </Card>
    </div>
  )
}

export default function WalletPage({ savedKeys, source, trades }) {
  const [tab, setTab] = useState('live')
  const { account, loading, error, lastRefresh, refresh } = useLiveData(savedKeys)

  return (
    <div className="page-enter" style={{ padding: '24px 28px', fontFamily: T.fontSans }}>
      <style>{`
        @keyframes walletSweep {
          0% { transform: translateX(-35%); opacity: 0.3; }
          50% { opacity: 0.85; }
          100% { transform: translateX(35%); opacity: 0.3; }
        }
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(6,182,212,0.35); opacity: 0.78; }
          70% { box-shadow: 0 0 0 10px rgba(6,182,212,0); opacity: 1; }
          100% { box-shadow: 0 0 0 0 rgba(6,182,212,0); opacity: 0.78; }
        }
        .live-pill {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          letter-spacing: 1.4px;
          font-weight: 700;
          color: ${T.cyan};
          background: ${T.cyanDim};
          border: 1px solid ${T.cyan}55;
          animation: livePulse 1.8s infinite;
        }
      `}</style>

      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>Account</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Wallet & Capital</div>
      </div>

      <div style={{ display: 'flex', gap: 3, background: T.surface, borderRadius: 8, padding: 3, border: `1px solid ${T.border}`, marginBottom: 20, width: 'fit-content' }}>
        {[{ id: 'live', l: 'Live Account' }, { id: 'flow', l: 'Capital Flow' }].map((tabOption) => (
          <button key={tabOption.id} onClick={() => setTab(tabOption.id)} style={{
            padding: '6px 18px',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: T.fontSans,
            fontSize: 12,
            fontWeight: tab === tabOption.id ? 600 : 400,
            background: tab === tabOption.id ? T.card : 'transparent',
            color: tab === tabOption.id ? T.text : T.muted,
            border: tab === tabOption.id ? `1px solid ${T.border}` : '1px solid transparent',
          }}>{tabOption.l}</button>
        ))}
      </div>

      {tab === 'live'
        ? <LiveAccountPanel account={account} loading={loading} error={error} lastRefresh={lastRefresh} refresh={refresh} />
        : <CashFlowPanel trades={trades} />
      }
    </div>
  )
}
