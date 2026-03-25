import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtTime, localDateKey, monthKeyFromTs, monthLabelFromKey } from '../lib/data'
import { Card, SectionHead, Badge, Btn, ChartTooltip } from '../components/UI'

const MOODS = ['Sharp', 'Okay', 'Anxious', 'FOMO', 'Disciplined', 'Tired', 'Revenge']
const LESSONS = ['Followed plan', 'Overtraded', 'Chased entries', 'Cut winners too early', 'Let losers run', 'Good risk management', 'Poor position sizing', 'Emotional trading']
const DEFAULT_DAY_GOALS = { targetPnL: 200, maxLoss: 100, maxTrades: 10, minWinRate: 50 }
const DEFAULT_FORM = { mood: '', lessons: [], notes: '', rating: 0, followedPlan: null, confidence: 5, focus: 5, sleepQuality: 5, stress: 5, marketClarity: 5, ruleBreaks: 0 }
const DAY_GOALS_KEY = 'tlx_day_goals'
const DAY_GOALS_HISTORY_KEY = 'tlx_day_goals_history'
const CALENDAR_NOTES_KEY = 'tl_cal_notes'

function formatSigned(value) {
  return `${value >= 0 ? '+$' : '-$'}${fmt(Math.abs(value))}`
}

function loadDayGoalHistory() {
  try { return JSON.parse(localStorage.getItem(DAY_GOALS_HISTORY_KEY) || '{}') } catch { return {} }
}

function DayGoalsTracker({ date, dayTrades, dayPnL }) {
  const [goals, setGoals] = useState(() => {
    try { return { ...DEFAULT_DAY_GOALS, ...JSON.parse(localStorage.getItem(DAY_GOALS_KEY) || '{}') } } catch { return DEFAULT_DAY_GOALS }
  })
  const [history, setHistory] = useState(loadDayGoalHistory)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...DEFAULT_DAY_GOALS, ...goals })

  const monthKey = monthKeyFromTs(new Date(`${date}T12:00:00`).getTime())
  const activeGoals = history[date] || history[monthKey] || goals

  useEffect(() => {
    setForm({ ...DEFAULT_DAY_GOALS, ...activeGoals })
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const saved = { ...DEFAULT_DAY_GOALS, ...form }
    const nextHistory = { ...history, [monthKey]: saved, [date]: saved }
    localStorage.setItem(DAY_GOALS_KEY, JSON.stringify(saved))
    localStorage.setItem(DAY_GOALS_HISTORY_KEY, JSON.stringify(nextHistory))
    setGoals(saved)
    setHistory(nextHistory)
    setEditing(false)
  }

  const countedTrades = dayTrades.filter((trade) => Math.abs(trade.pnl || 0) > 0.000001)
  const dayWins = countedTrades.filter((trade) => trade.pnl > 0).length
  const winRate = countedTrades.length ? dayWins / countedTrades.length * 100 : 0
  const items = [
    { label: 'Daily P&L Target', current: dayPnL, target: activeGoals.targetPnL, good: dayPnL >= activeGoals.targetPnL, fmt: (value) => `${value >= 0 ? '+$' : '-$'}${fmt(Math.abs(value))}` },
    { label: 'Max Loss Limit', current: Math.abs(Math.min(0, dayPnL)), target: activeGoals.maxLoss, good: dayPnL >= -activeGoals.maxLoss, invert: true, fmt: (value) => `$${fmt(value)}` },
    { label: 'Max Trades', current: countedTrades.length, target: activeGoals.maxTrades, good: countedTrades.length <= activeGoals.maxTrades, invert: true, fmt: (value) => `${value} trades` },
    { label: 'Win Rate Goal', current: winRate, target: activeGoals.minWinRate, good: winRate >= activeGoals.minWinRate, fmt: (value) => `${fmt(value)}%` },
  ]

  return (
    <Card glow>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SectionHead title="Daily Goals Tracker" sub={`Goals saved for ${monthLabelFromKey(monthKey)}`} />
        <button onClick={() => setEditing((value) => !value)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: T.fontSans, fontSize: 11, color: T.muted }}>{editing ? 'Cancel' : 'Edit Goals'}</button>
      </div>
      {editing ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {['targetPnL', 'maxLoss', 'maxTrades', 'minWinRate'].map((key) => <input key={key} type="number" value={form[key]} onChange={(event) => setForm((prev) => ({ ...prev, [key]: +event.target.value }))} style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 10px', color: T.text, fontFamily: T.fontMono, fontSize: 13, outline: 'none' }} />)}
          </div>
          <button onClick={save} style={{ background: T.accent, color: '#000', border: 'none', borderRadius: 7, padding: '8px 20px', cursor: 'pointer', fontFamily: T.fontSans, fontWeight: 600, fontSize: 12 }}>Save Goals</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const pct = item.invert ? Math.max(0, Math.min(100, (1 - item.current / Math.max(1, item.target)) * 100)) : Math.max(0, Math.min(100, item.current / Math.max(1, item.target) * 100))
            const color = item.good ? T.green : pct > 60 ? T.accent : T.red
            return <div key={item.label}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>{item.label}</span><span style={{ fontSize: 12, fontFamily: T.fontMono }}><span style={{ color, fontWeight: 700 }}>{item.fmt(item.current)}</span><span style={{ color: T.muted }}> / {item.fmt(item.target)}</span></span></div><div style={{ height: 6, background: T.surface, borderRadius: 3, overflow: 'hidden', border: `1px solid ${T.border}` }}><div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} /></div></div>
          })}
        </div>
      )}
    </Card>
  )
}

function useEOD() {
  const [entries, setEntries] = useState(() => { try { return JSON.parse(localStorage.getItem('tl_eod') || '[]') } catch { return [] } })
  const save = (entry) => {
    const updated = [entry, ...entries.filter((item) => item.date !== entry.date)]
    localStorage.setItem('tl_eod', JSON.stringify(updated))
    try {
      const raw = JSON.parse(localStorage.getItem(CALENDAR_NOTES_KEY) || '{}')
      localStorage.setItem(CALENDAR_NOTES_KEY, JSON.stringify({ ...raw, [entry.date]: { text: entry.notes || '', mood: entry.mood || '', updatedAt: entry.savedAt || Date.now(), source: 'eod' } }))
    } catch {}
    setEntries(updated)
  }
  return { entries, save }
}

export default function EODPage({ trades }) {
  const today = localDateKey(Date.now())
  const { entries, save } = useEOD()
  const [date, setDate] = useState(today)
  const [form, setForm] = useState(() => {
    try { return { ...DEFAULT_FORM, ...(JSON.parse(localStorage.getItem('tl_eod') || '[]').find((entry) => entry.date === today) || {}) } } catch { return DEFAULT_FORM }
  })
  const [saved, setSaved] = useState(false)

  const dayTrades = useMemo(() => trades.filter((trade) => localDateKey(trade.time) === date), [trades, date])
  const trackedTrades = useMemo(() => dayTrades.filter((trade) => Math.abs(trade.pnl || 0) > 0.000001), [dayTrades])
  const dayPnL = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const dayFees = dayTrades.reduce((sum, trade) => sum + trade.fee, 0)
  const dayWins = trackedTrades.filter((trade) => trade.pnl > 0).length

  const hourly = useMemo(() => {
    const map = Array.from({ length: 24 }, (_, hour) => ({ hour, netPnl: 0, grossPnl: 0 }))
    trackedTrades.forEach((trade) => {
      const hour = new Date(trade.time).getHours()
      map[hour].netPnl += (trade.pnl || 0) - (trade.fee || 0)
      map[hour].grossPnl += trade.pnl || 0
    })
    return map
  }, [trackedTrades])

  const toggleLesson = (lesson) => setForm((prev) => ({ ...prev, lessons: prev.lessons.includes(lesson) ? prev.lessons.filter((item) => item !== lesson) : [...prev.lessons, lesson] }))
  const handleSave = () => {
    save({ ...DEFAULT_FORM, ...form, date, savedAt: Date.now() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: T.fontSans }}>
      <style>{`
        .theme-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;background:linear-gradient(90deg, rgba(6,182,212,0.22), rgba(226,184,74,0.32));border:1px solid ${T.border};outline:none}
        .theme-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg, ${T.accent}, ${T.cyan});border:2px solid ${T.card};box-shadow:0 0 0 3px rgba(226,184,74,0.12);cursor:pointer}
        .theme-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg, ${T.accent}, ${T.cyan});border:2px solid ${T.card};box-shadow:0 0 0 3px rgba(226,184,74,0.12);cursor:pointer}
      `}</style>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>End of Day</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5 }}>Daily Summary</div>
          </div>
          <input type="date" value={date} onChange={(event) => {
            setDate(event.target.value)
            const found = entries.find((entry) => entry.date === event.target.value)
            setForm({ ...DEFAULT_FORM, ...(found || {}) })
          }} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 12px', color: T.text, fontFamily: T.fontSans, fontSize: 12, outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Day P&L', value: `${dayPnL >= 0 ? '+$' : '-$'}${fmt(Math.abs(dayPnL))}`, color: colorPnL(dayPnL) },
              { label: 'Trades', value: trackedTrades.length, color: T.text },
              { label: 'Win Rate', value: trackedTrades.length ? `${fmt(dayWins / trackedTrades.length * 100)}%` : '-', color: trackedTrades.length && dayWins / trackedTrades.length >= 0.5 ? T.green : T.red },
              { label: 'Fees Paid', value: `-$${fmt(dayFees)}`, color: T.red },
            ].map((item) => <div key={item.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: '14px 16px' }}><div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5 }}>{item.label}</div><div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: T.fontMono }}>{item.value}</div></div>)}
          </div>

          <Card style={{ marginBottom: 12 }}>
            <SectionHead title="Net P&L by Hour" sub="00:00 to 23:00 animated net curve" />
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={hourly} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                <defs><linearGradient id="hourNetGlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={T.cyan} /><stop offset="100%" stopColor={T.accent} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: T.muted, fontSize: 10 }} tickFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} tickLine={false} axisLine={{ stroke: T.border }} />
                <YAxis tick={{ fill: T.muted, fontSize: 10, fontFamily: T.fontMono }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${fmt(value, 0)}`} width={55} />
                <ReferenceLine y={0} stroke={T.border} />
                <Tooltip content={<ChartTooltip formatter={(value) => formatSigned(value)} />} />
                <Line type="monotone" dataKey="netPnl" stroke="url(#hourNetGlow)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: T.accent }} activeDot={{ r: 6, fill: T.cyan, stroke: T.card, strokeWidth: 2 }} isAnimationActive animationDuration={950} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <SectionHead title="Gross P&L by Hour" sub="Hourly bar breakdown before fees" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={hourly} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: T.muted, fontSize: 10 }} tickFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} tickLine={false} axisLine={{ stroke: T.border }} />
                <YAxis tick={{ fill: T.muted, fontSize: 10, fontFamily: T.fontMono }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${fmt(value, 0)}`} width={55} />
                <ReferenceLine y={0} stroke={T.border} />
                <Tooltip content={<ChartTooltip formatter={(value) => formatSigned(value)} />} />
                <Bar dataKey="grossPnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={700}>
                  {hourly.map((item, index) => <Cell key={index} fill={item.grossPnl >= 0 ? `${T.green}cc` : `${T.red}cc`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionHead title="Today's Trades" sub={`${trackedTrades.length} executions`} />
            {trackedTrades.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {trackedTrades.map((trade) => <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.surface, borderRadius: 7, border: `1px solid ${colorPnL(trade.pnl)}25` }}><div><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{trade.symbol.replace('USDT', '')}/USDT</span><Badge text={trade.side} color={trade.side === 'BUY' ? T.green : T.red} /><span style={{ fontSize: 10, color: T.muted }}>{trade.leverage}x</span></div><div style={{ fontSize: 10, color: T.muted }}>{fmtTime(trade.time)} · {trade.qty} @ ${fmt(trade.price)}</div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 700, color: colorPnL(trade.pnl), fontFamily: T.fontMono }}>{trade.pnl >= 0 ? '+' : ''}{fmt(trade.pnl)}</div><div style={{ fontSize: 10, color: T.red }}>-${fmt(trade.fee, 4)}</div></div></div>)}
            </div> : <div style={{ textAlign: 'center', padding: '32px 0', color: T.muted, fontSize: 12 }}>No non-zero trades on {date}</div>}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DayGoalsTracker date={date} dayTrades={dayTrades} dayPnL={dayPnL} />
          <Card glow>
            <SectionHead title="End of Day Review" sub="Daily Journal" />
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Rate Today (1-10)</div><div style={{ display: 'flex', gap: 5 }}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => setForm((prev) => ({ ...prev, rating: value }))} style={{ width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, background: form.rating === value ? (value >= 7 ? T.green : value >= 5 ? T.accent : T.red) + '33' : T.surface, border: `1px solid ${form.rating === value ? (value >= 7 ? T.green : value >= 5 ? T.accent : T.red) : T.border}`, color: form.rating === value ? (value >= 7 ? T.green : value >= 5 ? T.accent : T.red) : T.muted }}>{value}</button>)}</div></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Trading Mindset</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{MOODS.map((mood) => <button key={mood} onClick={() => setForm((prev) => ({ ...prev, mood: prev.mood === mood ? '' : mood }))} style={{ background: form.mood === mood ? T.accentDim : T.surface, border: `1px solid ${form.mood === mood ? T.accent : T.border}`, color: form.mood === mood ? T.accent : T.muted, borderRadius: 5, padding: '4px 9px', fontSize: 10, cursor: 'pointer', fontFamily: T.fontSans }}>{mood}</button>)}</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>{[['confidence', 'Confidence'], ['focus', 'Focus'], ['sleepQuality', 'Sleep Quality'], ['stress', 'Stress'], ['marketClarity', 'Market Clarity'], ['ruleBreaks', 'Rule Breaks']].map(([key, label]) => <div key={key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 13px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span><span style={{ fontSize: 11, color: key === 'ruleBreaks' ? T.red : T.accent, fontFamily: T.fontMono }}>{form[key]}/10</span></div><input className="theme-slider" type="range" min="0" max="10" value={form[key]} onChange={(event) => setForm((prev) => ({ ...prev, [key]: +event.target.value }))} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.muted, marginTop: 6 }}><span>Low</span><span>High</span></div></div>)}</div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Followed Your Plan?</div><div style={{ display: 'flex', gap: 8 }}>{[{ value: true, label: 'Yes' }, { value: false, label: 'No' }, { value: 'partial', label: 'Partially' }].map((option) => <button key={option.label} onClick={() => setForm((prev) => ({ ...prev, followedPlan: option.value }))} style={{ flex: 1, padding: '7px', borderRadius: 6, cursor: 'pointer', fontFamily: T.fontSans, fontSize: 12, fontWeight: 500, background: form.followedPlan === option.value ? (option.value === true ? T.greenDim : option.value === false ? T.redDim : T.accentDim) : T.surface, border: `1px solid ${form.followedPlan === option.value ? (option.value === true ? T.green : option.value === false ? T.red : T.accent) : T.border}`, color: form.followedPlan === option.value ? (option.value === true ? T.green : option.value === false ? T.red : T.accent) : T.muted }}>{option.label}</button>)}</div></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>What Happened?</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{LESSONS.map((lesson) => <button key={lesson} onClick={() => toggleLesson(lesson)} style={{ background: form.lessons.includes(lesson) ? T.purpleDim : T.surface, border: `1px solid ${form.lessons.includes(lesson) ? T.purple : T.border}`, color: form.lessons.includes(lesson) ? T.purple : T.muted, borderRadius: 5, padding: '4px 9px', fontSize: 10, cursor: 'pointer', fontFamily: T.fontSans }}>{lesson}</button>)}</div></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Notes & Reflections</div><textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={5} style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '10px', color: T.text, fontFamily: T.fontSans, fontSize: 12, resize: 'vertical', outline: 'none', lineHeight: 1.7 }} /></div>
            <Btn variant="accent" onClick={handleSave} style={{ width: '100%', padding: '10px', fontSize: 13 }}>{saved ? 'Saved!' : 'Save Daily Review'}</Btn>
          </Card>

          {!!entries.length && <Card><SectionHead title="Past Reviews" sub="History" /><div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 300, overflowY: 'auto' }}>{entries.slice(0, 10).map((entry) => <button key={entry.date} onClick={() => { setDate(entry.date); setForm({ ...DEFAULT_FORM, ...entry }) }} style={{ background: date === entry.date ? T.accentDim : T.surface, border: `1px solid ${date === entry.date ? T.accent : T.border}`, borderRadius: 7, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: T.fontSans }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{entry.date}</span><span style={{ fontSize: 11, color: T.muted }}>{entry.mood}</span></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{entry.rating > 0 && <span style={{ fontSize: 10, color: entry.rating >= 7 ? T.green : entry.rating >= 5 ? T.accent : T.red }}>{entry.rating}/10</span>}{entry.followedPlan === true && <span style={{ fontSize: 10, color: T.green }}>Followed plan</span>}{entry.followedPlan === false && <span style={{ fontSize: 10, color: T.red }}>Off plan</span>}{!!entry.ruleBreaks && <span style={{ fontSize: 10, color: T.red }}>{entry.ruleBreaks} rule breaks</span>}</div></button>)}</div></Card>}
        </div>
      </div>
    </div>
  )
}
