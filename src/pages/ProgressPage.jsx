import { useState, useMemo } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ComposedChart, Line, Legend
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtPct } from '../lib/data'
import { Card, SectionHead, KpiCard, ProgressBar, ChartTooltip } from '../components/UI'

const DEFAULT_GOALS = {
  monthlyTarget:  500,
  winRateTarget:  55,
  maxDDTarget:    15,
  rrTarget:       1.5,
  tradesPerMonth: 30,
}

function GoalBar({ label, current, target, unit='$', invert=false }) {
  const pct  = target > 0 ? Math.min(100, Math.abs(current)/Math.abs(target)*100) : 0
  const good = invert ? current <= target : current >= target
  const c    = good ? T.green : pct > 60 ? T.accent : T.red
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
        <span style={{ fontSize:12,color:T.textMid,fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:12,fontFamily:T.fontMono }}>
          <span style={{ color:c,fontWeight:700 }}>{unit==='$'?'$':''}{fmt(current,2)}{unit!=='$'?unit:''}</span>
          <span style={{ color:T.muted }}> / {unit==='$'?'$':''}{fmt(target)}{unit!=='$'?unit:''}</span>
        </span>
      </div>
      <div style={{ height:6,background:T.surface,borderRadius:3,overflow:'hidden',border:`1px solid ${T.border}` }}>
        <div style={{ width:pct+'%',height:'100%',background:c,borderRadius:3,transition:'width 0.6s ease' }}/>
      </div>
      <div style={{ fontSize:9,color:good?T.green:T.muted,textAlign:'right',marginTop:3 }}>
        {good ? '✓ Target met' : fmt(pct,0)+'% of target'}
      </div>
    </div>
  )
}

export default function ProgressPage({ trades, stats }) {
  const [goals,   setGoals]   = useState(() => { try { return {...DEFAULT_GOALS,...JSON.parse(localStorage.getItem('tlx_goals')||'{}')} } catch { return DEFAULT_GOALS } })
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({ ...DEFAULT_GOALS, ...goals })
  const g = goals

  const saveGoals = () => {
    const saved = { ...DEFAULT_GOALS, ...form }
    localStorage.setItem('tlx_goals', JSON.stringify(saved))
    setGoals(saved); setEditing(false)
  }

  // ── Current month stats — pull directly from stats.monthlyArr ──────────────
  const now         = new Date()
  const curMonthKey = now.toLocaleDateString('en-US', { month:'short', year:'2-digit' })
  const monthlyArr  = stats.monthlyArr || []

  // Find current month — if not found (no trades this month), show zeros
  const curMonth = useMemo(() => {
    const found = monthlyArr.find(m => m.m === curMonthKey || m.label === curMonthKey)
    return found || { pnl:0, trades:0, wr:0, fees:0, netPnl:0 }
  }, [monthlyArr, curMonthKey])

  // Net PnL for current month
  const curMonthNet = useMemo(() => {
    const found = monthlyArr.find(m => m.m === curMonthKey || m.label === curMonthKey)
    return found ? (found.netPnl ?? found.pnl - (found.fees||0)) : 0
  }, [monthlyArr, curMonthKey])

  // All months data for charts
  const last6 = monthlyArr.slice(-6)
  const allMonths = monthlyArr

  // Monthly P&L + trades combined chart data
  const monthlyChartData = useMemo(() => allMonths.map(m => ({
    label:  m.m || m.label || '',
    pnl:    +(m.pnl||0).toFixed(2),
    netPnl: +(m.netPnl ?? (m.pnl||0)-(m.fees||0)).toFixed(2),
    trades: m.trades || 0,
    wr:     m.wr || 0,
    fees:   +(m.fees||0).toFixed(2),
    met:    (m.pnl||0) >= g.monthlyTarget,
  })), [allMonths, g.monthlyTarget])

  // ── Score ──────────────────────────────────────────────────────────────────
  const winRate  = stats.winRate  || 0
  const rr       = parseFloat(stats.rr) || 0
  const maxDD    = stats.maxDD    || 0
  const score    = Math.round(
    Math.min(25, winRate/g.winRateTarget * 25) +
    Math.min(25, rr/g.rrTarget * 25) +
    Math.min(25, curMonthNet>0 ? Math.min(1,curMonthNet/g.monthlyTarget)*25 : 0) +
    Math.max(0, 25 - maxDD/g.maxDDTarget * 25)
  )
  const scoreColor = score>=75?T.green:score>=50?T.accent:T.red

  // ── Total return: netPnL / startEquity ──────────────────────────────────────
  const totalReturn = useMemo(() => {
    if (!stats.startEquity || stats.startEquity <= 0) return 0
    return (stats.netPnL / stats.startEquity) * 100
  }, [stats.netPnL, stats.startEquity])

  if (!trades?.length) return <div style={{ padding:32,color:T.muted }}>No trade data.</div>

  return (
    <div className="page-enter" style={{ padding:'24px 28px',fontFamily:'Inter,-apple-system,sans-serif' }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Progress Tracker</div>
            <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Goals & Progress</div>
          </div>
          <button onClick={()=>setEditing(e=>!e)} style={{ background:editing?T.accentDim:T.surface,border:`1px solid ${editing?T.accent:T.border}`,color:editing?T.accent:T.textMid,borderRadius:7,padding:'7px 16px',cursor:'pointer',fontSize:12,fontWeight:500 }}>
            {editing?'Cancel':'⚙ Edit Goals'}
          </button>
        </div>
      </div>

      {/* Edit Goals */}
      {editing && (
        <Card style={{ marginBottom:16 }} glow>
          <SectionHead title="Set Your Goals" sub="Customise targets"/>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14 }}>
            {[
              {key:'monthlyTarget',  label:'Monthly P&L Target ($)', min:10},
              {key:'winRateTarget',  label:'Win Rate Goal (%)',       min:40,max:90},
              {key:'maxDDTarget',    label:'Max Drawdown Limit (%)',  min:5, max:50},
              {key:'rrTarget',       label:'Min Risk/Reward',         min:0.5,max:10,step:0.1},
              {key:'tradesPerMonth', label:'Trades per Month',        min:1},
            ].map(({key,label,min,max,step})=>(
              <div key={key}>
                <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{label}</div>
                <input type="number" value={form[key]} min={min} max={max} step={step||1}
                  onChange={e=>setForm(f=>({...f,[key]:+e.target.value}))}
                  style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',color:T.text,fontFamily:'JetBrains Mono,monospace',fontSize:13,outline:'none' }}/>
              </div>
            ))}
          </div>
          <button onClick={saveGoals} style={{ background:T.accent,color:'#000',border:'none',borderRadius:7,padding:'9px 24px',cursor:'pointer',fontWeight:600,fontSize:13 }}>Save Goals</button>
        </Card>
      )}

      {/* Score + This month */}
      <div style={{ display:'grid',gridTemplateColumns:'180px 1fr',gap:14,marginBottom:14 }}>
        <Card style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'20px 16px' }}>
          <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:8 }}>Score</div>
          <div style={{ fontSize:52,fontWeight:700,color:scoreColor,fontFamily:'JetBrains Mono,monospace',lineHeight:1 }}>{score}</div>
          <div style={{ fontSize:11,color:T.muted,marginTop:3 }}>out of 100</div>
          <div style={{ marginTop:10,width:'100%',height:5,background:T.surface,borderRadius:3,overflow:'hidden' }}>
            <div style={{ width:score+'%',height:'100%',background:`linear-gradient(90deg,${T.red},${T.accent},${T.green})`,borderRadius:3,transition:'width 0.8s ease' }}/>
          </div>
          <div style={{ marginTop:8,fontSize:11,color:scoreColor,fontWeight:600 }}>
            {score>=75?'Excellent':score>=60?'Good':score>=45?'Developing':'Needs Work'}
          </div>
        </Card>

        <Card>
          <SectionHead title={`${curMonthKey} — This Month`} sub="Current progress"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12 }}>
            {[
              {l:'Gross P&L',   v:(curMonth.pnl>=0?'+$':'-$')+fmt(Math.abs(curMonth.pnl),2),    c:colorPnL(curMonth.pnl)},
              {l:'Net P&L',     v:(curMonthNet>=0?'+$':'-$')+fmt(Math.abs(curMonthNet),2),        c:colorPnL(curMonthNet)},
              {l:'Trades',      v:curMonth.trades,                                                c:T.text},
              {l:'Win Rate',    v:fmt(curMonth.wr,1)+'%',                                         c:parseFloat(curMonth.wr)>=50?T.green:T.red},
              {l:'Fees',        v:'-$'+fmt(curMonth.fees||0,2),                                   c:T.red},
              {l:'Target',      v:'$'+fmt(g.monthlyTarget),                                       c:T.accent},
            ].map(r=>(
              <div key={r.l} style={{ background:T.surface,borderRadius:7,padding:'9px 11px',border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:8,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
                <div style={{ fontSize:14,fontWeight:700,color:r.c,fontFamily:'JetBrains Mono,monospace' }}>{r.v}</div>
              </div>
            ))}
          </div>
          <GoalBar label="Monthly Net P&L"  current={curMonthNet}  target={g.monthlyTarget}/>
          <GoalBar label="Win Rate"          current={winRate}       target={g.winRateTarget} unit="%"/>
          <GoalBar label="Risk/Reward"       current={rr}            target={g.rrTarget}       unit="x"/>
          <GoalBar label="Drawdown (lower=better)" current={maxDD}  target={g.maxDDTarget}    unit="%" invert/>
        </Card>
      </div>

      {/* Monthly P&L vs Target chart */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="Monthly P&L vs Target" sub="Gross P&L per month"/>
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChartData} barSize={Math.max(8,Math.min(28,500/monthlyChartData.length))} margin={{left:8,right:8,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.muted,fontSize:10}} tickLine={false} axisLine={{stroke:T.border}}/>
              <YAxis tick={{fill:T.muted,fontSize:10,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={65}/>
              <ReferenceLine y={g.monthlyTarget} stroke={T.accent} strokeDasharray="5 3" label={{value:'Target',fill:T.accent,fontSize:9,position:'right'}}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={({active,payload,label}) => {
                if (!active||!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 13px',fontFamily:'JetBrains Mono,monospace',fontSize:11 }}>
                    <div style={{ color:T.muted,marginBottom:5,fontWeight:600 }}>{label}</div>
                    <div style={{ color:colorPnL(d.pnl) }}>Gross: {d.pnl>=0?'+$':'-$'}{fmt(Math.abs(d.pnl),2)}</div>
                    <div style={{ color:colorPnL(d.netPnl) }}>Net: {d.netPnl>=0?'+$':'-$'}{fmt(Math.abs(d.netPnl),2)}</div>
                    <div style={{ color:T.red }}>Fees: -${fmt(d.fees,2)}</div>
                    <div style={{ color:T.muted }}>Trades: {d.trades} · WR: {fmt(d.wr,1)}%</div>
                  </div>
                )
              }}/>
              <Bar dataKey="pnl" radius={[3,3,0,0]} isAnimationActive animationDuration={600}>
                {monthlyChartData.map((d,i)=><Cell key={i} fill={d.met?T.green:d.pnl>=0?T.accent:T.red} opacity={0.9}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ color:T.muted,fontSize:12,padding:'28px 0',textAlign:'center' }}>No monthly data yet</div>}
        <div style={{ display:'flex',gap:14,marginTop:8,flexWrap:'wrap' }}>
          {[{c:T.green,l:`Met target (${monthlyChartData.filter(m=>m.met).length})`},{c:T.accent,l:'Profit, below target'},{c:T.red,l:'Loss month'}].map(l=>(
            <div key={l.l} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <div style={{ width:10,height:10,borderRadius:2,background:l.c }}/>
              <span style={{ fontSize:10,color:T.muted }}>{l.l}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* NEW: Monthly P&L + Trade Count combined chart */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="Monthly Activity — P&L & Trades" sub="Combined view"/>
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthlyChartData} margin={{left:8,right:40,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.muted,fontSize:10}} tickLine={false} axisLine={{stroke:T.border}}/>
              <YAxis yAxisId="pnl" tick={{fill:T.muted,fontSize:10,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={65}/>
              <YAxis yAxisId="trades" orientation="right" tick={{fill:T.muted,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>v+'t'} width={32}/>
              <ReferenceLine yAxisId="pnl" y={0} stroke={T.border}/>
              <Tooltip content={({active,payload,label}) => {
                if (!active||!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 13px',fontFamily:'JetBrains Mono,monospace',fontSize:11 }}>
                    <div style={{ color:T.muted,marginBottom:4 }}>{label}</div>
                    <div style={{ color:colorPnL(d.pnl) }}>P&L: {d.pnl>=0?'+$':'-$'}{fmt(Math.abs(d.pnl),2)}</div>
                    <div style={{ color:T.blue }}>Trades: {d.trades}</div>
                    <div style={{ color:d.wr>=50?T.green:T.red }}>WR: {fmt(d.wr,1)}%</div>
                  </div>
                )
              }}/>
              <Legend wrapperStyle={{ fontSize:11,color:T.muted }}/>
              <Bar yAxisId="pnl" dataKey="pnl" name="P&L ($)" radius={[3,3,0,0]} opacity={0.85} isAnimationActive animationDuration={600}>
                {monthlyChartData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red}/>)}
              </Bar>
              <Line yAxisId="trades" type="monotone" dataKey="trades" name="Trades" stroke={T.blue} strokeWidth={2} dot={{ fill:T.blue,r:3 }} activeDot={{ r:5 }}/>
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div style={{ color:T.muted,fontSize:12,padding:'28px 0',textAlign:'center' }}>No data yet</div>}
      </Card>

      {/* Bottom KPIs */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
        <KpiCard label="Total Return"      value={(totalReturn>=0?'+':'')+fmt(totalReturn,2)+'%'} color={colorPnL(totalReturn)} sub={`Net $${fmt(Math.abs(stats.netPnL||0),2)} / Start $${fmt(stats.startEquity||0,0)}`}/>
        <KpiCard label="Best Month"        value={(()=>{const v=Math.max(...monthlyChartData.map(m=>m.pnl));return (v>=0?'+$':'-$')+fmt(Math.abs(v),2)})()}  color={T.green}  sub={monthlyChartData.sort((a,b)=>b.pnl-a.pnl)[0]?.label||'—'}/>
        <KpiCard label="Worst Month"       value={(()=>{const v=Math.min(...monthlyChartData.map(m=>m.pnl));return (v>=0?'+$':'-$')+fmt(Math.abs(v),2)})()}  color={T.red}    sub={monthlyChartData.sort((a,b)=>a.pnl-b.pnl)[0]?.label||'—'}/>
        <KpiCard label="Green Months"      value={`${monthlyChartData.filter(m=>m.pnl>0).length} / ${monthlyChartData.length}`} color={T.blue} sub="Profitable months"/>
      </div>
    </div>
  )
}
