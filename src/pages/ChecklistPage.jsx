import { useState } from 'react'
import { THEME as T } from '../lib/theme'
import { fmtDate } from '../lib/data'
import { Card, SectionHead, Btn } from '../components/UI'

const DEFAULT_PREMARKET = [
  'Checked economic calendar for high-impact news',
  'Reviewed overnight price action on watchlist',
  'Identified key support & resistance levels',
  'Set daily max loss limit',
  'Checked funding rates (are they extreme?)',
  'Reviewed open positions and current P&L',
  'Mental state check — am I ready to trade?',
  'Reviewed yesterday\'s mistakes',
]

function ChecklistSection({ title, sub, items, checked, onToggle, onAdd, onDelete, color }) {
  const [newItem, setNewItem] = useState('')
  const done = items.filter(item => checked[item]).length

  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
        <div>
          <div style={{ fontSize:9,color:color||T.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:3,fontWeight:500 }}>{sub}</div>
          <div style={{ fontSize:15,fontWeight:600,letterSpacing:-0.2 }}>{title}</div>
        </div>
        <div style={{ background:done===items.length&&items.length>0?T.greenDim:T.surface,border:`1px solid ${done===items.length&&items.length>0?T.green:T.border}`,borderRadius:8,padding:'5px 12px',fontSize:11,color:done===items.length&&items.length>0?T.green:T.muted,fontFamily:T.fontMono,fontWeight:600 }}>
          {done}/{items.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:4,background:T.surface,borderRadius:2,overflow:'hidden',marginBottom:14,border:`1px solid ${T.border}` }}>
        <div style={{ width:items.length?done/items.length*100+'%':'0%',height:'100%',background:done===items.length&&items.length>0?T.green:T.accent,borderRadius:2,transition:'width 0.3s ease' }}/>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
        {items.map((item,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:checked[item]?T.greenDim:T.surface,borderRadius:7,border:`1px solid ${checked[item]?T.green+'44':T.border}`,cursor:'pointer',transition:'all 0.12s' }}
            onClick={()=>onToggle(item)}>
            <div style={{ width:18,height:18,borderRadius:4,border:`2px solid ${checked[item]?T.green:T.border}`,background:checked[item]?T.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.12s' }}>
              {checked[item] && <span style={{ color:'#000',fontSize:11,fontWeight:700,lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ fontSize:12,color:checked[item]?T.green:T.textMid,flex:1,textDecoration:checked[item]?'line-through':'none',lineHeight:1.4 }}>{item}</span>
            <button onClick={e=>{e.stopPropagation();onDelete(item)}} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:12,padding:'2px 4px',opacity:0.5 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Add item */}
      <div style={{ display:'flex',gap:8,marginTop:10 }}>
        <input value={newItem} onChange={e=>setNewItem(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&newItem.trim()){onAdd(newItem.trim());setNewItem('')}}}
          placeholder="Add custom item..."
          style={{ flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'7px 12px',color:T.text,fontFamily:T.fontSans,fontSize:12,outline:'none' }}/>
        <Btn onClick={()=>{if(newItem.trim()){onAdd(newItem.trim());setNewItem('')}}}>+ Add</Btn>
      </div>
    </Card>
  )
}

export default function ChecklistPage() {
  const stored = () => { try { return JSON.parse(localStorage.getItem('tl_checklist')||'{}') } catch { return {} } }
  const [state, setState] = useState(() => ({
    premarket:  stored().premarket  || [...DEFAULT_PREMARKET],
    pmChecked:  stored().pmChecked  || {},
    lastReset:  stored().lastReset  || null,
  }))

  const persist = (s) => { localStorage.setItem('tl_checklist', JSON.stringify(s)); setState(s) }

  const toggle = (type, item) => {
    persist({ ...state, pmChecked: { ...state.pmChecked, [item]: !state.pmChecked[item] } })
  }
  const add = (type, item) => {
    persist({ ...state, premarket: [...state.premarket, item] })
  }
  const del = (type, item) => {
    const updated = { ...state, premarket: state.premarket.filter(i=>i!==item) }
    delete updated.pmChecked[item]
    persist(updated)
  }
  const resetAll = () => {
    persist({ ...state, pmChecked:{}, lastReset: new Date().toISOString() })
  }
  const resetToDefaults = () => {
    persist({ ...state, premarket:[...DEFAULT_PREMARKET], pmChecked:{} })
  }

  const pmDone = state.premarket.filter(i=>state.pmChecked[i]).length
  const allDone = pmDone===state.premarket.length && state.premarket.length>0

  return (
    <div style={{ padding:'24px 28px',fontFamily:T.fontSans }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Trading Discipline</div>
            <div style={{ fontSize:22,fontWeight:700,color:T.text,letterSpacing:-0.5 }}>Checklists</div>
            <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>Complete before trading — builds discipline and consistency</div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {state.lastReset && <div style={{ fontSize:10,color:T.muted }}>Last reset: {fmtDate(new Date(state.lastReset).getTime())}</div>}
            <Btn onClick={resetAll}>↺ Reset Today</Btn>
            <Btn onClick={resetToDefaults} variant="ghost">Reset to Defaults</Btn>
          </div>
        </div>
      </div>

      {/* Overall status */}
      {allDone && (
        <div style={{ background:T.greenDim,border:`1px solid ${T.green}44`,borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ fontSize:24 }}>✅</div>
          <div>
            <div style={{ fontWeight:600,color:T.green,fontSize:14 }}>All checklists complete — you're ready to trade!</div>
            <div style={{ fontSize:11,color:T.green,opacity:0.7,marginTop:2 }}>Remember: stick to your plan, manage your risk.</div>
          </div>
        </div>
      )}

      {!allDone && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',marginBottom:16 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <span style={{ fontSize:12,color:T.textMid,fontWeight:500 }}>Overall Completion</span>
            <span style={{ fontSize:12,fontFamily:T.fontMono,color:T.accent }}>{pmDone}/{state.premarket.length}</span>
          </div>
          <div style={{ height:6,background:T.card,borderRadius:3,overflow:'hidden' }}>
            <div style={{ width:(state.premarket.length?pmDone/state.premarket.length*100:0)+'%',height:'100%',background:T.accent,borderRadius:3,transition:'width 0.3s' }}/>
          </div>
        </div>
      )}

      <ChecklistSection
          title="Pre-Market Checklist"
          sub="Complete before you start trading today"
          items={state.premarket}
          checked={state.pmChecked}
          onToggle={item=>toggle('pm',item)}
          onAdd={item=>add('pm',item)}
          onDelete={item=>del('pm',item)}
          color={T.blue}
        />
    </div>
  )
}
