import { useState, useRef, useMemo } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, loadCashFlow } from '../lib/data'
import { Card, SectionHead, Btn, Select } from '../components/UI'

const CARD_THEMES = [
  { id:'dark',   label:'Dark Gold',  bg:'#07090d', accent:'#e2b84a', text:'#e2e8f0', card:'#0f1318', border:'#1c2333' },
  { id:'black',  label:'Pure Black', bg:'#000000', accent:'#ffffff', text:'#ffffff', card:'#111111', border:'#222222' },
  { id:'green',  label:'Bull Mode',  bg:'#041810', accent:'#22c55e', text:'#dcfce7', card:'#062010', border:'#164430' },
  { id:'blue',   label:'Ocean',      bg:'#040d1a', accent:'#3b82f6', text:'#dbeafe', card:'#060f20', border:'#1e3a5f' },
  { id:'red',    label:'Bear Mode',  bg:'#180404', accent:'#ef4444', text:'#fee2e2', card:'#200606', border:'#4a1010' },
]

const CARD_TYPES = [
  { id:'period',    label:'Period Report'  },
  { id:'alltime',   label:'All-Time Stats' },
  { id:'streak',    label:'Win Streak'     },
  { id:'milestone', label:'Milestone'      },
]

const PERIOD_OPTS = [
  { value:'weekly',    label:'This Week'    },
  { value:'monthly',   label:'This Month'   },
  { value:'quarterly', label:'This Quarter' },
  { value:'yearly',    label:'This Year'    },
]

export default function ShareCardPage({ trades, stats }) {
  const [themeId,   setThemeId]   = useState('dark')
  const [cardType,  setCardType]  = useState('period')
  const [period,    setPeriod]    = useState('monthly')
  const [dispMode,  setDispMode]  = useState('both')
  const [customMsg, setCustomMsg] = useState('')
  const cardRef = useRef(null)

  const th = CARD_THEMES.find(t=>t.id===themeId)||CARD_THEMES[0]

  // Get period stats — pick correct array and latest entry
  const periodStats = (() => {
    const now  = new Date()
    if (period === 'weekly') {
      const arr  = stats.weeklyArr || []
      const jan  = new Date(now.getFullYear(),0,1)
      const wk   = Math.ceil(((now-jan)/86400000+jan.getDay()+1)/7)
      const key  = `W${wk} ${now.getFullYear()}`
      return arr.find(w=>w.w===key||w.label===key) || arr[arr.length-1] || { pnl:0,trades:0,wr:0,fees:0 }
    }
    if (period === 'monthly') {
      const key  = now.toLocaleDateString('en-US',{month:'short',year:'2-digit'})
      const arr  = stats.monthlyArr || []
      return arr.find(m=>m.m===key||m.label===key) || arr[arr.length-1] || { pnl:0,trades:0,wr:0,fees:0 }
    }
    if (period === 'quarterly') {
      const q    = `Q${Math.floor(now.getMonth()/3)+1} ${now.getFullYear()}`
      const arr  = stats.quarterlyArr || []
      return arr.find(x=>x.q===q||x.label===q) || arr[arr.length-1] || { pnl:0,trades:0,wr:0,fees:0 }
    }
    if (period === 'yearly') {
      const y    = String(now.getFullYear())
      const arr  = stats.yearlyArr || []
      return arr.find(x=>x.y===y||x.label===y) || arr[arr.length-1] || { pnl:0,trades:0,wr:0,fees:0 }
    }
    return { pnl:0,trades:0,wr:0,fees:0 }
  })()

  const periodLabel = PERIOD_OPTS.find(p=>p.value===period)?.label || period
  const periodPnl   = periodStats.pnl || 0
  const periodNet   = periodStats.netPnl ?? (periodPnl - (periodStats.fees||0))

  // Use capital flow for return% calculation
  const capitalFlowBase = useMemo(() => {
    const cf = loadCashFlow()
    if (cf && cf.length > 0) {
      const dep = cf.filter(e=>e.type==='deposit'||e.type==='Deposit').reduce((s,e)=>s+Math.abs(+e.amount),0)
      const wit = cf.filter(e=>e.type==='withdrawal'||e.type==='Withdrawal').reduce((s,e)=>s+Math.abs(+e.amount),0)
      const net = dep - wit
      if (net > 0) return net
    }
    return stats.startEquity || 10000
  }, [stats.startEquity])

  const startEq = capitalFlowBase

  const pnlDisplay = (pnl) => {
    const val  = (pnl>=0?'+$':'-$')+fmt(Math.abs(pnl),2)
    const pct  = (pnl>=0?'+':'')+fmt(pnl/startEq*100,2)+'%'
    if (dispMode==='value') return val
    if (dispMode==='pct')   return pct
    return `${val} · ${pct}`
  }

  const downloadCard = async () => {
    const el = cardRef.current
    if (!el) return
    try {
      if (!window.html2canvas) {
        await new Promise((res,rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
          s.onload = res; s.onerror = rej
          document.head.appendChild(s)
        })
      }
      const canvas = await window.html2canvas(el, { backgroundColor:th.bg, scale:2, logging:false, useCORS:true })
      const link = document.createElement('a')
      link.download = `tradelenx-${cardType}-${period}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch(e) { alert('Download failed: '+e.message) }
  }

  const StatBox = ({ label, value, accent, th }) => (
    <div style={{ background:th.border+'33',borderRadius:8,padding:'10px 12px',textAlign:'center' }}>
      <div style={{ fontSize:9,color:th.text,opacity:0.5,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16,fontWeight:700,color:accent||th.accent,fontFamily:'JetBrains Mono,monospace' }}>{value}</div>
    </div>
  )

  const CardContent = () => {
    if (cardType === 'period') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:6,opacity:0.8 }}>{periodLabel} · Tradelenx</div>
        <div style={{ fontSize: dispMode==='both'?26:38, fontWeight:700, color:periodPnl>=0?th.accent:'#ef4444', fontFamily:'JetBrains Mono,monospace', letterSpacing:-1, marginBottom:6, lineHeight:1.1 }}>
          {pnlDisplay(periodPnl)}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginTop:14 }}>
          <StatBox label="Net P&L"   value={(periodNet>=0?'+$':'-$')+fmt(Math.abs(periodNet),2)} th={th}/>
          <StatBox label="Win Rate"  value={fmt(periodStats.wr||0,1)+'%'} th={th}/>
          <StatBox label="Trades"    value={periodStats.trades||0} th={th}/>
          <StatBox label="Fees"      value={'-$'+fmt(periodStats.fees||0,2)} th={th} accent='#ef4444'/>
        </div>
      </>
    )
    if (cardType === 'alltime') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:6,opacity:0.8 }}>All-Time Performance · Tradelenx</div>
        <div style={{ fontSize:36,fontWeight:700,color:stats.netPnL>=0?th.accent:'#ef4444',fontFamily:'JetBrains Mono,monospace',letterSpacing:-1,marginBottom:6 }}>
          {pnlDisplay(stats.netPnL||0)}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14 }}>
          <StatBox label="Win Rate"      value={fmt(stats.winRate,1)+'%'} th={th}/>
          <StatBox label="R:R"           value={stats.rr+'x'} th={th}/>
          <StatBox label="Trades"        value={stats.total} th={th}/>
          <StatBox label="Best Month"    value={'+$'+fmt(Math.max(0,...(stats.monthlyArr||[]).map(m=>m.pnl)),0)} th={th}/>
          <StatBox label="Max DD"        value={fmt(stats.maxDD,1)+'%'} th={th} accent='#ef4444'/>
          <StatBox label="Profit Factor" value={isFinite(stats.profitFactor)?fmt(stats.profitFactor,2):'∞'} th={th}/>
        </div>
      </>
    )
    if (cardType === 'streak') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:10,opacity:0.8 }}>Win Streak Achievement · Tradelenx</div>
        <div style={{ fontSize:72,fontWeight:700,color:th.accent,fontFamily:'JetBrains Mono,monospace',lineHeight:1 }}>{stats.maxWinStreak}</div>
        <div style={{ fontSize:16,color:th.text,opacity:0.6,marginTop:6,marginBottom:16 }}>consecutive winning trades</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
          <StatBox label="Win Rate"    value={fmt(stats.winRate,1)+'%'} th={th}/>
          <StatBox label="Total Wins"  value={stats.winners} th={th}/>
          <StatBox label="Profit Factor" value={isFinite(stats.profitFactor)?fmt(stats.profitFactor,2):'∞'} th={th}/>
        </div>
      </>
    )
    if (cardType === 'milestone') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:8,opacity:0.8 }}>Trading Milestone · Tradelenx 🏆</div>
        {customMsg && <div style={{ fontSize:16,color:th.text,opacity:0.8,marginBottom:12,fontWeight:500 }}>{customMsg}</div>}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8 }}>
          <StatBox label="Total Trades" value={stats.total} th={th}/>
          <StatBox label="Net P&L"      value={pnlDisplay(stats.netPnL||0)} th={th}/>
          <StatBox label="Win Rate"     value={fmt(stats.winRate,1)+'%'} th={th}/>
          <StatBox label="Best Streak"  value={stats.maxWinStreak+'W'} th={th}/>
        </div>
      </>
    )
    return null
  }

  return (
    <div style={{ padding:'24px 28px',fontFamily:'Inter,-apple-system,sans-serif' }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Share</div>
        <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Share Card Generator</div>
        <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>Generate a shareable performance image</div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'320px 1fr',gap:20 }}>
        {/* Controls */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {/* Card Type + Period */}
          <Card>
            <SectionHead title="Card Type" sub="Choose format"/>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:cardType==='period'?10:0 }}>
              {CARD_TYPES.map(ct=>(
                <button key={ct.id} onClick={()=>setCardType(ct.id)} style={{
                  background:cardType===ct.id?T.accentDim:T.surface,
                  border:`1px solid ${cardType===ct.id?T.accent:T.border}`,
                  color:cardType===ct.id?T.accent:T.textMid,
                  borderRadius:7,padding:'8px 10px',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:cardType===ct.id?600:400,
                }}>{ct.label}</button>
              ))}
            </div>
            {cardType==='period' && (
              <div>
                <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:5 }}>Period</div>
                <Select value={period} onChange={setPeriod} options={PERIOD_OPTS} style={{ width:'100%',fontSize:12 }}/>
                {periodStats.pnl !== 0 && (
                  <div style={{ marginTop:6,fontSize:11,color:T.green }}>✓ {periodStats.trades} trades · {periodStats.pnl>=0?'+$':'-$'}{fmt(Math.abs(periodStats.pnl),2)}</div>
                )}
              </div>
            )}
            {cardType==='milestone' && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:5 }}>Custom Message</div>
                <input value={customMsg} onChange={e=>setCustomMsg(e.target.value)}
                  placeholder="e.g. 100 trades milestone!"
                  style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',color:T.text,fontSize:12,outline:'none',fontFamily:'Inter,sans-serif' }}/>
              </div>
            )}
          </Card>

          {/* Theme */}
          <Card>
            <SectionHead title="Theme" sub="Card color scheme"/>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5 }}>
              {CARD_THEMES.map(ct=>(
                <button key={ct.id} onClick={()=>setThemeId(ct.id)} style={{
                  display:'flex',alignItems:'center',gap:6,
                  background:themeId===ct.id?ct.bg:T.surface,
                  border:`2px solid ${themeId===ct.id?ct.accent:T.border}`,
                  color:themeId===ct.id?ct.text:T.textMid,
                  borderRadius:7,padding:'7px 10px',cursor:'pointer',fontSize:11,
                }}>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:ct.accent,flexShrink:0 }}/>
                  {ct.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Display format */}
          <Card>
            <SectionHead title="Value Format" sub="How to show P&L"/>
            <div style={{ display:'flex',gap:5 }}>
              {[{v:'value',l:'$ Value'},{v:'pct',l:'% Return'},{v:'both',l:'Both'}].map(o=>(
                <button key={o.v} onClick={()=>setDispMode(o.v)} style={{
                  flex:1,padding:'8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:500,
                  background:dispMode===o.v?T.accentDim:T.surface,
                  border:`1px solid ${dispMode===o.v?T.accent:T.border}`,
                  color:dispMode===o.v?T.accent:T.muted,
                }}>{o.l}</button>
              ))}
            </div>
          </Card>

          <Btn variant="accent" onClick={downloadCard} style={{ padding:'12px',fontSize:13,width:'100%',textAlign:'center' }}>↓ Download PNG</Btn>
        </div>

        {/* Card preview */}
        <div>
          <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:10 }}>Preview</div>
          <div ref={cardRef} style={{
            background:th.bg, border:`1px solid ${th.border}`,
            borderRadius:14, padding:'28px 32px', maxWidth:520,
            minHeight:260, position:'relative', overflow:'hidden',
            fontFamily:'Inter,-apple-system,sans-serif',
          }}>
            {/* Glow */}
            <div style={{ position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${th.accent}22 0%,transparent 70%)`,pointerEvents:'none' }}/>
            {/* Logo */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22 }}>
              <div style={{ fontSize:12,fontWeight:700,color:th.accent,letterSpacing:0.5 }}>◈ TRADELENX</div>
              <div style={{ fontSize:9,color:th.text,opacity:0.35 }}>{fmtDate(Date.now())}</div>
            </div>
            <CardContent/>
            {/* Footer */}
            <div style={{ marginTop:22,paddingTop:12,borderTop:`1px solid ${th.border}33`,display:'flex',justifyContent:'space-between' }}>
              <div style={{ fontSize:8,color:th.text,opacity:0.25,textTransform:'uppercase',letterSpacing:1 }}>Perpetual Futures · USDT</div>
              <div style={{ fontSize:8,color:th.text,opacity:0.25 }}>Not financial advice</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
