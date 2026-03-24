import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtTime, localDateKey } from '../lib/data'
import { Card, SectionHead, Badge, ChartTooltip, Btn } from '../components/UI'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MOODS  = ['🔥 Focused','😐 Neutral','😰 Anxious','😤 FOMO','🧘 Disciplined','😴 Tired','😡 Revenge']

function useNotes() {
  const [notes, setNotes] = useState({})
  useEffect(() => {
    try { const s = localStorage.getItem('tl_cal_notes'); if (s) setNotes(JSON.parse(s)) } catch {}
  }, [])
  const save = (k, note) => setNotes(n => { const u={...n,[k]:note}; try{localStorage.setItem('tl_cal_notes',JSON.stringify(u))}catch{}; return u })
  const del  = (k)      => setNotes(n => { const u={...n}; delete u[k]; try{localStorage.setItem('tl_cal_notes',JSON.stringify(u))}catch{}; return u })
  return { notes, save, del }
}

function useEODEntries() {
  const [entries, setEntries] = useState([])
  useEffect(() => {
    try { const s = localStorage.getItem('tl_eod'); if (s) setEntries(JSON.parse(s)) } catch {}
  }, [])
  return entries
}

export default function CalendarPage({ trades, stats }) {
  const now = new Date()
  const [year,     setYear]    = useState(now.getFullYear())
  const [month,    setMonth]   = useState(now.getMonth())
  const [selected, setSelected]= useState(null)
  const [editing,  setEditing] = useState(false)
  const [noteForm, setNoteForm]= useState({ text:'', mood:'' })
  const [viewMode, setViewMode]= useState('preview') // 'preview' | 'read' | 'edit'
  const { notes, save, del }   = useNotes()
  const eodEntries             = useEODEntries()

  const dayGoals = useMemo(() => {
    try { return { targetPnL:200, maxLoss:100, maxTrades:10, minWinRate:50, ...JSON.parse(localStorage.getItem('tlx_day_goals')||'{}') } }
    catch { return { targetPnL:200, maxLoss:100, maxTrades:10, minWinRate:50 } }
  }, [])

  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMo  = new Date(year, month+1, 0).getDate()

  const cells = Array.from({ length: firstDay+daysInMo }, (_,i) => {
    if (i < firstDay) return null
    const d   = i - firstDay + 1
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const day = stats.dailyPnL?.[key] || null
    return { d, key, day }
  })

  const todayKey   = localDateKey(Date.now())
  const monthKey   = new Date(year,month,1).toLocaleDateString('en-US',{month:'short',year:'2-digit'})
  const monthStats = stats.monthlyArr?.find(m=>m.m===monthKey)

  const dayTrades = useMemo(() => selected ? trades.filter(t=>localDateKey(t.time)===selected) : [], [selected, trades])
  const selEOD    = useMemo(() => selected ? eodEntries.find(e=>e.date===selected) : null, [selected, eodEntries])

  const getDayGoalsMet = (key) => {
    const dayData = stats.dailyPnL?.[key]
    if (!dayData) return null
    const dTrades = trades.filter(t => localDateKey(t.time) === key)
    const wr = dTrades.length ? dTrades.filter(t=>t.pnl>0).length / dTrades.length * 100 : 0
    const details = [
      { label:'P&L Target', met: dayData.pnl >= dayGoals.targetPnL },
      { label:'Loss Limit',  met: dayData.pnl >= -dayGoals.maxLoss },
      { label:'Max Trades',  met: dTrades.length <= dayGoals.maxTrades },
      { label:'Win Rate',    met: wr >= dayGoals.minWinRate },
    ]
    return { met: details.filter(d=>d.met).length, total: 4, details }
  }

  const maxAbs = useMemo(() => {
    if (!stats.dailyPnL) return 1
    return Math.max(1, ...Object.values(stats.dailyPnL).map(d=>Math.abs(d.pnl)))
  }, [stats.dailyPnL])

  const monthDays = useMemo(() => {
    const pfx = `${year}-${String(month+1).padStart(2,'0')}`
    return Object.entries(stats.dailyPnL||{}).filter(([k])=>k.startsWith(pfx)).sort(([a],[b])=>a.localeCompare(b))
  }, [stats.dailyPnL, year, month])

  const prevMonth = () => { if(month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1) }
  const nextMonth = () => { if(month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1) }

  const openDay = (key) => {
    setSelected(key)
    const ex = notes[key]
    setNoteForm({ text:ex?.text||'', mood:ex?.mood||'' })
    setEditing(false)
    setViewMode('preview')
  }

  const saveNote = () => {
    if (selected) {
      if (noteForm.text.trim()||noteForm.mood) save(selected,{...noteForm,updatedAt:Date.now()})
      else del(selected)
    }
    setEditing(false)
    setViewMode('preview')
  }

  const selDay   = selected ? stats.dailyPnL?.[selected] : null
  const selNote  = selected ? notes[selected] : null
  const selGoals = selected ? getDayGoalsMet(selected) : null

  const greenShades = ['#071a0e','#0a2614','#0d331a','#104021','#144f29','#186032','#1d743c','#228b47']
  const redShades   = ['#1a0707','#26090a','#330b0b','#410e0e','#501111','#601414','#741818','#8b1c1c']

  return (
    <div className="page-enter" style={{ padding:'24px 28px', fontFamily:'Inter,-apple-system,sans-serif' }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        .cal-cell { transition:transform 0.12s,box-shadow 0.12s; }
        .cal-cell:hover { transform:scale(1.05); box-shadow:0 6px 24px rgba(0,0,0,0.45); z-index:2; position:relative; }
        .day-panel { animation: slideIn 0.2s ease; }
      `}</style>

      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>P&L Calendar</div>
        <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Trading Calendar</div>
        <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>{Object.keys(stats.dailyPnL||{}).length} trading days · click any day to view trades, notes &amp; goals</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, alignItems:'start' }}>
        {/* LEFT */}
        <div>
          <Card style={{ marginBottom:12 }} glow>
            {/* Nav */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
              <button onClick={prevMonth} style={{ background:T.surface,border:`1px solid ${T.border}`,color:T.textMid,borderRadius:8,padding:'7px 18px',cursor:'pointer',fontSize:14 }}>←</button>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20,fontWeight:700,letterSpacing:-0.3 }}>{MONTHS[month]}</div>
                <div style={{ fontSize:11,color:T.muted,marginTop:1 }}>{year}</div>
              </div>
              <button onClick={nextMonth} style={{ background:T.surface,border:`1px solid ${T.border}`,color:T.textMid,borderRadius:8,padding:'7px 18px',cursor:'pointer',fontSize:14 }}>→</button>
            </div>

            {/* Day headers */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:5 }}>
              {DAYS.map(d=><div key={d} style={{ textAlign:'center',fontSize:10,color:T.muted,fontWeight:600,padding:'3px 0',textTransform:'uppercase',letterSpacing:0.8 }}>{d}</div>)}
            </div>

            {/* Cells */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4 }}>
              {cells.map((cell,i) => {
                if (!cell) return <div key={`e${i}`} style={{ minHeight:88 }}/>
                const hasTrades = cell.day !== null
                const isPos     = hasTrades && cell.day.pnl >= 0
                const intensity = hasTrades ? Math.min(0.99, Math.abs(cell.day.pnl)/maxAbs) : 0
                const shadeIdx  = Math.min(7, Math.floor(intensity * 8))
                const isToday   = cell.key === todayKey
                const isSel     = cell.key === selected
                const hasNote   = !!notes[cell.key]
                const hasEOD    = !!eodEntries.find(e=>e.date===cell.key)
                const gInfo     = hasTrades ? getDayGoalsMet(cell.key) : null
                const allMet    = gInfo && gInfo.met === gInfo.total

                const bg  = !hasTrades ? T.surface : isPos ? greenShades[shadeIdx] : redShades[shadeIdx]
                const bdr = isSel ? `2px solid ${T.accent}` : isToday ? `2px solid ${T.accent}88` : allMet ? `2px solid ${T.green}99` : `1px solid ${hasTrades?(isPos?T.green:T.red)+'33':T.border}`

                return (
                  <div key={cell.key} className="cal-cell" onClick={()=>openDay(cell.key)} style={{
                    borderRadius:10,padding:'6px 5px 7px',background:bg,border:bdr,
                    cursor:'pointer',minHeight:88,display:'flex',flexDirection:'column',
                    alignItems:'center',gap:1,position:'relative',overflow:'hidden',
                  }}>
                    <div style={{ fontSize:11,fontWeight:isToday?700:500,color:isToday?T.accent:isSel?T.accent:T.textMid,marginBottom:1 }}>{cell.d}</div>

                    {hasTrades && (<>
                      <div style={{ fontSize:9,fontWeight:700,color:isPos?T.green:T.red,fontFamily:'JetBrains Mono,monospace',lineHeight:1.2,textAlign:'center' }}>
                        {isPos?'+':'-'}${fmt(Math.abs(cell.day.pnl),2)}
                      </div>
                      <div style={{ fontSize:8,color:(isPos?T.green:T.red)+'bb',marginTop:1 }}>{cell.day.trades}t</div>
                      {cell.day.trades>0 && <div style={{ fontSize:8,color:T.textMid,opacity:0.7 }}>{fmt(cell.day.wins/cell.day.trades*100,0)}%</div>}

                      {/* Goal dots */}
                      {gInfo && (
                        <div style={{ display:'flex',gap:2,marginTop:2 }}>
                          {gInfo.details.map((g,gi)=>(
                            <div key={gi} style={{ width:4,height:4,borderRadius:'50%',background:g.met?T.green:'#ffffff22',border:`1px solid ${g.met?T.green:T.border}` }}/>
                          ))}
                        </div>
                      )}

                      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:2,background:T.border+'44' }}>
                        <div style={{ height:'100%',background:isPos?T.green:T.red,width:Math.round(intensity*100)+'%',transition:'width 0.4s ease' }}/>
                      </div>
                    </>)}

                    {/* Indicator dots */}
                    <div style={{ position:'absolute',top:3,right:3,display:'flex',flexDirection:'column',gap:2,alignItems:'flex-end' }}>
                      {hasNote && <div style={{ width:5,height:5,borderRadius:'50%',background:T.accent,boxShadow:`0 0 5px ${T.accent}99` }}/>}
                      {hasEOD  && <div style={{ width:5,height:5,borderRadius:'50%',background:'#a78bfa',boxShadow:'0 0 5px #a78bfa88' }}/>}
                    </div>
                    {allMet && <div style={{ position:'absolute',top:3,left:4,fontSize:7,color:T.green,fontWeight:700 }}>★</div>}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display:'flex',gap:10,justifyContent:'center',marginTop:14,flexWrap:'wrap' }}>
              {[
                {el:<div style={{ width:10,height:10,borderRadius:3,background:'rgba(34,197,94,0.55)',border:`1px solid ${T.border}` }}/>, label:'Profit'},
                {el:<div style={{ width:10,height:10,borderRadius:3,background:'rgba(239,68,68,0.55)',border:`1px solid ${T.border}` }}/>, label:'Loss'},
                {el:<div style={{ width:6,height:6,borderRadius:'50%',background:T.accent }}/>,     label:'Note'},
                {el:<div style={{ width:6,height:6,borderRadius:'50%',background:'#a78bfa' }}/>,    label:'EOD'},
                {el:<span style={{ fontSize:9,color:T.green,fontWeight:700 }}>★</span>,            label:'All goals met'},
                {el:<div style={{ display:'flex',gap:2 }}>{[1,0,1,0].map((m,i)=><div key={i} style={{ width:4,height:4,borderRadius:'50%',background:m?T.green:'#ffffff22',border:`1px solid ${m?T.green:T.border}` }}/>)}</div>, label:'Goal dots'},
              ].map(l=>(
                <div key={l.label} style={{ display:'flex',alignItems:'center',gap:4 }}>
                  {l.el}
                  <span style={{ fontSize:10,color:T.muted }}>{l.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Monthly bar chart */}
          <Card>
            <SectionHead title={`Daily P&L — ${MONTHS[month].slice(0,3)} ${year}`} sub="Daily breakdown"/>
            {monthDays.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={monthDays.map(([k,v])=>({ day:parseInt(k.split('-')[2]),pnl:+v.pnl.toFixed(2),fees:+(v.fees||0).toFixed(2) }))}
                  barSize={18} margin={{left:4,right:4,top:4,bottom:4}}>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="day" tick={{fill:T.muted,fontSize:10}} tickLine={false} axisLine={{stroke:T.border}}/>
                  <YAxis tick={{fill:T.muted,fontSize:10,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={58}/>
                  <ReferenceLine y={0} stroke={T.border}/>
                  <Tooltip content={({ active,payload,label }) => {
                    if (!active||!payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'9px 12px',fontFamily:'JetBrains Mono,monospace',fontSize:11 }}>
                        <div style={{ color:T.muted,marginBottom:4 }}>Day {label}</div>
                        <div style={{ color:colorPnL(d.pnl) }}>P&L: {d.pnl>=0?'+$':'-$'}{fmt(Math.abs(d.pnl),2)}</div>
                        <div style={{ color:T.red }}>Fees: -${fmt(d.fees,2)}</div>
                      </div>
                    )
                  }}/>
                  <Bar dataKey="pnl" radius={[3,3,0,0]} name="P&L" isAnimationActive animationDuration={600}>
                    {monthDays.map(([,v],i)=><Cell key={i} fill={v.pnl>=0?T.green:T.red}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color:T.muted,fontSize:12,padding:'24px 0',textAlign:'center' }}>No trades this month</div>}
          </Card>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {/* Month Summary */}
          <Card>
            <SectionHead title={`${MONTHS[month].slice(0,3)} ${year}`} sub="Month summary"/>
            {monthStats ? (
              <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
                {[
                  { l:'Gross P&L',    v:(monthStats.pnl>=0?'+$':'-$')+fmt(Math.abs(monthStats.pnl),2), c:colorPnL(monthStats.pnl) },
                  { l:'Net P&L',      v:(monthStats.netPnl!==undefined?(monthStats.netPnl>=0?'+$':'-$')+fmt(Math.abs(monthStats.netPnl||monthStats.pnl-(monthStats.fees||0)),2):'—'), c:colorPnL(monthStats.pnl-(monthStats.fees||0)) },
                  { l:'Fees',         v:'-$'+fmt(monthStats.fees||0,2), c:T.red },
                  { l:'Trades',       v:monthStats.trades, c:T.text },
                  { l:'Win Rate',     v:fmt(monthStats.wr,1)+'%', c:parseFloat(monthStats.wr)>=50?T.green:T.red },
                  { l:'Trading Days', v:monthDays.length+' days', c:T.text },
                ].map(r=>(
                  <div key={r.l} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:11,color:T.muted }}>{r.l}</span>
                    <span style={{ fontSize:12,fontWeight:600,color:r.c,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ color:T.muted,fontSize:12,textAlign:'center',padding:'20px 0' }}>No trades in {MONTHS[month]}</div>}
          </Card>

          {/* Selected Day */}
          {selected && (
            <div className="day-panel">
              <Card glow>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:9,color:T.accent,textTransform:'uppercase',letterSpacing:1.5,marginBottom:2 }}>Selected Day</div>
                    <div style={{ fontSize:15,fontWeight:700,letterSpacing:-0.2 }}>{fmtDate(new Date(selected+'T12:00:00').getTime())}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ background:T.surface,border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12 }}>✕</button>
                </div>

                {/* Stats grid */}
                {selDay && (
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12 }}>
                    {[
                      { l:'P&L',      v:(selDay.pnl>=0?'+$':'-$')+fmt(Math.abs(selDay.pnl),2),  c:colorPnL(selDay.pnl) },
                      { l:'Net P&L',  v:(selDay.pnl-(selDay.fees||0)>=0?'+$':'-$')+fmt(Math.abs(selDay.pnl-(selDay.fees||0)),2), c:colorPnL(selDay.pnl-(selDay.fees||0)) },
                      { l:'Trades',   v:dayTrades.length,   c:T.text },
                      { l:'Win Rate', v:dayTrades.length?fmt(selDay.wins/selDay.trades*100,1)+'%':'—', c:selDay.wins/selDay.trades>=0.5?T.green:T.red },
                      { l:'Winners',  v:selDay.wins,        c:T.green },
                      { l:'Fees',     v:'-$'+fmt(selDay.fees||0,2), c:T.red },
                    ].map(r=>(
                      <div key={r.l} style={{ background:T.surface,borderRadius:8,padding:'8px 10px',border:`1px solid ${T.border}` }}>
                        <div style={{ fontSize:8,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:2 }}>{r.l}</div>
                        <div style={{ fontSize:14,fontWeight:700,color:r.c,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Daily Goals */}
                {selGoals && selDay && (
                  <div style={{ background:T.surface,borderRadius:8,padding:'10px 12px',border:`1px solid ${T.border}`,marginBottom:10 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                      <div style={{ fontSize:11,fontWeight:600,color:T.textMid }}>Daily Goals</div>
                      <div style={{ fontSize:12,fontWeight:700,color:selGoals.met===4?T.green:selGoals.met>=2?T.accent:T.red }}>
                        {selGoals.met}/{selGoals.total} {selGoals.met===4?'★ All met!':'met'}
                      </div>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5 }}>
                      {selGoals.details.map((g,i)=>(
                        <div key={i} style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 6px',background:g.met?`${T.green}11`:`${T.red}08`,borderRadius:5,border:`1px solid ${g.met?T.green+'33':T.border}` }}>
                          <span style={{ fontSize:10 }}>{g.met?'✅':'❌'}</span>
                          <span style={{ fontSize:10,color:g.met?T.green:T.muted }}>{g.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EOD Summary */}
                {selEOD && (
                  <div style={{ background:'#a78bfa11',borderRadius:8,padding:'10px 12px',border:'1px solid #a78bfa33',marginBottom:10 }}>
                    <div style={{ fontSize:11,fontWeight:600,color:'#a78bfa',marginBottom:6 }}>📋 EOD Review</div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:4 }}>
                      {selEOD.rating>0 && <span style={{ fontSize:11,color:selEOD.rating>=7?T.green:selEOD.rating>=5?T.accent:T.red,fontWeight:600 }}>{selEOD.rating}/10</span>}
                      {selEOD.mood && <span style={{ fontSize:11,color:T.textMid }}>{selEOD.mood}</span>}
                      {selEOD.followedPlan===true  && <span style={{ fontSize:10,color:T.green }}>✓ Followed plan</span>}
                      {selEOD.followedPlan===false && <span style={{ fontSize:10,color:T.red }}>✗ Off plan</span>}
                      {selEOD.followedPlan==='partial' && <span style={{ fontSize:10,color:T.accent }}>~ Partial</span>}
                    </div>
                    {selEOD.lessons?.length>0 && (
                      <div style={{ display:'flex',flexWrap:'wrap',gap:3,marginBottom:4 }}>
                        {selEOD.lessons.map((l,li)=><span key={li} style={{ fontSize:9,background:T.surface,borderRadius:4,padding:'2px 6px',color:T.muted }}>{l}</span>)}
                      </div>
                    )}
                    {selEOD.notes && <div style={{ fontSize:11,color:T.textMid,lineHeight:1.6,whiteSpace:'pre-wrap',marginTop:4 }}>{selEOD.notes.length>120?selEOD.notes.slice(0,120)+'…':selEOD.notes}</div>}
                  </div>
                )}

                {/* Journal Note */}
                <div style={{ background:T.surface,borderRadius:8,padding:'11px 12px',border:`1px solid ${T.border}`,marginBottom:10 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                    <div style={{ fontSize:11,fontWeight:600 }}>📝 Journal Note</div>
                    <div style={{ display:'flex',gap:6 }}>
                      {selNote && !editing && (
                        <button onClick={()=>setViewMode(m=>m==='read'?'preview':'read')} style={{ background:'none',border:`1px solid ${T.border}`,color:T.accent,cursor:'pointer',fontSize:10,borderRadius:5,padding:'2px 8px' }}>
                          {viewMode==='read'?'▲ Hide':'▼ Read'}
                        </button>
                      )}
                      <button onClick={()=>{setEditing(e=>!e);setViewMode('preview')}} style={{ background:'none',border:'none',color:T.accent,cursor:'pointer',fontSize:11 }}>
                        {editing?'Cancel':selNote?'Edit':'+ Add'}
                      </button>
                    </div>
                  </div>

                  {editing ? (
                    <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
                      <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
                        {MOODS.map(m=>(
                          <button key={m} onClick={()=>setNoteForm(f=>({...f,mood:f.mood===m?'':m}))} style={{
                            background:noteForm.mood===m?T.accentDim:T.card,
                            border:`1px solid ${noteForm.mood===m?T.accent:T.border}`,
                            color:noteForm.mood===m?T.accent:T.muted,
                            borderRadius:5,padding:'3px 7px',fontSize:9,cursor:'pointer',
                          }}>{m}</button>
                        ))}
                      </div>
                      <textarea value={noteForm.text} onChange={e=>setNoteForm(f=>({...f,text:e.target.value}))}
                        placeholder="What happened today? Market conditions, emotions, lessons..."
                        rows={4} style={{ width:'100%',background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:'9px',color:T.text,fontSize:12,resize:'vertical',outline:'none',lineHeight:1.7,fontFamily:'Inter,sans-serif' }}/>
                      <div style={{ display:'flex',gap:7 }}>
                        <button onClick={saveNote} style={{ flex:1,background:T.accent,color:'#000',border:'none',borderRadius:6,padding:'8px',cursor:'pointer',fontWeight:600,fontSize:12 }}>Save Note</button>
                        {selNote && <button onClick={()=>{del(selected);setEditing(false)}} style={{ background:T.redDim,color:T.red,border:`1px solid ${T.red}33`,borderRadius:6,padding:'8px 12px',cursor:'pointer',fontSize:12 }}>Delete</button>}
                      </div>
                    </div>
                  ) : selNote ? (
                    viewMode==='read' ? (
                      <div>
                        {selNote.mood && <div style={{ fontSize:12,marginBottom:5 }}>{selNote.mood}</div>}
                        <div style={{ fontSize:12,color:T.textMid,lineHeight:1.8,whiteSpace:'pre-wrap' }}>{selNote.text||'No text.'}</div>
                      </div>
                    ) : (
                      <button onClick={()=>setViewMode('read')} style={{ width:'100%',background:'none',border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 12px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:8 }}>
                        {selNote.mood && <span style={{ fontSize:13 }}>{selNote.mood.split(' ')[0]}</span>}
                        <span style={{ fontSize:11,color:T.textMid,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{selNote.text||'(no text)'}</span>
                        <span style={{ fontSize:10,color:T.accent,flexShrink:0 }}>Read →</span>
                      </button>
                    )
                  ) : (
                    <div style={{ fontSize:11,color:T.muted,textAlign:'center',padding:'8px 0' }}>No note — click "+ Add" to journal this day.</div>
                  )}
                </div>

                {/* Trades */}
                {dayTrades.length > 0 && (
                  <div>
                    <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontWeight:500 }}>Trades ({dayTrades.length})</div>
                    <div style={{ display:'flex',flexDirection:'column',gap:5,maxHeight:200,overflowY:'auto' }}>
                      {dayTrades.map(t=>(
                        <div key={t.id} style={{ background:T.surface,borderRadius:7,padding:'7px 10px',border:`1px solid ${colorPnL(t.pnl)}22`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                          <div>
                            <div style={{ fontWeight:600,fontSize:11,marginBottom:1 }}>{t.symbol.replace('USDT','')}<span style={{ color:T.muted,fontSize:9 }}>/USDT</span></div>
                            <div style={{ fontSize:9,color:T.muted }}>{fmtTime(t.time)} · {t.qty}@${fmt(t.price)} · {t.leverage}x</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontWeight:700,color:colorPnL(t.pnl),fontSize:12,fontFamily:'JetBrains Mono,monospace' }}>{t.pnl>=0?'+':''}{fmt(t.pnl,2)}</div>
                            <div style={{ fontSize:9,color:T.red }}>-${fmt(t.fee,4)}</div>
                            <Badge text={t.side} color={t.side==='BUY'?T.green:T.red}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Heatmap dots */}
          <Card>
            <SectionHead title="Month Heatmap" sub="Click to select"/>
            {monthDays.length > 0 ? (
              <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
                {monthDays.map(([k,v])=>{
                  const int = Math.min(0.95, 0.2+Math.abs(v.pnl)/maxAbs*0.75)
                  const pos = v.pnl >= 0
                  const si  = Math.min(7,Math.floor(int*8))
                  const hn  = !!notes[k]
                  const he  = !!eodEntries.find(e=>e.date===k)
                  return (
                    <div key={k} title={`${k}: ${pos?'+':'-'}$${fmt(Math.abs(v.pnl),2)}`}
                      onClick={()=>openDay(k)} className="cal-cell" style={{
                        width:32,height:32,borderRadius:6,cursor:'pointer',
                        background:pos?greenShades[si]:redShades[si],
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:9,color:'#ffffffcc',fontWeight:700,
                        border:k===selected?`2px solid ${T.accent}`:`1px solid ${pos?T.green:T.red}22`,
                        position:'relative',
                      }}>
                      {parseInt(k.split('-')[2])}
                      {hn && <div style={{ position:'absolute',top:2,right:2,width:4,height:4,borderRadius:'50%',background:T.accent }}/>}
                      {he && <div style={{ position:'absolute',top:2,left:2,width:4,height:4,borderRadius:'50%',background:'#a78bfa' }}/>}
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ color:T.muted,fontSize:12,textAlign:'center',padding:'14px 0' }}>No data</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
