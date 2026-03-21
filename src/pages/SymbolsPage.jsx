import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Badge, KpiCard, ChartTooltip, ProgressBar, Select } from '../components/UI'

const PERIOD_OPTS = [
  {value:'all',    label:'All Time'},
  {value:'weekly', label:'Weekly'},
  {value:'monthly',label:'Monthly'},
  {value:'quarterly',label:'Quarterly'},
  {value:'yearly', label:'Yearly'},
]

export default function SymbolsPage({ trades, stats }) {
  const [selected,  setSelected]  = useState(null)
  const [sortBy,    setSortBy]    = useState('pnl')
  const [filterMin, setFilterMin] = useState(0)
  const [chartPeriod, setChartPeriod] = useState('monthly')

  const SORT_OPTIONS = [
    {value:'pnl',    label:'Sort: Gross P&L'},
    {value:'netPnl', label:'Sort: Net P&L'},
    {value:'count',  label:'Sort: Trades'},
    {value:'wr',     label:'Sort: Win Rate'},
    {value:'fees',   label:'Sort: Fees'},
    {value:'maxDD',  label:'Sort: Drawdown'},
  ]

  const symData = useMemo(() => {
    return (stats.symbolArr || []).map(sym => {
      const symTrades = trades.filter(t => t.symbol === sym.sym).sort((a,b)=>a.time-b.time)
      const winners   = symTrades.filter(t => t.pnl > 0)
      const losers    = symTrades.filter(t => t.pnl < 0)

      let cum = 0, dsPeak = 0, maxDD = 0
      const curve = symTrades.map(t => {
        cum += t.pnl
        if (cum > dsPeak) dsPeak = cum
        const dd = dsPeak > 0 ? (dsPeak-cum)/dsPeak*100 : 0
        if (dd > maxDD) maxDD = dd
        return { cum:+cum.toFixed(2), pnl:t.pnl }
      })

      // Period breakdown
      const buildPeriod = (keyFn) => {
        const map = {}
        symTrades.forEach(t => {
          const k = keyFn(t)
          if (!map[k]) map[k] = {label:k,pnl:0,count:0,wins:0,ts:t.time}
          map[k].pnl+=t.pnl; map[k].count++
          if(t.pnl>0) map[k].wins++
        })
        return Object.values(map).sort((a,b)=>a.ts-b.ts)
      }
      const periods = {
        all:     curve.map((c,i)=>({label:String(i+1),...c})),
        weekly:  buildPeriod(t=>{ const d=new Date(t.time),j=new Date(d.getFullYear(),0,1),w=Math.ceil(((d-j)/86400000+j.getDay()+1)/7); return `W${w}` }),
        monthly: buildPeriod(t=>new Date(t.time).toLocaleDateString('en-US',{month:'short',year:'2-digit'})),
        quarterly: buildPeriod(t=>{ const d=new Date(t.time); return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}` }),
        yearly:  buildPeriod(t=>String(new Date(t.time).getFullYear())),
      }

      const longTrades  = symTrades.filter(t=>t.side==='BUY')
      const shortTrades = symTrades.filter(t=>t.side==='SELL')
      const leverages   = symTrades.map(t=>t.leverage||1)

      return {
        ...sym,
        symTrades, winners, losers, curve, periods, maxDD:+maxDD.toFixed(2),
        netPnl: +(sym.pnl - sym.fees).toFixed(2),
        avgWin:  winners.length ? +(winners.reduce((s,t)=>s+t.pnl,0)/winners.length).toFixed(2) : 0,
        avgLoss: losers.length  ? +(Math.abs(losers.reduce((s,t)=>s+t.pnl,0)/losers.length)).toFixed(2) : 0,
        maxWin:  symTrades.length ? Math.max(...symTrades.map(t=>t.pnl)) : 0,
        maxLoss: symTrades.length ? Math.min(...symTrades.map(t=>t.pnl)) : 0,
        longTrades, shortTrades,
        longPnl:  +longTrades.reduce((s,t)=>s+t.pnl,0).toFixed(2),
        shortPnl: +shortTrades.reduce((s,t)=>s+t.pnl,0).toFixed(2),
        longWR:   longTrades.length ? +(longTrades.filter(t=>t.pnl>0).length/longTrades.length*100).toFixed(1) : 0,
        shortWR:  shortTrades.length? +(shortTrades.filter(t=>t.pnl>0).length/shortTrades.length*100).toFixed(1) : 0,
        avgLev:   leverages.length ? +(leverages.reduce((a,b)=>a+b,0)/leverages.length).toFixed(1) : 1,
        rr:       losers.length&&winners.length ? +((winners.reduce((s,t)=>s+t.pnl,0)/winners.length)/Math.abs(losers.reduce((s,t)=>s+t.pnl,0)/losers.length)).toFixed(2) : '∞',
        best3:    [...symTrades].sort((a,b)=>b.pnl-a.pnl).slice(0,3),
        worst3:   [...symTrades].sort((a,b)=>a.pnl-b.pnl).slice(0,3),
      }
    })
  }, [trades, stats.symbolArr])

  const sorted = [...symData].filter(s=>s.count>=filterMin).sort((a,b)=>{
    if (sortBy==='wr') return parseFloat(b.wr)-parseFloat(a.wr)
    return (b[sortBy]||0)-(a[sortBy]||0)
  })

  const sel = symData.find(s=>s.sym===selected)
  const maxAbsPnl = Math.max(1,...symData.map(s=>Math.abs(s.pnl)))

  const periodChartData = sel ? (sel.periods[chartPeriod]||[]) : []

  return (
    <div className="page-enter" style={{ padding:'24px 28px',fontFamily:'Inter,-apple-system,sans-serif' }}>
      <div style={{ marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Symbol Breakdown</div>
            <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Symbol Analysis</div>
            <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>{symData.length} symbols · click any for deep-dive</div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ fontSize:11 }}/>
            <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:T.muted }}>
              Min trades:
              <input type="number" value={filterMin} min={0} onChange={e=>setFilterMin(+e.target.value)}
                style={{ width:46,background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 8px',color:T.text,fontFamily:'JetBrains Mono,monospace',fontSize:11,outline:'none' }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Symbol cards grid — always full width */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10,marginBottom:sel?16:0 }}>
        {sorted.map(sym=>(
          <div key={sym.sym} onClick={()=>setSelected(sym.sym===selected?null:sym.sym)} style={{
            background:selected===sym.sym?T.accentDim:T.card,
            border:`1px solid ${selected===sym.sym?T.accent:colorPnL(sym.pnl)+'44'}`,
            borderRadius:10,padding:'14px',cursor:'pointer',transition:'all 0.12s',
          }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:700,fontSize:14 }}>{sym.sym.replace('USDT','')}<span style={{ color:T.muted,fontSize:10 }}>/USDT</span></div>
                <div style={{ fontSize:10,color:T.muted,marginTop:1 }}>{sym.count} trades · {sym.wr}% WR</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700,fontSize:13,color:colorPnL(sym.pnl),fontFamily:'JetBrains Mono,monospace' }}>{sym.pnl>=0?'+$':'-$'}{fmt(Math.abs(sym.pnl))}</div>
                <div style={{ fontSize:10,color:T.red }}>-${fmt(sym.fees)} fees</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={44}>
              <AreaChart data={sym.curve}>
                <defs><linearGradient id={`sg${sym.sym}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorPnL(sym.pnl)} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={colorPnL(sym.pnl)} stopOpacity={0}/>
                </linearGradient></defs>
                <ReferenceLine y={0} stroke={T.muted} strokeDasharray="2 2"/>
                <Area type="monotone" dataKey="cum" stroke={colorPnL(sym.pnl)} fill={`url(#sg${sym.sym})`} strokeWidth={1.5} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginTop:8 }}>
              {[
                {l:'Net',  v:(sym.netPnl>=0?'+$':'-$')+fmt(Math.abs(sym.netPnl)), c:colorPnL(sym.netPnl)},
                {l:'R:R',  v:sym.rr+'x',  c:parseFloat(sym.rr)>=1.5?T.green:T.red},
                {l:'DD',   v:fmt(sym.maxDD)+'%', c:T.red},
              ].map(r=>(
                <div key={r.l} style={{ textAlign:'center',background:T.surface,borderRadius:5,padding:'4px 2px' }}>
                  <div style={{ fontSize:8,color:T.muted,textTransform:'uppercase' }}>{r.l}</div>
                  <div style={{ fontSize:10,fontWeight:600,color:r.c,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
                </div>
              ))}
            </div>
            <ProgressBar value={Math.abs(sym.pnl)} max={maxAbsPnl} color={colorPnL(sym.pnl)} height={3} />
          </div>
        ))}
      </div>

      {/* Detail panel BELOW the grid */}
      {sel && (
        <div style={{ display:'flex',flexDirection:'column',gap:12,marginTop:4 }}>
          {/* Header */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',background:T.card,borderRadius:10,border:`1px solid ${T.accentGlow}` }}>
            <div>
              <div style={{ fontSize:20,fontWeight:700,letterSpacing:-0.3 }}>{sel.sym.replace('USDT','')}<span style={{ color:T.muted,fontSize:12 }}>/USDT</span></div>
              <div style={{ fontSize:11,color:T.muted,marginTop:2 }}>{sel.count} total trades · avg leverage {sel.avgLev}x</div>
            </div>
            <button onClick={()=>setSelected(null)} style={{ background:T.surface,border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:12 }}>✕ Close</button>
          </div>

          {/* 12-stat grid */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8 }}>
            {[
              {l:'Gross P&L', v:(sel.pnl>=0?'+$':'-$')+fmt(Math.abs(sel.pnl)),         c:colorPnL(sel.pnl)},
              {l:'Net P&L',   v:(sel.netPnl>=0?'+$':'-$')+fmt(Math.abs(sel.netPnl)),    c:colorPnL(sel.netPnl)},
              {l:'Total Fees',v:'-$'+fmt(sel.fees),                                       c:T.red},
              {l:'Win Rate',  v:sel.wr+'%',                                               c:parseFloat(sel.wr)>=50?T.green:T.red},
              {l:'R:R',       v:sel.rr+'x',                                               c:parseFloat(sel.rr)>=1.5?T.green:T.red},
              {l:'Max DD',    v:fmt(sel.maxDD)+'%',                                       c:T.red},
              {l:'Avg Win',   v:'+$'+fmt(sel.avgWin),                                    c:T.green},
              {l:'Avg Loss',  v:'-$'+fmt(sel.avgLoss),                                   c:T.red},
              {l:'Best Trade',v:'+$'+fmt(sel.maxWin),                                    c:T.green},
              {l:'Worst Trade',v:'-$'+fmt(Math.abs(sel.maxLoss)),                        c:T.red},
              {l:'Avg Lev',   v:sel.avgLev+'x',                                          c:sel.avgLev>=10?T.red:T.accent},
              {l:'Avg P&L',   v:(sel.avgPnl>=0?'+$':'-$')+fmt(Math.abs(sel.avgPnl)),    c:colorPnL(sel.avgPnl)},
            ].map(r=>(
              <div key={r.l} style={{ background:T.surface,borderRadius:8,padding:'10px 12px',border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
                <div style={{ fontSize:14,fontWeight:700,color:r.c,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
              </div>
            ))}
          </div>

          {/* Long vs Short */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
            {[
              {side:'LONG',  trades:sel.longTrades,  pnl:sel.longPnl,  wr:sel.longWR,  c:T.blue},
              {side:'SHORT', trades:sel.shortTrades, pnl:sel.shortPnl, wr:sel.shortWR, c:T.purple},
            ].map(s=>(
              <div key={s.side} style={{ background:T.surface,borderRadius:8,padding:'12px 16px',border:`1px solid ${s.c}33` }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11,color:s.c,fontWeight:600,marginBottom:4 }}>{s.side} ({s.trades.length} trades)</div>
                    <div style={{ fontSize:18,fontWeight:700,color:colorPnL(s.pnl),fontFamily:'JetBrains Mono,monospace' }}>{s.pnl>=0?'+$':'-$'}{fmt(Math.abs(s.pnl))}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11,color:T.muted,marginBottom:2 }}>Win Rate</div>
                    <div style={{ fontSize:16,fontWeight:700,color:parseFloat(s.wr)>=50?T.green:T.red }}>{fmt(s.wr)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            {/* Cum PnL chart */}
            <Card>
              <SectionHead title="Cumulative P&L" sub="Trade-by-trade"/>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={sel.curve} margin={{left:4,right:4,top:4,bottom:4}}>
                  <defs><linearGradient id="selG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorPnL(sel.pnl)} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={colorPnL(sel.pnl)} stopOpacity={0}/>
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
                  <XAxis hide/>
                  <YAxis tick={{fill:T.muted,fontSize:9,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={56}/>
                  <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4"/>
                  <Tooltip content={<ChartTooltip formatter={v=>'$'+fmt(v)}/>}/>
                  <Area type="monotone" dataKey="cum" stroke={colorPnL(sel.pnl)} fill="url(#selG)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Period bar chart with dropdown */}
            <Card>
              <SectionHead title="P&L by Period" sub=""
                action={<Select value={chartPeriod} onChange={setChartPeriod} options={PERIOD_OPTS} style={{fontSize:11,padding:'4px 8px'}}/>}/>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={periodChartData} barSize={20} margin={{left:4,right:4,top:4,bottom:4}}>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="label" tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={{stroke:T.border}}/>
                  <YAxis tick={{fill:T.muted,fontSize:9,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={56}/>
                  <ReferenceLine y={0} stroke={T.border}/>
                  <Tooltip content={<ChartTooltip formatter={v=>'$'+fmt(v)}/>}/>
                  <Bar dataKey="pnl" radius={[3,3,0,0]}>
                    {periodChartData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Best & worst trades */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Card>
              <SectionHead title="Best 3 Trades" sub=""/>
              {sel.best3.map((t,i)=>(
                <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.greenDim,borderRadius:6,marginBottom:5,border:`1px solid ${T.green}22` }}>
                  <div style={{ fontSize:11,color:T.textMid }}>{t.side} {fmt(t.qty,4)} @ ${fmt(t.price)}</div>
                  <div style={{ fontSize:12,fontWeight:700,color:T.green,fontFamily:'JetBrains Mono,monospace' }}>+${fmt(t.pnl)}</div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionHead title="Worst 3 Trades" sub=""/>
              {sel.worst3.map((t,i)=>(
                <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.redDim,borderRadius:6,marginBottom:5,border:`1px solid ${T.red}22` }}>
                  <div style={{ fontSize:11,color:T.textMid }}>{t.side} {fmt(t.qty,4)} @ ${fmt(t.price)}</div>
                  <div style={{ fontSize:12,fontWeight:700,color:T.red,fontFamily:'JetBrains Mono,monospace' }}>-${fmt(Math.abs(t.pnl))}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
