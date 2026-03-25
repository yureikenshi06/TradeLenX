import { useState, useEffect } from 'react'
import { THEME as T } from '../lib/theme'
import { Card, SectionHead, Badge, Btn, Input } from '../components/UI'
import { fetchNotes, upsertNote, deleteNote } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MOODS = ['Confident', 'Neutral', 'Anxious', 'Angry', 'Calm', 'Tired']
const TAGS = ['FOMO', 'Disciplined', 'Overtraded', 'Missed Setup', 'Perfect Exec', 'Revenge Trade', 'News Trade', 'Breakout', 'Scalp', 'Swing']
const CALENDAR_NOTES_KEY = 'tl_cal_notes'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function syncCalendarJournal(date, mood, body) {
  if (!date) return
  try {
    const raw = JSON.parse(localStorage.getItem(CALENDAR_NOTES_KEY) || '{}')
    localStorage.setItem(CALENDAR_NOTES_KEY, JSON.stringify({
      ...raw,
      [date]: { text: body || '', mood: mood || '', updatedAt: Date.now(), source: 'journal' },
    }))
  } catch {}
}

function removeCalendarJournal(date) {
  if (!date) return
  try {
    const raw = JSON.parse(localStorage.getItem(CALENDAR_NOTES_KEY) || '{}')
    delete raw[date]
    localStorage.setItem(CALENDAR_NOTES_KEY, JSON.stringify(raw))
  } catch {}
}

function NoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const preview = note.body && note.body.length > 120 ? note.body.slice(0, 120) + '...' : note.body

  return (
    <div onClick={() => setExpanded((value) => !value)} style={{ background: T.card, border: `1px solid ${expanded ? T.accent + '88' : T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', boxShadow: expanded ? `0 0 20px ${T.accent}18` : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text, fontFamily: T.fontDisplay, marginBottom: 4 }}>{note.title || 'Untitled'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {note.date && <Badge text={note.date} color={T.textMid} />}
            {note.symbol && <Badge text={note.symbol} color={T.blue} />}
            {note.mood && <span style={{ fontSize: 11 }}>{note.mood}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }} onClick={(event) => event.stopPropagation()}>
          <Btn onClick={() => onEdit(note)} style={{ padding: '4px 10px', fontSize: 11 }}>Edit</Btn>
          <Btn onClick={() => onDelete(note.id)} variant="danger" style={{ padding: '4px 10px', fontSize: 11 }}>Delete</Btn>
        </div>
      </div>

      {!expanded ? (
        <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 4 }}>
          {preview || <span style={{ fontStyle: 'italic' }}>No content</span>}
        </div>
      ) : (
        <div style={{ color: T.textMid, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: note.tags?.length ? 10 : 0 }}>
          {note.body || <span style={{ fontStyle: 'italic', color: T.muted }}>No content.</span>}
        </div>
      )}

      {note.tags?.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{note.tags.map((tag) => <Badge key={tag} text={`#${tag}`} color={T.purple} />)}</div>}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: T.muted }}>{note.created_at ? new Date(note.created_at).toLocaleString() : ''}</span>
        <span style={{ fontSize: 10, color: T.accent }}>{expanded ? 'Collapse' : 'Read'}</span>
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    body: note?.body || '',
    date: note?.date || new Date().toISOString().split('T')[0],
    symbol: note?.symbol || '',
    mood: note?.mood || '',
    tags: note?.tags || [],
  })

  const toggle = (tag) => setForm((prev) => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag] }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: 16, padding: '28px', width: 580, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.fontDisplay, marginBottom: 20 }}>{note?.id ? 'Edit Note' : 'New Journal Entry'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Title</label>
            <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="e.g. BTC breakout play" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Date</label>
              <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Symbol</label>
              <Input value={form.symbol} onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))} placeholder="BTCUSDT" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Mood / State</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {MOODS.map((mood) => <button key={mood} onClick={() => setForm((prev) => ({ ...prev, mood: prev.mood === mood ? '' : mood }))} style={{ background: form.mood === mood ? T.accentDim : T.surface, border: `1px solid ${form.mood === mood ? T.accent : T.border}`, color: form.mood === mood ? T.accent : T.textMid, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: T.fontMono }}>{mood}</button>)}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} rows={7} style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px', color: T.text, fontFamily: T.fontMono, fontSize: 12, resize: 'vertical', outline: 'none', lineHeight: 1.7 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TAGS.map((tag) => <button key={tag} onClick={() => toggle(tag)} style={{ background: form.tags.includes(tag) ? T.purpleDim : T.surface, border: `1px solid ${form.tags.includes(tag) ? T.purple : T.border}`, color: form.tags.includes(tag) ? T.purple : T.muted, borderRadius: 7, padding: '4px 11px', fontSize: 11, cursor: 'pointer', fontFamily: T.fontMono }}>#{tag}</button>)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn variant="accent" onClick={() => onSave(form)}>Save Entry</Btn>
        </div>
      </div>
    </div>
  )
}

export default function NotesPage({ trades }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [miniMonth, setMiniMonth] = useState(() => new Date().getMonth())
  const [miniYear, setMiniYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchNotes(user.id).then((data) => { setNotes(data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (user) return
    const saved = localStorage.getItem('tradelenx_notes')
    if (saved) setNotes(JSON.parse(saved))
  }, [user])

  const saveLocal = (items) => localStorage.setItem('tradelenx_notes', JSON.stringify(items))

  const handleSave = async (form) => {
    const payload = { ...(editing?.id ? { id: editing.id } : {}), user_id: user?.id || 'demo', ...form }
    if (user) {
      try {
        const saved = await upsertNote(payload)
        setNotes((prev) => editing?.id ? prev.map((item) => item.id === saved.id ? saved : item) : [saved, ...prev])
      } catch {
        const fallback = editing?.id ? notes.map((item) => item.id === editing.id ? { ...item, ...form } : item) : [{ id: Date.now().toString(), ...form, created_at: new Date().toISOString() }, ...notes]
        setNotes(fallback)
        saveLocal(fallback)
      }
    } else {
      const fallback = editing?.id ? notes.map((item) => item.id === editing.id ? { ...item, ...form } : item) : [{ id: Date.now().toString(), ...form, created_at: new Date().toISOString() }, ...notes]
      setNotes(fallback)
      saveLocal(fallback)
    }
    syncCalendarJournal(form.date, form.mood, form.body)
    setEditing(null)
    setShowNew(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return
    const target = notes.find((item) => item.id === id)
    if (user) { try { await deleteNote(id) } catch {} }
    const next = notes.filter((item) => item.id !== id)
    setNotes(next)
    saveLocal(next)
    removeCalendarJournal(target?.date)
  }

  const filtered = notes.filter((note) => {
    const matchesText = !filter || note.title?.toLowerCase().includes(filter.toLowerCase()) || note.body?.toLowerCase().includes(filter.toLowerCase()) || note.symbol?.toLowerCase().includes(filter.toLowerCase()) || note.tags?.some((tag) => tag.toLowerCase().includes(filter.toLowerCase()))
    const matchesDate = !selectedDate || note.date === selectedDate
    return matchesText && matchesDate
  })

  const noteDates = new Set(notes.map((note) => note.date).filter(Boolean))
  const firstDay = new Date(miniYear, miniMonth, 1).getDay()
  const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate()
  const miniCells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return null
    const day = index - firstDay + 1
    const key = `${miniYear}-${String(miniMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { day, key, hasNote: noteDates.has(key) }
  })

  const prevMiniMonth = () => {
    if (miniMonth === 0) {
      setMiniYear((value) => value - 1)
      setMiniMonth(11)
    } else setMiniMonth((value) => value - 1)
  }

  const nextMiniMonth = () => {
    if (miniMonth === 11) {
      setMiniYear((value) => value + 1)
      setMiniMonth(0)
    } else setMiniMonth((value) => value + 1)
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      {(editing || showNew) && <NoteEditor note={editing} onSave={handleSave} onCancel={() => { setEditing(null); setShowNew(false) }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, color: T.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Trade Journal</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: T.fontDisplay }}>Notes & Reflections</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{notes.length} entries. Your private trading diary.</div>
        </div>
        <Btn variant="accent" onClick={() => setShowNew(true)} style={{ padding: '10px 20px', fontSize: 13 }}>+ New Entry</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start', marginBottom: 20 }}>
        <div>
          <div style={{ marginBottom: 20 }}>
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search notes, symbols, tags..." style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', color: T.text, fontFamily: T.fontMono, fontSize: 12, width: 340, outline: 'none' }} />
            {selectedDate && <div style={{ marginTop: 8, fontSize: 11, color: T.accent }}>Showing journals for {selectedDate}</div>}
          </div>

          {loading && <div style={{ color: T.muted, padding: '40px 0', textAlign: 'center' }}>Loading notes...</div>}
          {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px' }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.fontDisplay, marginBottom: 8 }}>No journal entries yet</div><div style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>Document your trades, mindset, and lessons learned.</div><Btn variant="accent" onClick={() => setShowNew(true)}>Write First Entry</Btn></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((note) => <NoteCard key={note.id} note={note} onEdit={(item) => setEditing(item)} onDelete={handleDelete} />)}
          </div>
        </div>

        <Card>
          <SectionHead title="Journal Calendar" sub="Open journals by date" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={prevMiniMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>←</button>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{MONTHS[miniMonth]} {miniYear}</div>
            <button onClick={nextMiniMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {DAYS.map((day) => <div key={day} style={{ textAlign: 'center', fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>{day}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {miniCells.map((cell, index) => cell ? (
              <button key={cell.key} onClick={() => setSelectedDate((current) => current === cell.key ? '' : cell.key)} style={{ height: 34, borderRadius: 8, border: `1px solid ${selectedDate === cell.key ? T.accent : cell.hasNote ? `${T.accent}55` : T.border}`, background: selectedDate === cell.key ? T.accentDim : cell.hasNote ? `${T.accent}14` : T.surface, color: cell.hasNote ? T.text : T.muted, cursor: 'pointer', position: 'relative', fontFamily: T.fontSans, fontSize: 11, fontWeight: cell.hasNote ? 700 : 500 }}>
                {cell.day}
                {cell.hasNote && <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: T.accent }} />}
              </button>
            ) : <div key={`blank-${index}`} style={{ height: 34 }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, color: T.muted }}>
            <span>{noteDates.size} journal days</span>
            {selectedDate && <button onClick={() => setSelectedDate('')} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 10 }}>Clear</button>}
          </div>
        </Card>
      </div>

      {!user && notes.length > 0 && <div style={{ marginTop: 20, padding: '14px 18px', background: T.accentDim, border: `1px solid ${T.accent}44`, borderRadius: 10, fontSize: 12, color: T.accent }}>Notes are saved locally. Connect Supabase to sync across devices.</div>}
    </div>
  )
}
