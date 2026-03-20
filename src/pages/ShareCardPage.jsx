import { useState, useRef, useCallback } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtPct } from '../lib/data'
import { Card, SectionHead, Btn, Select } from '../components/UI'

const CARD_THEMES = [
  { id:'dark',   label:'Dark Gold',   bg:'#07090d', accent:'#e2b84a', text:'#e2e8f0', card:'#0f1318', border:'#1c2333' },
  { id:'black',  label:'Pure Black',  bg:'#000000', accent:'#ffffff', text:'#ffffff', card:'#111111', border:'#222222' },
  { id:'green',  label:'Bull Mode',   bg:'#041810', accent:'#22c55e', text:'#dcfce7', card:'#062010', border:'#164430' },
  { id:'blue',   label:'Ocean',       bg:'#040d1a', accent:'#3b82f6', text:'#dbeafe', card:'#060f20', border:'#1e3a5f' },
  { id:'red',    label:'Bear Mode',   bg:'#180404', accent:'#ef4444', text:'#fee2e2', card:'#200606', border:'#4a1010' },
]

const CARD_TYPES = [
  { id:'monthly',  label:'Monthly Report'  },
  { id:'alltime',  label:'All-Time Stats'  },
  { id:'streak',   label:'Win Streak'      },
  { id:'milestone',label:'Milestone'       },
]

export default function ShareCardPage({ trades, stats }) {
  const [themeId,   setThemeId]   = useState('dark')
  const [cardType,  setCardType]  = useState('monthly')
  const [customMsg, setCustomMsg] = useState('')
  const [copied,    setCopied]    = useState(false)
  const [dispMode,  setDispMode]  = useState('both') // 'value' | 'pct' | 'both'
  const cardRef = useRef(null)

  const th = CARD_THEMES.find(t=>t.id===themeId) || CARD_THEMES[0]

  // Current month stats
  const now = new Date()
  const curMonthKey = now.toLocaleDateString('en-US',{month:'short',year:'2-digit'})
  const curMonth = stats.monthlyArr?.find(m=>m.m===curMonthKey) || { pnl:0,trades:0,wr:0,fees:0 }

  const downloadCard = async () => {
    const el = cardRef.current
    if (!el) return
    // Use html2canvas via CDN
    try {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      script.onload = async () => {
        const canvas = await window.html2canvas(el, { backgroundColor:th.bg, scale:2, logging:false, useCORS:true })
        const link = document.createElement('a')
        link.download = `tradelenx-${cardType}-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      document.head.appendChild(script)
    } catch (e) {
      alert('Download failed: '+e.message)
    }
  }

  const CardContent = () => {
    if (cardType==='monthly') return (
      <>
        <div style={{ fontSize:11,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:4,opacity:0.8 }}>Monthly Report · {curMonthKey}</div>
        <div style={{ fontSize:42,fontWeight:700,color:curMonth.pnl>=0?th.accent:'#ef4444',fontFamily:'JetBrains Mono,monospace',letterSpacing:-1,marginBottom:4 }}>
          {dispMode==='pct' ? (curMonth.pnl>=0?'+':'')+fmt(curMonth.pnl/(stats.startEquity||10000)*100,1)+'%'
           : dispMode==='value' ? (curMonth.pnl>=0?'+$':'-$')+fmt(Math.abs(curMonth.pnl))
           : (curMonth.pnl>=0?'+$':'-$')+fmt(Math.abs(curMonth.pnl))+' / '+(curMonth.pnl>=0?'+':'')+fmt(curMonth.pnl/(stats.startEquity||10000)*100,1)+'%'}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:16 }}>
          {[
            { l:'Win Rate', v:curMonth.wr+'%' },
            { l:'Trades',   v:curMonth.trades  },
            { l:'Fees',     v:'-$'+fmt(curMonth.fees||0) },
          ].map(r=>(
            <div key={r.l} style={{ background:th.border+'33',borderRadius:8,padding:'10px 12px',textAlign:'center' }}>
              <div style={{ fontSize:9,color:th.text,opacity:0.5,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{r.l}</div>
              <div style={{ fontSize:18,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </>
    )
    if (cardType==='alltime') return (
      <>
        <div style={{ fontSize:11,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:4,opacity:0.8 }}>All-Time Performance</div>
        <div style={{ fontSize:36,fontWeight:700,color:stats.netPnL>=0?th.accent:'#ef4444',fontFamily:'JetBrains Mono,monospace',letterSpacing:-1,marginBottom:4 }}>
          {stats.netPnL>=0?'+':'-'}${fmt(Math.abs(stats.netPnL||0))}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:16 }}>
          {[
            { l:'Win Rate',    v:fmt(stats.winRate)+'%' },
            { l:'R:R',         v:stats.rr+'x' },
            { l:'Trades',      v:stats.total },
            { l:'Best Month',  v:'+$'+fmt(Math.max(...(stats.monthlyArr||[{pnl:0}]).map(m=>m.pnl))) },
            { l:'Max DD',      v:fmt(stats.maxDD)+'%' },
            { l:'Profit Factor',v:isFinite(stats.profitFactor)?fmt(stats.profitFactor):'∞' },
          ].map(r=>(
            <div key={r.l} style={{ background:th.border+'33',borderRadius:8,padding:'8px 10px',textAlign:'center' }}>
              <div style={{ fontSize:8,color:th.text,opacity:0.5,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
              <div style={{ fontSize:15,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </>
    )
    if (cardType==='streak') return (
      <>
        <div style={{ fontSize:11,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:8,opacity:0.8 }}>Win Streak Achievement</div>
        <div style={{ fontSize:80,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace',lineHeight:1 }}>{stats.maxWinStreak}</div>
        <div style={{ fontSize:18,color:th.text,opacity:0.6,marginTop:4,marginBottom:16 }}>consecutive wins</div>
        <div style={{ display:'flex',gap:10,justifyContent:'center' }}>
          {[
            { l:'Win Rate', v:fmt(stats.winRate)+'%' },
            { l:'Total Wins', v:stats.winners },
          ].map(r=>(
            <div key={r.l} style={{ background:th.border+'33',borderRadius:8,padding:'8px 16px',textAlign:'center' }}>
              <div style={{ fontSize:9,color:th.text,opacity:0.5,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
              <div style={{ fontSize:18,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </>
    )
    if (cardType==='milestone') return (
      <>
        <div style={{ fontSize:11,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:8,opacity:0.8 }}>Trading Milestone 🏆</div>
        <div style={{ fontSize:18,color:th.text,opacity:0.7,marginBottom:8 }}>{customMsg || 'My Trading Journey'}</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginTop:8 }}>
          {[
            { l:'Total Trades',  v:stats.total },
            { l:'Net P&L',       v:(stats.netPnL>=0?'+$':'-$')+fmt(Math.abs(stats.netPnL||0)) },
            { l:'Win Rate',      v:fmt(stats.winRate)+'%' },
            { l:'Best Streak',   v:stats.maxWinStreak+'W' },
          ].map(r=>(
            <div key={r.l} style={{ background:th.border+'33',borderRadius:8,padding:'10px 14px' }}>
              <div style={{ fontSize:9,color:th.text,opacity:0.5,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{r.l}</div>
              <div style={{ fontSize:20,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div style={{ padding:'24px 28px',fontFamily:T.fontSans }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Share</div>
        <div style={{ fontSize:22,fontWeight:700,color:T.text,letterSpacing:-0.5 }}>Share Card Generator</div>
        <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>Generate a shareable image of your performance</div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'300px 1fr',gap:20 }}>
        {/* Controls */}
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <Card>
            <SectionHead title="Card Type" sub="Choose"/>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {CARD_TYPES.map(ct=>(
                <button key={ct.id} onClick={()=>setCardType(ct.id)} style={{
                  background:cardType===ct.id?T.accentDim:T.surface,
                  border:`1px solid ${cardType===ct.id?T.accent:T.border}`,
                  color:cardType===ct.id?T.accent:T.textMid,
                  borderRadius:7,padding:'9px 14px',cursor:'pointer',textAlign:'left',fontFamily:T.fontSans,fontSize:12,fontWeight:cardType===ct.id?600:400,
                }}>{ct.label}</button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHead title="Theme" sub="Style"/>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {CARD_THEMES.map(ct=>(
                <button key={ct.id} onClick={()=>setThemeId(ct.id)} style={{
                  background:themeId===ct.id?ct.bg:T.surface,
                  border:`2px solid ${themeId===ct.id?ct.accent:T.border}`,
                  color:themeId===ct.id?ct.text:T.textMid,
                  borderRadius:7,padding:'8px 14px',cursor:'pointer',textAlign:'left',fontFamily:T.fontSans,fontSize:12,display:'flex',alignItems:'center',gap:8,
                }}>
                  <div style={{ width:12,height:12,borderRadius:'50%',background:ct.accent,flexShrink:0 }}/>
                  {ct.label}
                </button>
              ))}
            </div>
          </Card>

          {cardType==='milestone' && (
            <Card>
              <SectionHead title="Custom Message" sub="Optional"/>
              <input value={customMsg} onChange={e=>setCustomMsg(e.target.value)} placeholder="e.g. 100 trades completed!"
                style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 12px',color:T.text,fontFamily:T.fontSans,fontSize:12,outline:'none' }}/>
            </Card>
          )}

          <Card>
            <SectionHead title="Display Mode" sub="Value / %" />
            <div style={{ display:'flex',gap:6 }}>
              {[{v:'value',l:'$ Value'},{v:'pct',l:'% Only'},{v:'both',l:'Both'}].map(o=>(
                <button key={o.v} onClick={()=>setDispMode(o.v)} style={{
                  flex:1,padding:'7px',borderRadius:6,cursor:'pointer',fontFamily:T.fontSans,fontSize:11,fontWeight:500,
                  background:dispMode===o.v?T.accentDim:T.surface,
                  border:`1px solid ${dispMode===o.v?T.accent:T.border}`,
                  color:dispMode===o.v?T.accent:T.muted,
                }}>{o.l}</button>
              ))}
            </div>
          </Card>

          <Btn variant="accent" onClick={downloadCard} style={{ padding:'12px',fontSize:14,justifyContent:'center' }}>
            ↓ Download PNG
          </Btn>
        </div>

        {/* Card preview */}
        <div>
          <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:12 }}>Preview</div>
          <div ref={cardRef} style={{
            background: th.bg,
            border: `1px solid ${th.border}`,
            borderRadius: 16,
            padding: '32px 36px',
            width: 480,
            minHeight: 280,
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Inter,-apple-system,sans-serif',
          }}>
            {/* Background glow */}
            <div style={{ position:'absolute',top:-60,right:-60,width:240,height:240,borderRadius:'50%',background:`radial-gradient(circle,${th.accent}18 0%,transparent 70%)`,pointerEvents:'none' }}/>

            {/* Logo */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
              <div style={{ fontSize:13,fontWeight:700,color:th.accent,letterSpacing:0.5 }}>◈ TRADELENX</div>
              <div style={{ fontSize:10,color:th.text,opacity:0.4 }}>{fmtDate(Date.now())}</div>
            </div>

            <CardContent />

            {/* Footer */}
            <div style={{ marginTop:24,paddingTop:14,borderTop:`1px solid ${th.border}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ fontSize:9,color:th.text,opacity:0.3,textTransform:'uppercase',letterSpacing:1 }}>Perpetual Futures · USDT</div>
              <div style={{ fontSize:9,color:th.text,opacity:0.3 }}>Not financial advice</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
