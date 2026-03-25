import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtPct, localDateKey } from '../lib/data'
import { KpiCard, Card, SectionHead, Badge, ProgressBar, ChartTooltip, Select, Btn, Input } from '../components/UI'

const PERIOD_OPTIONS = [
  { value:'weekly',    label:'Weekly'    },
  { value:'monthly',   label:'Monthly'   },
  { value:'quarterly', label:'Quarterly' },
  { value:'yearly',    label:'Yearly'    },
]

function getWinRateColor(winRate = 0) {
  const clamped = Math.max(0, Math.min(100, Number(winRate) || 0))
  if (clamped <= 35) return T.red
  if (clamped >= 65) return T.green
  const progress = (clamped - 35) / 30
  const r = Math.round(239 + (34 - 239) * progress)
  const g = Math.round(68 + (197 - 68) * progress)
  const b = Math.round(68 + (94 - 68) * progress)
  return `rgb(${r}, ${g}, ${b})`
}

export default function DashboardPage({ trades, stats, applyDateRange, dateRange, allTrades }) {
  const [period, setPeriod]   = useState('monthly')
  const [startDate, setStart] = useState('')
  const [endDate,   setEnd]   = useState('')
  const winRateColor = getWinRateColor(stats?.winRate)

  if (!trades?.length) return <div style={{ padding:32,color:T.muted }}>No trade data loaded.</div>

  // Asset value curve = trades equity + overlay cash flow events
const periodData = period==='weekly'    ? stats.weeklyArr?.map(d=>({label:d.label||d.w, ...d}))
    : period==='monthly'   ? stats.monthlyArr?.map(d=>({label:d.label||d.m, ...d}))
    : period==='quarterly' ? stats.quarterlyArr?.map(d=>({label:d.label||d.q, ...d}))
    : stats.yearlyArr?.map(d=>({label:d.label||d.y, ...d}))

  // Radar: each axis 0–100, represents a meaningful trading quality
  const radarData = [
    { metric:'Win Rate',     val: Math.min(100, stats.winRate) },
    { metric:'Risk/Reward',  val: Math.min(100, parseFloat(stats.rr||0) / 3 * 100) },
    { metric:'Consistency',  val: Math.min(100, isFinite(stats.profitFactor) ? Math.min(stats.profitFactor, 3) / 3 * 100 : 100) },
    { metric:'DD Control',   val: Math.max(0, 100 - stats.maxDD * 3) },
    { metric:'Avg Win Size', val: Math.min(100, stats.avgWin > 0 && stats.avgLoss > 0 ? Math.min(stats.avgWin/stats.avgLoss, 3)/3*100 : 50) },
    { metric:'Discipline',   val: Math.max(0, 100 - (stats.maxLossStreak||0) * 8) },
  ]

  const applyRange = () => {
    if (startDate && endDate && applyDateRange)
      applyDateRange(new Date(startDate+'T00:00:00').getTime(), new Date(endDate+'T23:59:59').getTime())
  }
  const clearRange = () => { setStart(''); setEnd(''); applyDateRange && applyDateRange(null,null) }

  return (
    <div className="page-enter" style={{ padding:'24px 28px',fontFamily:T.fontSans }}>

      {/* Header */}
      <div style={{ marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Overview</div>
            <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Dashboard</div>
          </div>
          {/* Date Range Picker */}
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <div style={{ fontSize:11,color:T.muted }}>From</div>
            <input type="date" value={startDate} onChange={e=>setStart(e.target.value)}
              style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 9px',color:T.text,fontFamily:T.fontSans,fontSize:11,outline:'none' }}/>
            <div style={{ fontSize:11,color:T.muted }}>To</div>
            <input type="date" value={endDate} onChange={e=>setEnd(e.target.value)}
              style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 9px',color:T.text,fontFamily:T.fontSans,fontSize:11,outline:'none' }}/>
            <Btn onClick={applyRange} variant="accent" style={{ padding:'5px 12px',fontSize:11 }}>Apply</Btn>
            {dateRange && <Btn onClick={clearRange} style={{ padding:'5px 12px',fontSize:11 }}>✕ Clear</Btn>}
          </div>
        </div>
        {dateRange && <div style={{ marginTop:6,fontSize:11,color:T.accent }}>Filtered: {fmtDate(dateRange.start)} – {fmtDate(dateRange.end)} · {trades.length} trades</div>}
      </div>

      {/* KPI Row 1 */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:10 }}>
        <KpiCard label="Net P&L"       value={(stats.netPnL>=0?'+$':'-$')+fmt(Math.abs(stats.netPnL||0))} color={colorPnL(stats.netPnL||0)} sub="Gross minus fees"/>
        <KpiCard label="Gross P&L"     value={(stats.grossPnL>=0?'+$':'-$')+fmt(Math.abs(stats.grossPnL||0))} color={colorPnL(stats.grossPnL||0)} sub="Before deducting fees"/>
        <KpiCard label="Total Fees"    value={'-$'+fmt(stats.totalFees)} color={T.red} sub="= Gross − Net"/>
        <KpiCard label="Win Rate"      value={fmt(stats.winRate)+'%'} color={winRateColor} sub={`${stats.winners}W / ${stats.losers}L · ${stats.total-(stats.winners+stats.losers)}B`}/>
        <KpiCard label="Max Drawdown"  value={fmt(stats.maxDD)+'%'} color={T.red} sub="From peak (cumPnL)"/>
      </div>

      {/* KPI Row 2 */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:18 }}>
        <KpiCard label="Profit Factor" value={isFinite(stats.profitFactor)?fmt(stats.profitFactor):'∞'} color={stats.profitFactor>=1.5?T.green:T.red} sub="Gross profit ÷ loss"/>
        <KpiCard label="Risk/Reward"   value={stats.rr+'x'} color={parseFloat(stats.rr)>=1.5?T.green:T.red} sub={`Avg W $${fmt(stats.avgWin)} / L $${fmt(stats.avgLoss)}`}/>
        <KpiCard label="Sharpe Ratio"  value={fmt(stats.sharpe)} color={stats.sharpe>=1?T.green:T.red} sub="Risk-adj return"/>
        <KpiCard label="Best Streak"   value={stats.maxWinStreak+'W'} color={T.green} sub="Consecutive wins"/>
        <KpiCard label="Total Trades"  value={stats.total} sub={`${fmtDate(stats.firstDate||0)} – now`}/>
      </div>

      {/* PnL Verification Banner */}
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 16px',marginBottom:14,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap' }}>
        <div style={{ fontSize:11,color:T.muted,fontWeight:500 }}>P&L Breakdown:</div>
        <div style={{ fontSize:12,fontFamily:T.fontMono }}><span style={{ color:T.muted }}>Gross: </span><span style={{ color:colorPnL(stats.grossPnL) }}>{stats.grossPnL>=0?'+$':'-$'}{fmt(Math.abs(stats.grossPnL||0))}</span></div>
        <div style={{ fontSize:12,color:T.muted }}>−</div>
        <div style={{ fontSize:12,fontFamily:T.fontMono }}><span style={{ color:T.muted }}>Fees: </span><span style={{ color:T.red }}>-${fmt(stats.totalFees)}</span></div>
        <div style={{ fontSize:12,color:T.muted }}>=</div>
        <div style={{ fontSize:12,fontFamily:T.fontMono,fontWeight:700 }}><span style={{ color:T.muted }}>Net: </span><span style={{ color:colorPnL(stats.netPnL) }}>{stats.netPnL>=0?'+$':'-$'}{fmt(Math.abs(stats.netPnL||0))}</span></div>
        <div style={{ marginLeft:'auto',fontSize:11,color:T.muted }}>Check: {Math.abs((stats.grossPnL||0)-(stats.totalFees||0)-(stats.netPnL||0))<0.01?'✓ Balanced':'⚠ Rounding diff'}</div>
      </div>

      {/* Cumulative PnL + Drawdown side by side */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
        <Card>
          <SectionHead title="Cumulative P&L" sub="Net running total"/>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.equityCurve||[]} margin={{ left:4,right:4,top:4,bottom:4 }}>
              <defs>
                <linearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={T.green} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="i" hide/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>(v>=0?'+$':'-$')+fmt(Math.abs(v),0)} width={68}/>
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4"/>
              <Tooltip content={<ChartTooltip formatter={v=>(v>=0?'+$':'-$')+fmt(Math.abs(v))}/>}/>
              <Area type="monotone" dataKey="cumPnL" stroke={T.green} fill="url(#cpGrad)" strokeWidth={2} dot={false} name="Cum P&L"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead title="Drawdown Chart" sub="Risk exposure"/>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.drawdownSeries||[]} margin={{ left:4,right:4,top:4,bottom:4 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.red} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={T.red} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="i" hide/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>v.toFixed(1)+'%'} width={52}/>
              <Tooltip content={<ChartTooltip formatter={v=>fmt(v)+'%'}/>}/>
              <Area type="monotone" dataKey="dd" stroke={T.red} fill="url(#ddGrad)" strokeWidth={2} dot={false} name="Drawdown"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Period Performance */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title={`${PERIOD_OPTIONS.find(p=>p.value===period)?.label} Performance`} sub="P&L by Period"
          action={<Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} style={{ fontSize:11,padding:'4px 10px' }}/>}/>
        {periodData?.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={periodData} barSize={Math.max(8,Math.min(28,200/periodData.length))} margin={{ left:8,right:8,top:4,bottom:4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{ fill:T.muted,fontSize:10 }} tickLine={false} axisLine={{ stroke:T.border }}/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>(v>=0?'+':'')+fmt(v,0)} width={60}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={({ active,payload,label }) => {
                if (!active||!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 14px',fontFamily:T.fontMono,fontSize:11 }}>
                    <div style={{ color:T.muted,marginBottom:5 }}>{label}</div>
                    <div style={{ color:colorPnL(d?.pnl) }}>Gross: {d?.pnl>=0?'+$':'-$'}{fmt(Math.abs(d?.pnl))}</div>
                    <div style={{ color:T.red }}>Fees: -${fmt(d?.fees)}</div>
                    <div style={{ color:colorPnL(d?.netPnl),fontWeight:700 }}>Net: {d?.netPnl>=0?'+$':'-$'}{fmt(Math.abs(d?.netPnl))}</div>
                    <div style={{ color:T.muted,marginTop:4 }}>Trades: {d?.trades} · WR: {d?.wr}%</div>
                  </div>
                )
              }}/>
              <Bar dataKey="pnl" name="Gross P&L" radius={[3,3,0,0]}>
                {(periodData||[]).map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red} opacity={0.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ color:T.muted,fontSize:12,padding:'28px 0',textAlign:'center' }}>No data</div>}
      </Card>

      {/* Day of Week Analysis */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="Day of Week Analysis" sub="Performance by Weekday"/>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.byDay} barSize={22} margin={{ left:8,right:8,top:4,bottom:4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="short" tick={{ fill:T.muted,fontSize:10 }} tickLine={false} axisLine={{ stroke:T.border }}/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>fmt(v,0)} width={52}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={({ active,payload }) => {
                if (!active||!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 14px',fontFamily:T.fontMono,fontSize:11 }}>
                    <div style={{ color:T.accent,marginBottom:5,fontWeight:600 }}>{d.day}</div>
                    <div style={{ color:colorPnL(d.pnl) }}>P&L: {d.pnl>=0?'+$':'-$'}{fmt(Math.abs(d.pnl))}</div>
                    <div style={{ color:T.muted }}>Trades: {d.count}</div>
                    <div style={{ color:d.count>0&&d.wins/d.count>=0.5?T.green:T.red }}>WR: {d.count>0?fmt(d.wins/d.count*100):'—'}%</div>
                  </div>
                )
              }}/>
              <Bar dataKey="pnl" radius={[3,3,0,0]}>
                {stats.byDay.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red} opacity={d.count?0.85:0.2}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
            {[
              { label:'🏆 Most Profitable',  day:stats.dayStats?.mostProfitable,  val:d=>(d.pnl>=0?'+$':'-$')+fmt(Math.abs(d.pnl)), color:T.green },
              { label:'📉 Least Profitable', day:stats.dayStats?.leastProfitable, val:d=>(d.pnl>=0?'+$':'-$')+fmt(Math.abs(d.pnl)), color:T.red },
              { label:'🔥 Most Active',       day:stats.dayStats?.mostActive,      val:d=>d.count+' trades',                          color:T.blue },
              { label:'💤 Least Active',      day:stats.dayStats?.leastActive,     val:d=>d.count+' trades',                          color:T.muted },
              { label:'✅ Best Win Rate',     day:stats.dayStats?.bestWinRate,     val:d=>fmt(d.wins/d.count*100)+'%',               color:T.green },
              { label:'❌ Worst Win Rate',    day:stats.dayStats?.worstWinRate,    val:d=>fmt(d.wins/d.count*100)+'%',               color:T.red },
            ].map(row=>row.day?(
              <div key={row.label} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:T.surface,borderRadius:7,border:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize:9,color:T.muted,marginBottom:1 }}>{row.label}</div>
                  <div style={{ fontSize:12,fontWeight:600 }}>{row.day.day}</div>
                </div>
                <div style={{ fontSize:12,fontWeight:700,color:row.color,fontFamily:T.fontMono }}>{row.val(row.day)}</div>
              </div>
            ):null)}
          </div>
        </div>
      </Card>

      {/* Symbol Table + Radar */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 280px',gap:12,marginBottom:12 }}>
        <Card>
          <SectionHead title="Symbol Performance" sub="Ranked by Gross P&L"/>
          <div style={{ display:'grid',gridTemplateColumns:'24px 100px 1fr 90px 50px 50px 60px',gap:8,padding:'0 0 8px',borderBottom:`1px solid ${T.border}`,marginBottom:4 }}>
            {['#','Symbol','','P&L','Trades','Win%','Fees'].map(h=>(
              <div key={h} style={{ fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500 }}>{h}</div>
            ))}
          </div>
          {(stats.symbolArr||[]).map((s,i) => {
            const maxAbs = Math.max(...(stats.symbolArr||[]).map(x=>Math.abs(x.pnl)))
            return (
              <div key={s.sym} style={{ display:'grid',gridTemplateColumns:'24px 100px 1fr 90px 50px 50px 60px',gap:8,alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:10,color:T.muted,fontFamily:T.fontMono }}>{i+1}</div>
                <div style={{ fontSize:12,fontWeight:600 }}>{s.sym.replace('USDT','')}<span style={{ color:T.muted,fontSize:10 }}>/USDT</span></div>
                <ProgressBar value={Math.abs(s.pnl)} max={maxAbs} color={colorPnL(s.pnl)} height={3}/>
                <div style={{ fontSize:12,fontWeight:600,color:colorPnL(s.pnl),fontFamily:T.fontMono,textAlign:'right' }}>{s.pnl>=0?'+$':'-$'}{fmt(Math.abs(s.pnl))}</div>
                <div style={{ fontSize:11,color:T.muted,textAlign:'right' }}>{s.count}</div>
                <div style={{ fontSize:11,color:parseFloat(s.wr)>=50?T.green:T.red,textAlign:'right' }}>{s.wr}%</div>
                <div style={{ fontSize:11,color:T.red,textAlign:'right',fontFamily:T.fontMono }}>-${fmt(s.fees)}</div>
              </div>
            )
          })}
        </Card>
        <Card>
          <SectionHead title="Score Radar" sub="Performance"/>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke={T.border}/>
              <PolarAngleAxis dataKey="metric" tick={{ fill:T.muted,fontSize:9 }}/>
              <Radar dataKey="val" stroke={T.accent} fill={T.accent} fillOpacity={0.12} strokeWidth={2}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Win/Loss */}
      <Card>
        <SectionHead title="Win / Loss Breakdown" sub="Trade Outcomes"/>
        <div style={{ display:'flex',alignItems:'center',gap:24 }}>
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie data={[{v:stats.winners},{v:stats.losers}]} dataKey="v" innerRadius={38} outerRadius={58} paddingAngle={2} startAngle={90} endAngle={-270}>
                <Cell fill={T.green}/><Cell fill={T.red}/>
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,flex:1 }}>
            {[
              { l:'Winners',     v:stats.winners,                               sub:fmt(stats.winRate)+'%',             c:T.green  },
              { l:'Losers',      v:stats.losers,                                sub:fmt(100-stats.winRate)+'%',         c:T.red    },
              { l:'Avg Win',     v:'+$'+fmt(stats.avgWin),                      sub:'per trade',                        c:T.green  },
              { l:'Avg Loss',    v:'-$'+fmt(stats.avgLoss),                     sub:'per trade',                        c:T.red    },
              { l:'Largest Win', v:'+$'+fmt(stats.largestWin),                  sub:'single trade',                     c:T.green  },
              { l:'Largest Loss',v:'-$'+fmt(Math.abs(stats.largestLoss)),       sub:'single trade',                     c:T.red    },
              { l:'Long P&L',    v:(stats.longPnL>=0?'+$':'-$')+fmt(Math.abs(stats.longPnL)),  sub:fmt(stats.longWR)+'% WR',  c:T.blue   },
              { l:'Short P&L',   v:(stats.shortPnL>=0?'+$':'-$')+fmt(Math.abs(stats.shortPnL)),sub:fmt(stats.shortWR)+'% WR', c:T.purple },
            ].map(r=>(
              <div key={r.l} style={{ background:T.surface,borderRadius:7,padding:'9px 11px',border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
                <div style={{ fontSize:14,fontWeight:700,color:r.c,fontFamily:T.fontMono }}>{r.v}</div>
                <div style={{ fontSize:9,color:T.muted,marginTop:2 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
