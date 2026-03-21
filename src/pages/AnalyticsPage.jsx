import { useState } from 'react'
import {
  ScatterChart, Scatter, AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer, Legend
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt } from '../lib/data'
import { Card, SectionHead, ChartTooltip } from '../components/UI'

export default function AnalyticsPage({ trades, stats }) {
  if (!trades?.length) return null

  // Trade-by-trade waterfall (first 80)
  const waterfallData = trades.slice(0, 80).map((t, i) => ({ i: i+1, pnl: t.pnl, sym: t.symbol }))

  // PnL by leverage
  const byLev = {}
  trades.forEach(t => {
    const k = t.leverage + 'x'
    if (!byLev[k]) byLev[k] = { lev: k, pnl: 0, count: 0, wins: 0 }
    byLev[k].pnl += t.pnl; byLev[k].count++; if (t.pnl > 0) byLev[k].wins++
  })
  const levArr = Object.values(byLev).sort((a,b)=>parseInt(a.lev)-parseInt(b.lev))

  // Win rate by leverage
  const levWR = levArr.map(l => ({ ...l, wr: +(l.wins/l.count*100).toFixed(1) }))

  // Risk % distribution
  const riskBuckets = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(r => ({
    range: r+'%',
    count: trades.filter(t => t.riskPercent <= r && t.riskPercent > r-0.5).length,
    pnl:   trades.filter(t => t.riskPercent <= r && t.riskPercent > r-0.5).reduce((s,t)=>s+t.pnl,0),
  }))

  // PnL distribution histogram
  const pnlVals  = trades.map(t=>t.pnl)
  const minPnl   = Math.min(...pnlVals), maxPnl = Math.max(...pnlVals)
  const buckets  = 20
  const step     = (maxPnl - minPnl) / buckets || 1
  const histogram = Array.from({length:buckets}, (_,i) => {
    const from = minPnl + i*step
    const count = trades.filter(t => t.pnl >= from && t.pnl < from+step).length
    return { label:'$'+from.toFixed(0), from, count, isPos: from >= 0 }
  })

  // Hour heatmap
  const byHour = stats.byHour || []

  // Symbol-wise hourly (top 5 symbols)
  const topSyms = (stats.symbolArr||[]).slice(0,5).map(s=>s.sym)
  const symHourly = topSyms.map(sym => {
    const sT = trades.filter(t=>t.symbol===sym)
    const hours = Array.from({length:24},(_,h) => {
      const ht = sT.filter(t=>new Date(t.time).getHours()===h)
      return { hour:h, pnl: ht.reduce((s,t)=>s+t.pnl,0), count:ht.length }
    })
    return { sym: sym.replace('USDT',''), hours }
  })

  // Consecutive wins/losses streaks chart
  let streak = 0, streaks = []
  trades.forEach((t,i) => {
    if (t.pnl > 0) { streak = streak >= 0 ? streak+1 : 1 }
    else            { streak = streak <= 0 ? streak-1 : -1 }
    streaks.push({ i, streak, sym: t.symbol })
  })

  return (
    <div className="page-enter" style={{ padding:'24px 28px',fontFamily:'var(--font-sans, Inter, sans-serif)' }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Deep Dive</div>
        <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Advanced Analytics</div>
      </div>

      {/* Row 1: Waterfall + PnL Distribution */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
        <Card>
          <SectionHead title="Trade P&L Waterfall" sub="Each trade result"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfallData} barSize={Math.max(3,Math.min(14,600/waterfallData.length))} margin={{left:4,right:4,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="i" tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={{stroke:T.border}}/>
              <YAxis tick={{fill:T.muted,fontSize:9,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={56}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={<ChartTooltip formatter={v=>'$'+fmt(v)}/>}/>
              <Bar dataKey="pnl" radius={[2,2,0,0]} name="P&L">
                {waterfallData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red} opacity={0.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead title="P&L Distribution" sub="Trade outcome histogram"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histogram} barSize={16} margin={{left:4,right:4,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={{stroke:T.border}} interval={4}/>
              <YAxis tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={false} width={32}/>
              <ReferenceLine x={0} stroke={T.muted} strokeDasharray="3 3"/>
              <Tooltip content={<ChartTooltip formatter={(v,n)=>[v+' trades','']}/>}/>
              <Bar dataKey="count" radius={[2,2,0,0]}>
                {histogram.map((d,i)=><Cell key={i} fill={d.isPos?T.green:T.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2: PnL by Leverage + Win Rate by Leverage */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
        <Card>
          <SectionHead title="P&L by Leverage" sub="Risk vs reward by leverage used"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levArr} barSize={28} margin={{left:4,right:4,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="lev" tick={{fill:T.muted,fontSize:11}} tickLine={false} axisLine={{stroke:T.border}}/>
              <YAxis tick={{fill:T.muted,fontSize:9,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={60}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={<ChartTooltip formatter={(v,n)=>n==='pnl'?'$'+fmt(v):v+' trades'}/>}/>
              <Bar dataKey="pnl" radius={[4,4,0,0]} name="pnl">
                {levArr.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead title="Win Rate by Leverage" sub="Are higher leverage trades less disciplined?"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levWR} barSize={28} margin={{left:4,right:4,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="lev" tick={{fill:T.muted,fontSize:11}} tickLine={false} axisLine={{stroke:T.border}}/>
              <YAxis tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={false} tickFormatter={v=>v+'%'} domain={[0,100]} width={40}/>
              <ReferenceLine y={50} stroke={T.muted} strokeDasharray="4 4"/>
              <Tooltip content={<ChartTooltip formatter={v=>fmt(v)+'%'}/>}/>
              <Bar dataKey="wr" radius={[4,4,0,0]} name="Win Rate">
                {levWR.map((d,i)=><Cell key={i} fill={d.wr>=50?T.green:T.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 3: Streak chart */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="Win / Loss Streak Timeline" sub="Positive = win streak, negative = loss streak"/>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={streaks} barSize={Math.max(2,Math.min(8,600/streaks.length))} margin={{left:4,right:4,top:4,bottom:4}}>
            <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
            <XAxis dataKey="i" hide/>
            <YAxis tick={{fill:T.muted,fontSize:9}} tickLine={false} axisLine={false} width={30}/>
            <ReferenceLine y={0} stroke={T.border}/>
            <Tooltip content={<ChartTooltip formatter={(v,n)=>[Math.abs(v)+(v>=0?' win streak':' loss streak'),'']}/>}/>
            <Bar dataKey="streak" radius={[1,1,0,0]}>
              {streaks.map((d,i)=><Cell key={i} fill={d.streak>=0?T.green:T.red} opacity={0.85}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Row 4: 24hr heatmap */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="24-Hour P&L Heatmap" sub="Best and worst hours to trade"/>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(24,1fr)',gap:4,alignItems:'end' }}>
          {byHour.map((h,i) => {
            const maxAbs = Math.max(1,...byHour.map(x=>Math.abs(x.pnl)))
            const intensity = maxAbs ? Math.abs(h.pnl)/maxAbs : 0
            return (
              <div key={i} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
                <div style={{ fontSize:8,color:colorPnL(h.pnl),fontWeight:700,height:16,display:'flex',alignItems:'flex-end' }}>
                  {h.count > 0 ? (Math.abs(h.pnl)>=100?(h.pnl>=0?'+':'−')+fmt(Math.abs(h.pnl)/1000,1)+'k':(h.pnl>=0?'+':'')+fmt(h.pnl,0)) : ''}
                </div>
                <div style={{
                  width:'100%',borderRadius:'3px 3px 0 0',
                  height: Math.max(6,intensity*120),
                  background: h.count===0 ? T.surface : h.pnl>=0
                    ? `rgba(34,197,94,${0.15+intensity*0.85})`
                    : `rgba(239,68,68,${0.15+intensity*0.85})`,
                  border:`1px solid ${T.border}`,
                  transition:'height 0.4s ease',
                }}/>
                <div style={{ fontSize:8,color:T.muted,transform:'rotate(-45deg)',transformOrigin:'center',marginTop:6 }}>{i}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize:10,color:T.muted,textAlign:'center',marginTop:20 }}>Hour of day (local time)</div>
      </Card>

      {/* Row 5: Risk breakdown */}
      <Card>
        <SectionHead title="Risk % Breakdown" sub="Performance by risk per trade"/>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {['Risk Range','Trades','Total P&L','Avg P&L / Trade','Win Rate'].map(h=>(
                <th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:9,color:T.muted,letterSpacing:1.2,textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riskBuckets.filter(r=>r.count>0).map((r,i)=>{
              const rTrades = trades.filter(t => t.riskPercent <= parseFloat(r.range) && t.riskPercent > parseFloat(r.range)-0.5)
              const rWins   = rTrades.filter(t=>t.pnl>0).length
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface+'44' }}>
                  <td style={{ padding:'9px 12px',fontWeight:600,color:T.accent }}>{r.range}</td>
                  <td style={{ padding:'9px 12px',color:T.textMid }}>{r.count}</td>
                  <td style={{ padding:'9px 12px',fontWeight:700,color:colorPnL(r.pnl),fontFamily:'JetBrains Mono,monospace' }}>{r.pnl>=0?'+$':'-$'}{fmt(Math.abs(r.pnl))}</td>
                  <td style={{ padding:'9px 12px',color:colorPnL(r.pnl/r.count),fontFamily:'JetBrains Mono,monospace' }}>{r.pnl/r.count>=0?'+$':'-$'}{fmt(Math.abs(r.pnl/r.count))}</td>
                  <td style={{ padding:'9px 12px',color:rTrades.length&&rWins/rTrades.length>=0.5?T.green:T.red }}>{rTrades.length?fmt(rWins/rTrades.length*100,1)+'%':'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
