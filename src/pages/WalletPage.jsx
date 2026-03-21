import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtTime, localDateKey, loadCashFlow, saveCashFlow } from '../lib/data'
import { Card, SectionHead, KpiCard, Badge, Btn, Input, ChartTooltip } from '../components/UI'
import { fetchLiveAccount, loadKeys } from '../hooks/useTrades'
import { fetchCapitalFlow, upsertCapitalFlow, deleteCapitalFlow, supabase } from '../lib/supabase'

function useLiveData() {
  const [account,  setAccount]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [lastRefresh, setLast]  = useState(null)

  const refresh = useCallback(async () => {
    const keys = loadKeys()
    if (!keys?.k || !keys?.s) { setError('No Binance keys saved. Connect in Settings first.'); return }
    setLoading(true); setError('')
    try {
      const data = await fetchLiveAccount(keys.k, keys.s)
      setAccount(data); setLast(Date.now())
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh])

  return { account, loading, error, lastRefresh, refresh }
}

function CashFlowPanel() {
  const [entries, setEntries] = useState([])
  const [userId,  setUserId]  = useState(null)
  const [syncing, setSyncing] = useState(false)

  // Load from Supabase on mount, fallback to localStorage
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      setUserId(uid)
      if (uid) {
        fetchCapitalFlow(uid).then(rows => {
          if (rows.length) {
            setEntries(rows.map(r => ({ ...r, amount:+r.amount })))
          } else {
            // Migrate from localStorage if any
            const local = loadCashFlow()
            if (local.length) {
              setEntries(local)
              local.forEach(e => upsertCapitalFlow(e, uid).catch(()=>{}))
            }
          }
        }).catch(() => setEntries(loadCashFlow()))
      } else {
        setEntries(loadCashFlow())
      }
    })
  }, [])
  const [form, setForm] = useState({ type:'deposit', amount:'', date:localDateKey(Date.now()), note:'' })
  const [msg,  setMsg]  = useState('')

  const add = async () => {
    if (!form.amount || +form.amount <= 0) return
    const entry = { ...form, amount:+form.amount, time:new Date(form.date+'T12:00:00').getTime(), id:String(Date.now()) }
    const updated = [...entries, entry].sort((a,b)=>a.time-b.time)
    setEntries(updated); saveCashFlow(updated)
    setForm(f=>({...f, amount:'', note:''}))
    setMsg('Saved!'); setTimeout(()=>setMsg(''), 2500)
    if (userId) { try { await upsertCapitalFlow(entry, userId) } catch {} }
  }
  const remove = async (id) => {
    const u = entries.filter(e=>e.id!==id)
    setEntries(u); saveCashFlow(u)
    if (userId) { try { await deleteCapitalFlow(id) } catch {} }
  }

  const totalIn  = entries.filter(e=>e.type==='deposit').reduce((s,e)=>s+e.amount,0)
  const totalOut = entries.filter(e=>e.type==='withdraw').reduce((s,e)=>s+e.amount,0)
  const net      = totalIn - totalOut

  // Chart data — cumulative capital
  let cum = 0
  const chartData = entries.map(e => {
    cum += e.type==='deposit' ? e.amount : -e.amount
    return { date:e.date||localDateKey(e.time), cum:+cum.toFixed(2), amount:e.type==='deposit'?e.amount:-e.amount, type:e.type }
  })

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      {/* Summary */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
        <KpiCard label="Total Deposited"  value={'+$'+fmt(totalIn)}  color={T.green} />
        <KpiCard label="Total Withdrawn"  value={'-$'+fmt(totalOut)} color={T.red}   />
        <KpiCard label="Net Capital In"   value={(net>=0?'+$':'-$')+fmt(Math.abs(net))} color={colorPnL(net)} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <SectionHead title="Capital Flow History" sub="Cumulative"/>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ left:4,right:4,top:4,bottom:4 }}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={T.blue} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="date" tick={{ fill:T.muted,fontSize:10 }} tickLine={false} axisLine={{ stroke:T.border }}/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>'$'+fmt(v,0)} width={65}/>
              <Tooltip content={<ChartTooltip formatter={v=>'$'+fmt(v)}/>}/>
              <Area type="monotone" dataKey="cum" stroke={T.blue} fill="url(#cfGrad)" strokeWidth={2} dot={false} name="Capital"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Add form */}
      <Card glow>
        <SectionHead title="Add Transaction" sub="Record deposit or withdrawal"/>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10,color:T.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:5 }}>Type</div>
            <div style={{ display:'flex',gap:6 }}>
              {[{v:'deposit',l:'↓ Deposit'},{v:'withdraw',l:'↑ Withdraw'}].map(o=>(
                <button key={o.v} onClick={()=>setForm(f=>({...f,type:o.v}))} style={{
                  flex:1,padding:'7px',borderRadius:6,cursor:'pointer',fontFamily:T.fontSans,fontSize:12,fontWeight:form.type===o.v?600:400,
                  background:form.type===o.v?(o.v==='deposit'?T.greenDim:T.redDim):T.surface,
                  border:`1px solid ${form.type===o.v?(o.v==='deposit'?T.green:T.red):T.border}`,
                  color:form.type===o.v?(o.v==='deposit'?T.green:T.red):T.muted,
                }}>{o.l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10,color:T.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:5 }}>Amount (USDT)</div>
            <Input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="1000" type="number"/>
          </div>
          <div>
            <div style={{ fontSize:10,color:T.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:5 }}>Date</div>
            <Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <div>
            <div style={{ fontSize:10,color:T.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:5 }}>Note</div>
            <Input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Initial deposit"/>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,alignItems:'center' }}>
          <Btn variant="accent" onClick={add} style={{ padding:'9px 24px' }}>Add Transaction</Btn>
          {msg && <span style={{ fontSize:12,color:T.green }}>{msg}</span>}
        </div>
      </Card>

      {/* Transaction list */}
      <Card>
        <SectionHead title="Transaction History" sub={`${entries.length} records`}/>
        {entries.length ? (
          <div style={{ display:'flex',flexDirection:'column',gap:5,maxHeight:320,overflowY:'auto' }}>
            {[...entries].sort((a,b)=>b.time-a.time).map(e=>(
              <div key={e.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',background:T.surface,borderRadius:8,border:`1px solid ${e.type==='deposit'?T.green:T.red}22` }}>
                <div>
                  <div style={{ fontSize:12,fontWeight:500,color:T.text }}>{e.note||(e.type==='deposit'?'Deposit':'Withdrawal')}</div>
                  <div style={{ fontSize:10,color:T.muted,marginTop:1 }}>{fmtDate(e.time)}</div>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <Badge text={e.type==='deposit'?'DEPOSIT':'WITHDRAW'} color={e.type==='deposit'?T.green:T.red}/>
                  <div style={{ fontSize:13,fontWeight:700,color:e.type==='deposit'?T.green:T.red,fontFamily:T.fontMono }}>{e.type==='deposit'?'+':'-'}${fmt(e.amount)}</div>
                  <button onClick={()=>remove(e.id)} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:14,padding:'2px 6px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color:T.muted,fontSize:12,textAlign:'center',padding:'24px 0' }}>No transactions yet. Add your first deposit above.</div>
        )}
      </Card>
    </div>
  )
}

function LiveAccountPanel({ account, loading, error, lastRefresh, refresh }) {
  if (error) return (
    <Card>
      <div style={{ textAlign:'center',padding:'32px 0' }}>
        <div style={{ fontSize:32,marginBottom:12,opacity:0.3 }}>🔌</div>
        <div style={{ fontSize:14,fontWeight:600,marginBottom:8 }}>Not Connected</div>
        <div style={{ fontSize:12,color:T.muted,marginBottom:16,lineHeight:1.7 }}>{error}</div>
        <Btn onClick={refresh}>Retry</Btn>
      </div>
    </Card>
  )

  if (loading && !account) return (
    <Card style={{ textAlign:'center',padding:'48px 0' }}>
      <div style={{ fontSize:12,color:T.muted }}>Loading live account data...</div>
    </Card>
  )

  if (!account) return null

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      {/* Balance cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
        <KpiCard label="Wallet Balance"      value={'$'+fmt(account.totalWalletBalance)}   color={T.accent}  sub="Total USDT"/>
        <KpiCard label="Available Balance"   value={'$'+fmt(account.availableBalance)}      color={T.blue}    sub="Free to trade"/>
        <KpiCard label="Running PnL"         value={(account.totalUnrealizedProfit>=0?'+$':'-$')+fmt(Math.abs(account.totalUnrealizedProfit))} color={colorPnL(account.totalUnrealizedProfit)} sub="Unrealized"/>
        <KpiCard label="Margin Balance"      value={'$'+fmt(account.totalMarginBalance)}    color={T.textMid} sub="incl. unrealized"/>
      </div>

      {/* Open positions */}
      <Card glow>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <SectionHead title="Open Positions" sub={`${account.positions.length} active`}/>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {lastRefresh && <div style={{ fontSize:10,color:T.muted }}>Updated {fmtTime(lastRefresh)}</div>}
            <Btn onClick={refresh} disabled={loading} style={{ fontSize:11,padding:'4px 12px' }}>
              {loading?'Refreshing...':'↺ Refresh'}
            </Btn>
          </div>
        </div>

        {account.positions.length > 0 ? (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                  {['Symbol','Side','Size','Entry Price','Leverage','Unrealized PnL','Margin'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {account.positions.map((p,i)=>(
                  <tr key={p.symbol} style={{ borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface+'66' }}>
                    <td style={{ padding:'10px 12px',fontWeight:700 }}>{p.symbol.replace('USDT','')}<span style={{ color:T.muted,fontSize:10 }}>/USDT</span></td>
                    <td style={{ padding:'10px 12px' }}><Badge text={p.side} color={p.side==='LONG'?T.green:T.red}/></td>
                    <td style={{ padding:'10px 12px',fontFamily:T.fontMono }}>{Math.abs(p.size)}</td>
                    <td style={{ padding:'10px 12px',fontFamily:T.fontMono }}>${fmt(p.entryPrice)}</td>
                    <td style={{ padding:'10px 12px',color:p.leverage>=20?T.red:p.leverage>=10?T.accent:T.textMid,fontWeight:600 }}>{p.leverage}x</td>
                    <td style={{ padding:'10px 12px',fontWeight:700,color:colorPnL(p.unrealizedPnl),fontFamily:T.fontMono }}>
                      {p.unrealizedPnl>=0?'+$':'-$'}{fmt(Math.abs(p.unrealizedPnl))}
                    </td>
                    <td style={{ padding:'10px 12px',color:T.muted,fontFamily:T.fontMono }}>${fmt(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:`2px solid ${T.border}` }}>
                  <td colSpan={5} style={{ padding:'8px 12px',fontSize:11,color:T.muted,fontWeight:600 }}>Total Unrealized</td>
                  <td style={{ padding:'8px 12px',fontWeight:700,color:colorPnL(account.totalUnrealizedProfit),fontFamily:T.fontMono }}>
                    {account.totalUnrealizedProfit>=0?'+$':'-$'}{fmt(Math.abs(account.totalUnrealizedProfit))}
                  </td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ textAlign:'center',padding:'24px 0',color:T.muted,fontSize:12 }}>No open positions</div>
        )}
      </Card>
    </div>
  )
}

export default function WalletPage() {
  const [tab, setTab] = useState('live')
  const { account, loading, error, lastRefresh, refresh } = useLiveData()

  return (
    <div style={{ padding:'24px 28px',fontFamily:T.fontSans }}>
      <div style={{ marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>Account</div>
        <div style={{ fontSize:22,fontWeight:700,letterSpacing:-0.5 }}>Wallet & Capital</div>
      </div>

      {/* Tab switcher */}
      <div style={{ display:'flex',gap:3,background:T.surface,borderRadius:8,padding:3,border:`1px solid ${T.border}`,marginBottom:20,width:'fit-content' }}>
        {[{id:'live',l:'⚡ Live Account'},{id:'flow',l:'💰 Capital Flow'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'6px 18px',borderRadius:6,cursor:'pointer',fontFamily:T.fontSans,fontSize:12,fontWeight:tab===t.id?600:400,
            background:tab===t.id?T.card:'transparent',
            color:tab===t.id?T.text:T.muted,
            border:tab===t.id?`1px solid ${T.border}`:'1px solid transparent',
            transition:'all 0.12s',
          }}>{t.l}</button>
        ))}
      </div>

      {tab==='live'
        ? <LiveAccountPanel account={account} loading={loading} error={error} lastRefresh={lastRefresh} refresh={refresh}/>
        : <CashFlowPanel/>
      }
    </div>
  )
}
