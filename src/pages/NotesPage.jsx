import { useState, useEffect } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Badge, Btn, Input } from '../components/UI'
import { fetchNotes, upsertNote, deleteNote } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MOODS = ['🔥 Confident', '😐 Neutral', '😰 Anxious', '😤 Angry', '🧘 Calm', '😴 Tired']
const TAGS   = ['FOMO', 'Disciplined', 'Overtraded', 'Missed Setup', 'Perfect Exec', 'Revenge Trade', 'News Trade', 'Breakout', 'Scalp', 'Swing']

function NoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const bodyPreview = note.body && note.body.length > 120 ? note.body.slice(0, 120) + '…' : note.body

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: T.card, border: `1px solid ${expanded ? T.accent+'88' : T.border}`,
        borderLeft: `3px solid ${T.accent}`,
        borderRadius: 12, padding: '16px 18px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        boxShadow: expanded ? `0 0 20px ${T.accent}18` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text, fontFamily: T.fontDisplay, marginBottom: 4 }}>{note.title || 'Untitled'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {note.date && <Badge text={note.date} color={T.textMid} />}
            {note.symbol && <Badge text={note.symbol} color={T.blue} />}
            {note.mood && <span style={{ fontSize: 11 }}>{note.mood}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }} onClick={e => e.stopPropagation()}>
          <Btn onClick={() => onEdit(note)} style={{ padding: '4px 10px', fontSize: 11 }}>✏ Edit</Btn>
          <Btn onClick={() => onDelete(note.id)} variant="danger" style={{ padding: '4px 10px', fontSize: 11 }}>✕</Btn>
        </div>
      </div>

      {/* Body — show preview or full */}
      {!expanded ? (
        <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 4 }}>
          {bodyPreview || <span style={{ fontStyle: 'italic' }}>No content</span>}
          {note.body && note.body.length > 120 && (
            <span style={{ color: T.accent, marginLeft: 6, fontSize: 11 }}>Read more ↓</span>
          )}
        </div>
      ) : (
        <div style={{ color: T.textMid, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: note.tags?.length ? 10 : 0 }}>
          {note.body || <span style={{ fontStyle: 'italic', color: T.muted }}>No content.</span>}
        </div>
      )}

      {note.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {note.tags.map(tag => <Badge key={tag} text={`#${tag}`} color={T.purple} />)}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: T.muted }}>
          {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
        </span>
        <span style={{ fontSize: 10, color: T.accent }}>{expanded ? '▲ Collapse' : '▼ Read'}</span>
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave, onCancel, symbols }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    body:  note?.body  || '',
    date:  note?.date  || new Date().toISOString().split('T')[0],
    symbol: note?.symbol || '',
    mood:  note?.mood  || '',
    tags:  note?.tags  || [],
  })

  const toggle = (tag) => setForm(f => ({
    ...f, tags: f.tags.includes(tag) ? f.tags.filter(t=>t!==tag) : [...f.tags, tag]
  }))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: T.card, border: `1px solid ${T.borderMid}`,
        borderRadius: 16, padding: '28px', width: 580, maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.fontDisplay, marginBottom: 20 }}>
          {note?.id ? 'Edit Note' : 'New Journal Entry'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Title</label>
            <Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. BTC breakout play" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Date</label>
              <Input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Symbol</label>
              <Input value={form.symbol} onChange={e => setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))} placeholder="BTCUSDT" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Mood / State</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {MOODS.map(m => (
                <button key={m} onClick={() => setForm(f=>({...f,mood:f.mood===m?'':m}))}
                  style={{
                    background: form.mood === m ? T.accentDim : T.surface,
                    border: `1px solid ${form.mood === m ? T.accent : T.border}`,
                    color: form.mood === m ? T.accent : T.textMid,
                    borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: T.fontMono,
                  }}>{m}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea
              value={form.body} onChange={e => setForm(f=>({...f,body:e.target.value}))}
              placeholder="What happened? What did you do well? What can you improve?&#10;&#10;Key observations, market conditions, emotional state..."
              rows={7}
              style={{
                width: '100%', background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: '12px', color: T.text,
                fontFamily: T.fontMono, fontSize: 12, resize: 'vertical', outline: 'none', lineHeight: 1.7,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggle(tag)}
                  style={{
                    background: form.tags.includes(tag) ? T.purpleDim : T.surface,
                    border: `1px solid ${form.tags.includes(tag) ? T.purple : T.border}`,
                    color: form.tags.includes(tag) ? T.purple : T.muted,
                    borderRadius: 7, padding: '4px 11px', fontSize: 11, cursor: 'pointer', fontFamily: T.fontMono,
                  }}>#{tag}</button>
              ))}
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
  const [notes,   setNotes]   = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState('')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchNotes(user.id).then(data => { setNotes(data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  // Fallback: local storage for demo
  useEffect(() => {
    if (user) return
    const saved = localStorage.getItem('tradelenx_notes')
    if (saved) setNotes(JSON.parse(saved))
  }, [])

  const saveLocal = (notes) => localStorage.setItem('tradelenx_notes', JSON.stringify(notes))

  const handleSave = async (form) => {
    const payload = {
      ...(editing?.id ? { id: editing.id } : {}),
      user_id: user?.id || 'demo',
      ...form,
    }
    if (user) {
      try {
        const saved = await upsertNote(payload)
        setNotes(n => editing?.id ? n.map(x => x.id === saved.id ? saved : x) : [saved, ...n])
      } catch (e) {
        // Fallback to local
        const updated = editing?.id
          ? notes.map(x => x.id === editing.id ? { ...x, ...form } : x)
          : [{ id: Date.now().toString(), ...form, created_at: new Date().toISOString() }, ...notes]
        setNotes(updated); saveLocal(updated)
      }
    } else {
      const updated = editing?.id
        ? notes.map(x => x.id === editing.id ? { ...x, ...form } : x)
        : [{ id: Date.now().toString(), ...form, created_at: new Date().toISOString() }, ...notes]
      setNotes(updated); saveLocal(updated)
    }
    setEditing(null); setShowNew(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return
    if (user) { try { await deleteNote(id) } catch {} }
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated); saveLocal(updated)
  }

  const filtered = notes.filter(n =>
    !filter || n.title?.toLowerCase().includes(filter.toLowerCase()) ||
    n.body?.toLowerCase().includes(filter.toLowerCase()) ||
    n.symbol?.toLowerCase().includes(filter.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(filter.toLowerCase()))
  )

  const symbols = [...new Set(trades.map(t => t.symbol))].sort()

  return (
    <div style={{ padding: '28px 32px' }}>
      {(editing || showNew) && (
        <NoteEditor note={editing} symbols={symbols}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setShowNew(false) }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, color: T.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Trade Journal</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: T.fontDisplay }}>Notes & Reflections</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{notes.length} entries · Your private trading diary</div>
        </div>
        <Btn variant="accent" onClick={() => setShowNew(true)} style={{ padding: '10px 20px', fontSize: 13 }}>
          + New Entry
        </Btn>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Search notes, symbols, tags..."
          style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', color: T.text, fontFamily: T.fontMono, fontSize: 12, width: 340, outline: 'none' }} />
      </div>

      {loading && <div style={{ color: T.muted, padding: '40px 0', textAlign: 'center' }}>Loading notes...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📝</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.fontDisplay, marginBottom: 8 }}>No journal entries yet</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>
            Document your trades, mindset, and lessons learned.
          </div>
          <Btn variant="accent" onClick={() => setShowNew(true)}>Write First Entry</Btn>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(note => (
          <NoteCard key={note.id} note={note}
            onEdit={n => setEditing(n)}
            onDelete={handleDelete} />
        ))}
      </div>

      {!user && notes.length > 0 && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: T.accentDim, border: `1px solid ${T.accent}44`, borderRadius: 10, fontSize: 12, color: T.accent }}>
          ℹ Notes are saved locally. Connect Supabase to sync across devices.
        </div>
      )}
    </div>
  )
}
