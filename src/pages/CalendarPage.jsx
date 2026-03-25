import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtTime, localDateKey } from '../lib/data'
import { Card, SectionHead, Badge } from '../components/UI'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MOODS = ['Focused', 'Neutral', 'Anxious', 'FOMO', 'Disciplined', 'Tired', 'Revenge']

function useNotes() {
  const [notes, setNotes] = useState({})
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tl_cal_notes')
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])
  const save = (key, note) => setNotes((prev) => {
    const next = { ...prev, [key]: note }
    try { localStorage.setItem('tl_cal_notes', JSON.stringify(next)) } catch {}
    return next
  })
  const del = (key) => setNotes((prev) => {
    const next = { ...prev }
    delete next[key]
    try { localStorage.setItem('tl_cal_notes', JSON.stringify(next)) } catch {}
    return next
  })
  return { notes, save, del }
}

function useEODEntries() {
  const [entries, setEntries] = useState([])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tl_eod')
      if (saved) setEntries(JSON.parse(saved))
    } catch {}
  }, [])
  return entries
}

function countNonZeroTrades(items = []) {
  return items.filter((trade) => Math.abs(trade.pnl || 0) > 0.000001)
}

export default function CalendarPage({ trades, stats }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [noteForm, setNoteForm] = useState({ text: '', mood: '' })
  const [viewMode, setViewMode] = useState('preview')
  const { notes, save, del } = useNotes()
  const eodEntries = useEODEntries()

  const dayGoals = useMemo(() => {
    try {
      return { targetPnL: 200, maxLoss: 100, maxTrades: 10, minWinRate: 50, ...JSON.parse(localStorage.getItem('tlx_day_goals') || '{}') }
    } catch {
      return { targetPnL: 200, maxLoss: 100, maxTrades: 10, minWinRate: 50 }
    }
  }, [])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = localDateKey(Date.now())
  const monthKey = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  const monthStats = stats.monthlyArr?.find((item) => item.m === monthKey)

  const monthNotes = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const merged = { ...notes }
    eodEntries.forEach((entry) => {
      if (entry?.date && (entry.notes?.trim() || entry.mood || entry.lessons?.length)) {
        merged[entry.date] = {
          text: entry.notes || merged[entry.date]?.text || '',
          mood: entry.mood || merged[entry.date]?.mood || '',
          updatedAt: entry.savedAt || merged[entry.date]?.updatedAt || Date.now(),
          source: 'eod',
        }
      }
    })
    return Object.entries(merged)
      .filter(([key, note]) => key.startsWith(prefix) && (note?.text?.trim() || note?.mood))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [notes, eodEntries, year, month])

  const monthCellData = useMemo(() => (
    Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return [key, stats.dailyPnL?.[key] || { pnl: 0, fees: 0, trades: 0, wins: 0 }]
    })
  ), [daysInMonth, month, year, stats.dailyPnL])

  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return null
    const day = index - firstDay + 1
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { day, key, dayStats: stats.dailyPnL?.[key] || null }
  })

  const monthDays = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return Object.entries(stats.dailyPnL || {}).filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))
  }, [stats.dailyPnL, year, month])

  const maxAbs = useMemo(() => {
    if (!stats.dailyPnL) return 1
    return Math.max(1, ...Object.values(stats.dailyPnL).map((item) => Math.abs(item.pnl)))
  }, [stats.dailyPnL])

  const dayTrades = useMemo(() => selected ? trades.filter((trade) => localDateKey(trade.time) === selected) : [], [selected, trades])
  const countedTrades = useMemo(() => countNonZeroTrades(dayTrades), [dayTrades])
  const selectedEOD = useMemo(() => selected ? eodEntries.find((entry) => entry.date === selected) : null, [selected, eodEntries])
  const selectedDay = selected ? stats.dailyPnL?.[selected] : null
  const selectedNote = selected ? (monthNotes.find(([key]) => key === selected)?.[1] || notes[selected] || null) : null

  const winningDays = monthCellData.filter(([, item]) => item.trades > 0 && item.pnl > 0).length
  const losingDays = monthCellData.filter(([, item]) => item.trades > 0 && item.pnl < 0).length
  const noTradeDays = monthCellData.filter(([, item]) => !item.trades).length

  const getDayGoalsMet = (key) => {
    const dayData = stats.dailyPnL?.[key]
    if (!dayData) return null
    const tradesForDay = countNonZeroTrades(trades.filter((trade) => localDateKey(trade.time) === key))
    const winRate = tradesForDay.length ? tradesForDay.filter((trade) => trade.pnl > 0).length / tradesForDay.length * 100 : 0
    const details = [
      { label: 'P&L Target', met: dayData.pnl >= dayGoals.targetPnL },
      { label: 'Loss Limit', met: dayData.pnl >= -dayGoals.maxLoss },
      { label: 'Max Trades', met: tradesForDay.length <= dayGoals.maxTrades },
      { label: 'Win Rate', met: winRate >= dayGoals.minWinRate },
    ]
    return { met: details.filter((item) => item.met).length, total: 4, details }
  }

  const selectedGoals = selected ? getDayGoalsMet(selected) : null

  const openDay = (key) => {
    setSelected(key)
    const existing = monthNotes.find(([date]) => date === key)?.[1] || notes[key]
    setNoteForm({ text: existing?.text || '', mood: existing?.mood || '' })
    setEditing(false)
    setViewMode('preview')
  }

  const saveNote = () => {
    if (!selected) return
    if (noteForm.text.trim() || noteForm.mood) save(selected, { ...noteForm, updatedAt: Date.now() })
    else del(selected)
    setEditing(false)
    setViewMode('preview')
  }

  const prevMonth = () => {
    if (month === 0) {
      setYear((value) => value - 1)
      setMonth(11)
    } else setMonth((value) => value - 1)
  }

  const nextMonth = () => {
    if (month === 11) {
      setYear((value) => value + 1)
      setMonth(0)
    } else setMonth((value) => value + 1)
  }

  const greenShades = ['#071a0e', '#0a2614', '#0d331a', '#104021', '#144f29', '#186032', '#1d743c', '#228b47']
  const redShades = ['#1a0707', '#26090a', '#330b0b', '#410e0e', '#501111', '#601414', '#741818', '#8b1c1c']

  return (
    <div className="page-enter" style={{ padding: '24px 28px', fontFamily: T.fontSans }}>
      <style>{`.cal-cell{transition:transform .12s,box-shadow .12s}.cal-cell:hover{transform:scale(1.03);box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:2;position:relative}`}</style>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>P&L Calendar</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Trading Calendar</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{Object.keys(stats.dailyPnL || {}).length} trading days. Click any date to view trades, notes, and review data.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Card style={{ marginBottom: 12 }} glow>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <button onClick={prevMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontSize: 14 }}>←</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>{MONTHS[month]}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{year}</div>
              </div>
              <button onClick={nextMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontSize: 14 }}>→</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 5 }}>
              {DAYS.map((day) => <div key={day} style={{ textAlign: 'center', fontSize: 10, color: T.muted, fontWeight: 600, padding: '3px 0', textTransform: 'uppercase', letterSpacing: 0.8 }}>{day}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {cells.map((cell, index) => {
                if (!cell) return <div key={`empty-${index}`} style={{ minHeight: 88 }} />
                const hasTrades = cell.dayStats !== null
                const positive = hasTrades && cell.dayStats.pnl >= 0
                const intensity = hasTrades ? Math.min(0.99, Math.abs(cell.dayStats.pnl) / maxAbs) : 0
                const shadeIndex = Math.min(7, Math.floor(intensity * 8))
                const hasNote = !!monthNotes.find(([key]) => key === cell.key)
                const hasEOD = !!eodEntries.find((entry) => entry.date === cell.key)
                const goals = hasTrades ? getDayGoalsMet(cell.key) : null
                const allMet = goals && goals.met === goals.total
                const isToday = cell.key === todayKey
                const isSelected = cell.key === selected
                const bg = !hasTrades ? T.surface : positive ? greenShades[shadeIndex] : redShades[shadeIndex]
                const border = isSelected ? `2px solid ${T.accent}` : isToday ? `2px solid ${T.accent}88` : allMet ? `2px solid ${T.green}88` : `1px solid ${hasTrades ? (positive ? T.green : T.red) + '33' : T.border}`

                return (
                  <div key={cell.key} className="cal-cell" onClick={() => openDay(cell.key)} style={{ borderRadius: 10, padding: '6px 5px 7px', background: bg, border, cursor: 'pointer', minHeight: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isSelected || isToday ? T.accent : T.textMid, marginBottom: 1 }}>{cell.day}</div>
                    {hasTrades && <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: positive ? T.green : T.red, fontFamily: T.fontMono, lineHeight: 1.2, textAlign: 'center' }}>{positive ? '+' : '-'}${fmt(Math.abs(cell.dayStats.pnl), 2)}</div>
                      <div style={{ fontSize: 8, color: (positive ? T.green : T.red) + 'bb', marginTop: 1 }}>{cell.dayStats.trades}t</div>
                      {cell.dayStats.trades > 0 && <div style={{ fontSize: 8, color: T.textMid, opacity: 0.7 }}>{fmt(cell.dayStats.wins / cell.dayStats.trades * 100, 0)}%</div>}
                      {goals && <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>{goals.details.map((item, itemIndex) => <div key={itemIndex} style={{ width: 4, height: 4, borderRadius: '50%', background: item.met ? T.green : '#ffffff22', border: `1px solid ${item.met ? T.green : T.border}` }} />)}</div>}
                    </>}
                    <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                      {hasNote && <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent }} />}
                      {hasEOD && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa' }} />}
                    </div>
                    {allMet && <div style={{ position: 'absolute', top: 3, left: 4, fontSize: 7, color: T.green, fontWeight: 700 }}>★</div>}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <SectionHead title={`Daily P&L - ${MONTHS[month].slice(0, 3)} ${year}`} sub="Daily breakdown" />
            {monthDays.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={monthDays.map(([key, item]) => ({ day: parseInt(key.split('-')[2], 10), pnl: +item.pnl.toFixed(2), fees: +((item.fees || 0).toFixed(2)) }))} barSize={18} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fill: T.muted, fontSize: 10, fontFamily: T.fontMono }} tickLine={false} axisLine={false} tickFormatter={(value) => '$' + fmt(value, 0)} width={58} />
                  <ReferenceLine y={0} stroke={T.border} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0].payload
                    return <div style={{ background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: '9px 12px', fontFamily: T.fontMono, fontSize: 11 }}><div style={{ color: T.muted, marginBottom: 4 }}>Day {label}</div><div style={{ color: colorPnL(item.pnl) }}>P&L: {item.pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(item.pnl), 2)}</div><div style={{ color: T.red }}>Fees: -${fmt(item.fees, 2)}</div></div>
                  }} />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={600}>
                    {monthDays.map(([, item], index) => <Cell key={index} fill={item.pnl >= 0 ? T.green : T.red} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: T.muted, fontSize: 12, padding: '24px 0', textAlign: 'center' }}>No trades this month</div>}
          </Card>
        </div>

        {selected && <Card glow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: T.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Selected Day</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>{fmtDate(new Date(`${selected}T12:00:00`).getTime())}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(320px,0.85fr)', gap: 16, alignItems: 'start' }}>
            <div>
              {selectedDay && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'P&L', value: `${selectedDay.pnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(selectedDay.pnl), 2)}`, color: colorPnL(selectedDay.pnl) },
                  { label: 'Net P&L', value: `${selectedDay.pnl - (selectedDay.fees || 0) >= 0 ? '+$' : '-$'}${fmt(Math.abs(selectedDay.pnl - (selectedDay.fees || 0)), 2)}`, color: colorPnL(selectedDay.pnl - (selectedDay.fees || 0)) },
                  { label: 'Trades', value: countedTrades.length, color: T.text },
                  { label: 'Win Rate', value: countedTrades.length ? `${fmt(countedTrades.filter((trade) => trade.pnl > 0).length / countedTrades.length * 100, 1)}%` : '-', color: countedTrades.length && countedTrades.filter((trade) => trade.pnl > 0).length / countedTrades.length >= 0.5 ? T.green : T.red },
                  { label: 'Winners', value: selectedDay.wins, color: T.green },
                  { label: 'Fees', value: `-$${fmt(selectedDay.fees || 0, 2)}`, color: T.red },
                ].map((item) => <div key={item.label} style={{ background: T.surface, borderRadius: 8, padding: '9px 10px', border: `1px solid ${T.border}` }}><div style={{ fontSize: 8, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{item.label}</div><div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: T.fontMono }}>{item.value}</div></div>)}
              </div>}

              {countedTrades.length > 0 ? <div>
                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>Trades ({countedTrades.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                  {countedTrades.map((trade) => <div key={trade.id} style={{ background: T.surface, borderRadius: 7, padding: '7px 10px', border: `1px solid ${colorPnL(trade.pnl)}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 600, fontSize: 11, marginBottom: 1 }}>{trade.symbol.replace('USDT', '')}<span style={{ color: T.muted, fontSize: 9 }}>/USDT</span></div><div style={{ fontSize: 9, color: T.muted }}>{fmtTime(trade.time)} · {trade.qty}@${fmt(trade.price)} · {trade.leverage}x</div></div><div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, color: colorPnL(trade.pnl), fontSize: 12, fontFamily: T.fontMono }}>{trade.pnl >= 0 ? '+' : ''}{fmt(trade.pnl, 2)}</div><div style={{ fontSize: 9, color: T.red }}>-${fmt(trade.fee, 4)}</div><Badge text={trade.side} color={trade.side === 'BUY' ? T.green : T.red} /></div></div>)}
                </div>
              </div> : <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', padding: '24px 0', border: `1px dashed ${T.border}`, borderRadius: 10 }}>No non-zero trades on this day.</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedGoals && selectedDay && <div style={{ background: T.surface, borderRadius: 8, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid }}>Daily Goals</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selectedGoals.met === 4 ? T.green : selectedGoals.met >= 2 ? T.accent : T.red }}>{selectedGoals.met}/{selectedGoals.total} met</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {selectedGoals.details.map((item, index) => <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', background: item.met ? `${T.green}11` : `${T.red}08`, borderRadius: 5, border: `1px solid ${item.met ? T.green + '33' : T.border}` }}><span style={{ fontSize: 10 }}>{item.met ? 'OK' : 'NO'}</span><span style={{ fontSize: 10, color: item.met ? T.green : T.muted }}>{item.label}</span></div>)}
                </div>
              </div>}

              {selectedEOD && <div style={{ background: '#a78bfa11', borderRadius: 8, padding: '10px 12px', border: '1px solid #a78bfa33' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>EOD Review</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {selectedEOD.rating > 0 && <span style={{ fontSize: 11, color: selectedEOD.rating >= 7 ? T.green : selectedEOD.rating >= 5 ? T.accent : T.red, fontWeight: 600 }}>{selectedEOD.rating}/10</span>}
                  {selectedEOD.mood && <span style={{ fontSize: 11, color: T.textMid }}>{selectedEOD.mood}</span>}
                </div>
                {selectedEOD.notes && <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedEOD.notes.length > 140 ? selectedEOD.notes.slice(0, 140) + '...' : selectedEOD.notes}</div>}
              </div>}

              <div style={{ background: T.surface, borderRadius: 8, padding: '11px 12px', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>Journal Note</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {selectedNote && !editing && <button onClick={() => setViewMode((mode) => mode === 'read' ? 'preview' : 'read')} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.accent, cursor: 'pointer', fontSize: 10, borderRadius: 5, padding: '2px 8px' }}>{viewMode === 'read' ? 'Hide' : 'Read'}</button>}
                    <button onClick={() => { setEditing((value) => !value); setViewMode('preview') }} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 11 }}>{editing ? 'Cancel' : selectedNote ? 'Edit' : '+ Add'}</button>
                  </div>
                </div>
                {editing ? <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{MOODS.map((mood) => <button key={mood} onClick={() => setNoteForm((prev) => ({ ...prev, mood: prev.mood === mood ? '' : mood }))} style={{ background: noteForm.mood === mood ? T.accentDim : T.card, border: `1px solid ${noteForm.mood === mood ? T.accent : T.border}`, color: noteForm.mood === mood ? T.accent : T.muted, borderRadius: 5, padding: '3px 7px', fontSize: 9, cursor: 'pointer' }}>{mood}</button>)}</div>
                  <textarea value={noteForm.text} onChange={(event) => setNoteForm((prev) => ({ ...prev, text: event.target.value }))} placeholder="What happened today? Market conditions, emotions, lessons..." rows={4} style={{ width: '100%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, padding: '9px', color: T.text, fontSize: 12, resize: 'vertical', outline: 'none', lineHeight: 1.7, fontFamily: T.fontSans }} />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={saveNote} style={{ flex: 1, background: T.accent, color: '#000', border: 'none', borderRadius: 6, padding: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Save Note</button>
                    {selectedNote && <button onClick={() => { del(selected); setEditing(false) }} style={{ background: T.redDim, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Delete</button>}
                  </div>
                </div> : selectedNote ? (
                  viewMode === 'read' ? <div><div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selectedNote.text || 'No text.'}</div></div> : <button onClick={() => setViewMode('read')} style={{ width: '100%', background: 'none', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 11, color: T.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedNote.text || '(no text)'}</span><span style={{ fontSize: 10, color: T.accent, flexShrink: 0 }}>Read</span></button>
                ) : <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', padding: '8px 0' }}>No note. Click "+ Add" to journal this day.</div>}
              </div>
            </div>
          </div>
        </Card>}

        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
          <Card>
            <SectionHead title={`${MONTHS[month].slice(0, 3)} ${year}`} sub="Month summary" />
            {monthStats ? <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Gross P&L', value: `${monthStats.pnl >= 0 ? '+$' : '-$'}${fmt(Math.abs(monthStats.pnl), 2)}`, color: colorPnL(monthStats.pnl) },
                { label: 'Net P&L', value: `${(monthStats.netPnl ?? (monthStats.pnl - (monthStats.fees || 0))) >= 0 ? '+$' : '-$'}${fmt(Math.abs(monthStats.netPnl ?? (monthStats.pnl - (monthStats.fees || 0))), 2)}`, color: colorPnL(monthStats.netPnl ?? (monthStats.pnl - (monthStats.fees || 0))) },
                { label: 'Fees', value: `-$${fmt(monthStats.fees || 0, 2)}`, color: T.red },
                { label: 'Trades', value: monthStats.trades, color: T.text },
                { label: 'Win Rate', value: `${fmt(monthStats.wr, 1)}%`, color: parseFloat(monthStats.wr) >= 50 ? T.green : T.red },
                { label: 'Trading Days', value: `${monthDays.length} days`, color: T.text },
                { label: 'Winning Days', value: winningDays, color: T.green },
                { label: 'Losing Days', value: losingDays, color: T.red },
                { label: 'No Trade Days', value: noTradeDays, color: T.muted },
              ].map((item) => <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}><span style={{ fontSize: 11, color: T.muted }}>{item.label}</span><span style={{ fontSize: 12, fontWeight: 600, color: item.color, fontFamily: T.fontMono }}>{item.value}</span></div>)}
            </div> : <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No trades in {MONTHS[month]}</div>}
          </Card>

          <Card>
            <SectionHead title="Month Heatmap" sub="All dates shown. Zero-trade days stay grey." />
            {monthCellData.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {monthCellData.map(([key, item]) => {
                const intensity = Math.min(0.95, 0.2 + Math.abs(item.pnl) / maxAbs * 0.75)
                const positive = item.pnl >= 0
                const shadeIndex = Math.min(7, Math.floor(intensity * 8))
                const hasNote = !!monthNotes.find(([date]) => date === key)
                const hasEOD = !!eodEntries.find((entry) => entry.date === key)
                const zeroDay = !item.trades
                return <div key={key} title={`${key}: ${positive ? '+' : '-'}$${fmt(Math.abs(item.pnl), 2)}`} onClick={() => openDay(key)} className="cal-cell" style={{ width: 32, height: 32, borderRadius: 6, cursor: 'pointer', background: zeroDay ? '#1f2937' : positive ? greenShades[shadeIndex] : redShades[shadeIndex], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#ffffffcc', fontWeight: 700, border: key === selected ? `2px solid ${T.accent}` : `1px solid ${zeroDay ? T.border : (positive ? T.green : T.red) + '22'}`, position: 'relative' }}>{parseInt(key.split('-')[2], 10)}{hasNote && <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: T.accent }} />}{hasEOD && <div style={{ position: 'absolute', top: 2, left: 2, width: 4, height: 4, borderRadius: '50%', background: '#a78bfa' }} />}</div>
              })}
            </div> : <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: '14px 0' }}>No data</div>}
          </Card>

          <Card>
            <SectionHead title="Journal Notes" sub={monthNotes.length ? `${monthNotes.length} saved this month` : 'Month note list'} />
            {monthNotes.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {monthNotes.map(([key, note]) => <button key={key} onClick={() => openDay(key)} style={{ background: key === selected ? T.accentDim : T.surface, border: `1px solid ${key === selected ? T.accent : T.border}`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', textAlign: 'left', fontFamily: T.fontSans }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{key}</span><span style={{ fontSize: 10, color: T.accent }}>{note.mood || 'Journal'}</span></div><div style={{ fontSize: 10, color: T.muted, lineHeight: 1.5 }}>{(note.text || 'No text saved').slice(0, 72)}{(note.text || '').length > 72 ? '...' : ''}</div></button>)}
            </div> : <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: '14px 0' }}>No journal notes saved for this month yet.</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
