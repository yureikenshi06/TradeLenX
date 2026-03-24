import { useState } from 'react'
import { THEME as T } from '../lib/theme'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { id:'dashboard', icon:'▦', label:'Dashboard',   group:'main'   },
  { id:'trades',    icon:'≡', label:'Trade Log',   group:'main'   },
  { id:'charts',    icon:'↗', label:'Analytics',   group:'main'   },
  { id:'calendar',  icon:'◫', label:'Calendar',    group:'main'   },
  { id:'symbols',   icon:'◎', label:'Symbols',     group:'main'   },
  { id:'wallet',    icon:'◑', label:'Wallet',      group:'main'   },
  { id:'progress',  icon:'◉', label:'Progress',    group:'tools'  },
  { id:'eod',       icon:'◷', label:'Day Summary', group:'tools'  },
  { id:'checklist', icon:'☑', label:'Checklists',  group:'tools'  },
  { id:'notes',     icon:'✎', label:'Journal',     group:'tools'  },
  { id:'ai',        icon:'◈', label:'AI Analysis', group:'tools'  },
  { id:'share',     icon:'⬡', label:'Share Card',  group:'tools'  },
  { id:'settings',  icon:'⚙', label:'Settings',    group:'system' },
]

export default function Layout({ children, activePage, onPageChange, connected, source, trades }) {
  const { user }     = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const groups = [
    { key:'main',   label:'TRADING' },
    { key:'tools',  label:'TOOLS'   },
    { key:'system', label:'SYSTEM'  },
  ]

  return (
    <div style={{ display:'flex',minHeight:'100vh',background:T.bgDeep }}>
      <aside style={{
        width: collapsed ? 52 : 210,
        background: T.surface, borderRight:`1px solid ${T.border}`,
        display:'flex',flexDirection:'column',
        transition:'width 0.22s cubic-bezier(.22,1,.36,1)',
        flexShrink:0, position:'sticky',top:0,height:'100vh',zIndex:50,overflow:'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding:collapsed?'16px 14px':'16px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,overflow:'hidden',flexShrink:0 }}>
          <div style={{ fontSize:18,color:T.accent,flexShrink:0,fontWeight:700 }}>◈</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:T.accent,letterSpacing:-0.3,whiteSpace:'nowrap',fontFamily:T.fontSans }}>Tradelenx</div>
              <div style={{ fontSize:9,color:T.muted,letterSpacing:1.5,whiteSpace:'nowrap',textTransform:'uppercase' }}>Futures Journal</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1,padding:'10px 8px',display:'flex',flexDirection:'column',gap:0,overflowY:'auto' }}>
          {groups.map(group=>(
            <div key={group.key} style={{ marginBottom:6 }}>
              {!collapsed && (
                <div style={{ fontSize:9,color:T.muted+'88',letterSpacing:2,fontWeight:700,padding:'10px 10px 5px',textTransform:'uppercase' }}>
                  {group.label}
                </div>
              )}
              {NAV.filter(n=>n.group===group.key).map(item=>{
                const active = activePage===item.id
                return (
                  <button key={item.id} onClick={()=>onPageChange(item.id)} title={collapsed?item.label:''} style={{
                    display:'flex',alignItems:'center',gap:9,
                    padding:collapsed?'9px 0':'8px 12px',
                    borderRadius:8,cursor:'pointer',
                    fontFamily:T.fontSans,fontSize:12,fontWeight:active?600:400,
                    background:active?T.accentDim:'transparent',
                    color:active?T.accent:T.textMid,
                    border:active?`1px solid ${T.accent}44`:'1px solid transparent',
                    transition:'all 0.12s',width:'100%',
                    justifyContent:collapsed?'center':'flex-start',
                    marginBottom:2,
                    letterSpacing:active?0:-0.1,
                  }}>
                    <span style={{ fontSize:14,flexShrink:0,opacity:active?1:0.6,transition:'opacity 0.12s' }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace:'nowrap',flex:1,textAlign:'left' }}>{item.label}</span>}
                    {!collapsed && active && (
                      <div style={{ width:5,height:5,borderRadius:'50%',background:T.accent,boxShadow:`0 0 6px ${T.accent}`,flexShrink:0 }}/>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:'10px 8px',borderTop:`1px solid ${T.border}`,flexShrink:0 }}>
          {!collapsed && (
            <div style={{
              display:'flex',alignItems:'center',gap:7,
              background:connected?T.greenDim:T.redDim,
              border:`1px solid ${connected?T.green:T.red}33`,
              borderRadius:7,padding:'6px 10px',marginBottom:8,
            }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:connected?T.green:T.red,flexShrink:0 }}/>
              <div style={{ fontSize:10,color:connected?T.green:T.red,fontWeight:600,whiteSpace:'nowrap' }}>
                {connected?(source==='demo'?'DEMO DATA':'BINANCE LIVE'):'OFFLINE'}
              </div>
            </div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)} style={{
            width:'100%',padding:'6px',borderRadius:7,
            background:'transparent',border:`1px solid ${T.border}`,
            color:T.muted,fontFamily:T.fontSans,fontSize:10,cursor:'pointer',
            marginBottom:user&&!collapsed?6:0,
          }}>
            {collapsed?'→':'← Collapse'}
          </button>
          {!collapsed && user && (
            <div style={{ padding:'8px 10px',borderRadius:7,background:T.card,border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:9,color:T.muted,letterSpacing:1,marginBottom:2 }}>SIGNED IN</div>
              <div style={{ fontSize:11,color:T.textMid,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.email}</div>
              <button onClick={signOut} style={{ fontSize:10,color:T.red,background:T.redDim,border:`1px solid ${T.red}22`,borderRadius:5,padding:'3px 8px',cursor:'pointer',fontFamily:T.fontSans }}>Sign Out</button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex:1,overflow:'auto',background:T.bgDeep }}>
        {children}
      </main>
    </div>
  )
}
