import { useState } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt } from '../lib/data'
import { Card, SectionHead, KpiCard, Btn, Spinner } from '../components/UI'

const QUICK_PROMPTS = [
  'What are my biggest weaknesses as a futures trader?',
  'Which hours and days am I most profitable?',
  'Am I overleveraged? Assess my risk per trade.',
  'Which symbols should I focus on and which to avoid?',
  'Analyze my losing streak patterns',
  'How do my long vs short trades compare?',
  'Give me a concrete 30-day improvement plan',
  'What is my biggest psychological trading flaw?',
]

async function callAI(trades, stats, userPrompt) {
  const summary = {
    totalTrades:   stats.total,
    winRate:       +fmt(stats.winRate),
    grossPnL:      +fmt(stats.totalPnL),
    netPnL:        +fmt(stats.netPnL||0),
    totalFees:     +fmt(stats.totalFees),
    avgWin:        +fmt(stats.avgWin),
    avgLoss:       +fmt(stats.avgLoss),
    riskReward:    stats.rr,
    profitFactor:  isFinite(stats.profitFactor)?+fmt(stats.profitFactor):99,
    maxDrawdown:   +fmt(stats.maxDD),
    sharpe:        stats.sharpe,
    maxWinStreak:  stats.maxWinStreak,
    maxLossStreak: stats.maxLossStreak,
    largestWin:    +fmt(stats.largestWin),
    largestLoss:   +fmt(stats.largestLoss),
    longWinRate:   +fmt(stats.longWR),
    shortWinRate:  +fmt(stats.shortWR),
    longPnL:       +fmt(stats.longPnL),
    shortPnL:      +fmt(stats.shortPnL),
    avgRiskPct:    +fmt(stats.avgRiskPct),
    topSymbols:    (stats.symbolArr||[]).slice(0,5).map(s=>({ symbol:s.sym,pnl:+fmt(s.pnl),winRate:s.wr,trades:s.count })),
    worstSymbols:  (stats.symbolArr||[]).slice(-3).map(s=>({ symbol:s.sym,pnl:+fmt(s.pnl),winRate:s.wr })),
    bestDay:       stats.byDay?.reduce((a,b)=>a.pnl>b.pnl?a:b)?.day,
    worstDay:      stats.byDay?.reduce((a,b)=>a.pnl<b.pnl?a:b)?.day,
    bestHour:      stats.byHour?.reduce((a,b)=>a.pnl>b.pnl?a:b)?.hour,
    monthlyTrend:  (stats.monthlyArr||[]).map(m=>({ month:m.m,pnl:m.pnl,wr:m.wr,fees:m.fees })),
    last10Trades:  trades.slice(-10).map(t=>({ sym:t.symbol,side:t.side,pnl:+t.pnl.toFixed(2),lev:t.leverage })),
  }

  const system = `You are an elite prop trading coach specialising in crypto perpetual futures with 15+ years experience.
Analyse the trading data with clinical precision and brutal honesty. Be direct — no fluff.
Structure your response with these exact markdown headers:
## Overall Verdict
## Key Strengths
## Critical Weaknesses
## Risk & Leverage Assessment
## Timing & Pattern Insights
## Symbol Analysis
## Top 5 Immediate Actions
## 30-Day Performance Target

Reference specific numbers from the data. Give an overall score /10 in the verdict. Keep each section concise and actionable.`

  const msg = userPrompt
    ? `${userPrompt}\n\nTrading stats:\n${JSON.stringify(summary,null,2)}`
    : `Full analysis of my perpetual futures trading.\n\nStats:\n${JSON.stringify(summary,null,2)}`

  // Call via Netlify proxy to avoid CORS
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, userMsg: msg }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || 'No response.'
}

function renderAnalysis(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return <div key={i} style={{ fontWeight:600,fontSize:14,color:T.accent,marginTop:22,marginBottom:8,paddingBottom:7,borderBottom:`1px solid ${T.border}`,letterSpacing:-0.2 }}>{line.replace('## ','')}</div>
    }
    if (line.match(/^\*\*.*\*\*$/)) {
      return <div key={i} style={{ fontWeight:600,color:T.text,marginTop:6,fontSize:12 }}>{line.replace(/\*\*/g,'')}</div>
    }
    if (line.match(/^\d+\./)) {
      return (
        <div key={i} style={{ display:'flex',gap:10,padding:'5px 0',alignItems:'flex-start' }}>
          <span style={{ color:T.accent,fontWeight:600,flexShrink:0,fontSize:12,fontFamily:T.fontMono }}>{line.match(/^\d+/)[0]}.</span>
          <span style={{ color:T.textMid,lineHeight:1.7,fontSize:12 }}>{line.replace(/^\d+\.\s*/,'')}</span>
        </div>
      )
    }
    if (line.startsWith('- ')||line.startsWith('• ')) {
      return (
        <div key={i} style={{ display:'flex',gap:8,padding:'3px 0',paddingLeft:8 }}>
          <span style={{ color:T.border,flexShrink:0,marginTop:2 }}>—</span>
          <span style={{ color:T.textMid,lineHeight:1.7,fontSize:12 }}>{line.slice(2)}</span>
        </div>
      )
    }
    if (!line.trim()) return <div key={i} style={{ height:6 }}/>
    return <div key={i} style={{ color:T.textMid,lineHeight:1.75,fontSize:12 }}>{line}</div>
  })
}

export default function AIPage({ trades, stats }) {
  const [analysis, setAnalysis] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [prompt,   setPrompt]   = useState('')
  const [error,    setError]    = useState('')
  const [history,  setHistory]  = useState([])

  const run = async (p) => {
    const q = p !== undefined ? p : prompt
    setLoading(true); setError(''); setAnalysis('')
    try {
      const result = await callAI(trades, stats, q)
      setAnalysis(result)
      setHistory(h=>[{ prompt:q||'Full Analysis',result,ts:Date.now() },...h.slice(0,4)])
    } catch (e) {
      setError('AI analysis failed: ' + e.message + '\n\nMake sure you are running "netlify dev" (not npm run dev) so the AI proxy function is available.')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding:'24px 28px',fontFamily:T.fontSans }}>
      <div style={{ marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:500 }}>AI Trading Coach</div>
        <div style={{ fontSize:24,fontWeight:700,color:T.text,letterSpacing:-0.5 }}>AI Analysis</div>
        <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>Powered by Llama 3.3 70B (Free) · {trades.length} trades analysed</div>
      </div>

      {/* Stats snapshot */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:20 }}>
        <KpiCard label="Net P&L"    value={(stats.netPnL>=0?'+$':'-$')+fmt(Math.abs(stats.netPnL||0))} color={colorPnL(stats.netPnL||0)}/>
        <KpiCard label="Win Rate"   value={fmt(stats.winRate)+'%'}  color={stats.winRate>=50?T.green:T.red}/>
        <KpiCard label="R:R"        value={stats.rr+'x'}            color={parseFloat(stats.rr)>=1.5?T.green:T.red}/>
        <KpiCard label="Total Fees" value={'-$'+fmt(stats.totalFees)} color={T.red}/>
        <KpiCard label="Drawdown"   value={fmt(stats.maxDD)+'%'}    color={stats.maxDD<15?T.green:T.red}/>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 260px',gap:16,alignItems:'start' }}>
        <div>
          <Card style={{ marginBottom:12 }} glow>
            <SectionHead title="Ask the AI" sub="Custom Query"/>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder="Ask something specific... e.g. 'Why am I losing on ETHUSDT?' or leave blank for full analysis"
              rows={4} style={{
                width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,
                padding:'12px',color:T.text,fontFamily:T.fontSans,fontSize:12,resize:'vertical',
                outline:'none',lineHeight:1.7,marginBottom:12,
              }}/>
            <div style={{ display:'flex',gap:10 }}>
              <Btn variant="accent" onClick={()=>run()} disabled={loading} style={{ flex:1,padding:'10px',fontSize:13 }}>
                {loading?'Analysing...':'Run AI Analysis'}
              </Btn>
              {analysis && <Btn onClick={()=>{setAnalysis('');setPrompt('')}}>Clear</Btn>}
            </div>
            {error && (
              <div style={{ marginTop:12,background:T.redDim,border:`1px solid ${T.red}55`,borderRadius:8,padding:'14px 16px',lineHeight:1.8 }}>
                <div style={{ color:T.red,fontWeight:600,fontSize:12,marginBottom:8 }}>⚠ Error</div>
                <div style={{ color:T.red,fontSize:12,whiteSpace:'pre-wrap' }}>{error}</div>
                <div style={{ marginTop:10,paddingTop:10,borderTop:`1px solid ${T.red}33` }}>
                  <div style={{ fontSize:11,color:T.muted,marginBottom:6 }}>Debug: open this in your browser to check if the function is running:</div>
                  <code style={{ fontSize:11,color:T.accent,background:T.surface,padding:'4px 8px',borderRadius:4,display:'block' }}>
                    http://localhost:8788/api/ai
                  </code>
                </div>
              </div>
            )}
          </Card>

          {loading && (
            <Card style={{ textAlign:'center',padding:'48px 24px' }}>
              <div style={{ display:'flex',justifyContent:'center',marginBottom:16 }}><Spinner size={36}/></div>
              <div style={{ fontWeight:600,fontSize:15,marginBottom:8 }}>Analysing {trades.length} trades...</div>
              <div style={{ color:T.muted,fontSize:12 }}>Claude is reviewing your performance, patterns, and risk</div>
            </Card>
          )}

          {analysis && !loading && (
            <Card glow>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                <SectionHead title="Analysis Result" sub="Claude Sonnet"/>
                <div style={{ display:'flex',gap:8 }}>
                  <Btn onClick={()=>navigator.clipboard?.writeText(analysis)} style={{ fontSize:11,padding:'4px 10px' }}>Copy</Btn>
                </div>
              </div>
              <div style={{ background:T.surface,borderRadius:8,padding:'18px 20px',border:`1px solid ${T.border}`,lineHeight:1.8 }}>
                {renderAnalysis(analysis)}
              </div>
            </Card>
          )}

          {!analysis && !loading && (
            <div style={{ textAlign:'center',padding:'60px 20px',background:T.card,border:`1px solid ${T.border}`,borderRadius:10 }}>
              <div style={{ fontSize:32,marginBottom:14,opacity:0.3 }}>◎</div>
              <div style={{ fontWeight:600,fontSize:16,marginBottom:8 }}>Ready to Analyse</div>
              <div style={{ color:T.muted,fontSize:12,marginBottom:24,lineHeight:1.7,maxWidth:360,margin:'0 auto 24px' }}>
                Get a comprehensive review covering strengths, weaknesses, risk management, timing patterns, and a personalised improvement plan.
              </div>
              <Btn variant="accent" onClick={()=>run('')} style={{ padding:'11px 32px',fontSize:13 }}>Run Full Analysis</Btn>
            </div>
          )}
        </div>

        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <Card>
            <SectionHead title="Quick Questions" sub="One-click"/>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {QUICK_PROMPTS.map((p,i)=>(
                <button key={i} onClick={()=>run(p)} disabled={loading} style={{
                  background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,
                  padding:'8px 12px',color:T.textMid,fontFamily:T.fontSans,
                  fontSize:11,cursor:loading?'not-allowed':'pointer',textAlign:'left',
                  opacity:loading?0.4:1,lineHeight:1.4,
                }}>
                  {p}
                </button>
              ))}
            </div>
          </Card>

          {history.length>0 && (
            <Card>
              <SectionHead title="Recent" sub="History"/>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {history.map((h,i)=>(
                  <button key={i} onClick={()=>setAnalysis(h.result)} style={{
                    background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,
                    padding:'8px 12px',cursor:'pointer',textAlign:'left',fontFamily:T.fontSans,
                  }}>
                    <div style={{ fontSize:11,color:T.textMid,marginBottom:2 }}>{h.prompt.slice(0,44)}...</div>
                    <div style={{ fontSize:9,color:T.muted }}>{new Date(h.ts).toLocaleTimeString()}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionHead title="How it works" sub="Note"/>
            <div style={{ fontSize:11,color:T.muted,lineHeight:1.8 }}>
              <div style={{ marginBottom:6 }}>Requires <code style={{ background:T.surface,padding:'1px 5px',borderRadius:3,color:T.accent,fontFamily:T.fontMono,fontSize:10 }}>netlify dev</code> to run locally.</div>
              <div>For production, add <code style={{ background:T.surface,padding:'1px 5px',borderRadius:3,color:T.accent,fontFamily:T.fontMono,fontSize:10 }}>ANTHROPIC_API_KEY</code> to your Netlify environment variables.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
