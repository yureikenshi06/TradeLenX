import { useState } from 'react'
import { THEME as T } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'

export default function SettingsPage({ trades, stats, onConnectBinance, onLoadDemo, source, error: hookError, progress }) {
  const { user }    = useAuth()
  const [apiKey,    setApiKey]    = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const handleConnect = async () => {
    setMsg('')
    setSaving(true)
    const res = await onConnectBinance(apiKey, apiSecret)
    if (res?.success)  setMsg(`✓ Loaded ${res.count} futures trades across ${res.symbols} symbols!`)
    else if (res?.demo) setMsg('⚠ Showing demo data — see error above.')
    else if (res?.error) setMsg('')
    setSaving(false)
  }

  const exportCSV = () => {
    const rows = [
      'id,symbol,side,qty,price,exitPrice,pnl,fee,leverage,duration,equity,time',
      ...trades.map(t => [
        t.id, t.symbol, t.side, t.qty, t.price,
        t.exitPrice||'', t.pnl, t.fee, t.leverage,
        t.duration, t.equity,
        new Date(t.time).toISOString()
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv,' + encodeURIComponent(rows)
    a.download = `tradelens_export_${Date.now()}.csv`
    a.click()
  }

  const STEPS = [
    {
      n: '01', title: 'Supabase Setup (Free)',
      items: ['supabase.com → New Project','Run SQL from src/lib/supabase.js in SQL Editor','Authentication → Users → Add only YOUR email','Project Settings → API → copy URL + anon key'],
    },
    {
      n: '02', title: 'Environment Variables',
      items: ['Create .env file in project root','VITE_SUPABASE_URL=https://xxxx.supabase.co','VITE_SUPABASE_ANON_KEY=your_key'],
    },
    {
      n: '03', title: 'Deploy to Netlify (Free)',
      items: ['Push to GitHub (private repo)','netlify.com → New Site → connect repo','Build: npm run build  |  Publish: dist','Add env vars in Netlify dashboard → Deploy'],
    },
    {
      n: '04', title: 'For Live Binance Data',
      items: ['Set BINANCE_API_KEY + BINANCE_API_SECRET in Netlify env vars','Run locally with:  netlify dev  (not npm run dev)','The Netlify function at /.netlify/functions/binance signs requests with HMAC-SHA256'],
    },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: T.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Configuration</div>
        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: T.fontDisplay }}>Settings</div>
      </div>

      {/* Account */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Account" sub="Authentication" />
        {user ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>Signed in as</div>
              <div style={{ fontWeight: 700 }}>{user.email}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>UID: {user.id?.slice(0,16)}...</div>
            </div>
            <Btn variant="danger" onClick={signOut}>Sign Out</Btn>
          </div>
        ) : (
          <div style={{ color: T.muted, fontSize: 12 }}>
            Not signed in — running in demo mode. Notes saved locally only.
          </div>
        )}
      </Card>

      {/* Binance Connection */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Binance Live Data" sub="API Connection" />

        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: source === 'binance' ? T.greenDim : T.accentDim,
            border: `1px solid ${source === 'binance' ? T.green : T.accent}44`,
            borderRadius: 8, padding: '7px 14px', fontSize: 11,
            color: source === 'binance' ? T.green : T.accent,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: source === 'binance' ? T.green : T.accent }} />
            {source === 'binance' ? `Binance Live (${trades.length} trades)` : 'Demo Mode'}
          </div>
          {source === 'binance' && (
            <Btn onClick={onLoadDemo} style={{ fontSize: 11, padding: '5px 12px' }}>Switch to Demo</Btn>
          )}
        </div>

        {/* API key inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>API Key</div>
            <Input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Binance API Key (read-only)"
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>
              Secret Key
              <button onClick={() => setShowSecret(s=>!s)} style={{ marginLeft: 8, background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 10, fontFamily: T.fontMono }}>
                {showSecret ? 'hide' : 'show'}
              </button>
            </div>
            <Input
              type={showSecret ? 'text' : 'password'}
              value={apiSecret}
              onChange={e => setApiSecret(e.target.value)}
              placeholder="Binance API Secret"
            />
          </div>
          <Btn
            variant="accent"
            onClick={handleConnect}
            disabled={saving || !apiKey || !apiSecret}
            style={{ padding: '10px', fontSize: 13 }}
          >
            {saving ? (progress || 'Connecting...') : '⚡ Connect to Binance'}
          </Btn>
        </div>

        {/* Progress */}
        {progress && saving && (
          <div style={{ fontSize: 12, color: T.accent, padding: '8px 12px', background: T.accentDim, borderRadius: 7, marginBottom: 8 }}>
            ⏳ {progress}
          </div>
        )}

        {/* Error from hook */}
        {hookError && (
          <div style={{ fontSize: 12, color: T.red, padding: '10px 14px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, marginBottom: 8, lineHeight: 1.6 }}>
            ⚠ {hookError}
          </div>
        )}

        {/* Success msg */}
        {msg && !hookError && (
          <div style={{ fontSize: 12, color: T.green, padding: '8px 12px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 7, marginBottom: 8 }}>
            {msg}
          </div>
        )}

        {/* Important note */}
        <div style={{ padding: '12px 14px', background: T.surface, borderRadius: 10, fontSize: 11, color: T.muted, lineHeight: 1.8, borderLeft: `3px solid ${T.accent}` }}>
          <div style={{ fontWeight: 700, color: T.textMid, marginBottom: 6 }}>⚠ Important for local testing</div>
          <div>Run <code style={{ background: T.bg, padding: '1px 6px', borderRadius: 4, color: T.accent }}>netlify dev</code> instead of <code style={{ background: T.bg, padding: '1px 6px', borderRadius: 4, color: T.red }}>npm run dev</code></div>
          <div>Since you trade Perpetual Futures, make sure your Binance API key has "Enable Futures" turned ON. Go to Binance → API Management → Edit key → check Enable Futures.</div>
          <div style={{ marginTop: 6 }}>For production: add <code style={{ color: T.accent }}>BINANCE_API_KEY</code> + <code style={{ color: T.accent }}>BINANCE_API_SECRET</code> to Netlify env vars.</div>
        </div>
      </Card>

      {/* Data Summary */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Data Summary" sub="Current Session" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Trades',   v: trades.length },
            { l: 'Symbols',  v: [...new Set(trades.map(t=>t.symbol))].length },
            { l: 'From',     v: trades.length ? fmtDate(Math.min(...trades.map(t=>t.time))) : '—' },
            { l: 'Net P&L',  v: (stats.totalPnL>=0?'+$':'-$')+fmt(Math.abs(stats.totalPnL)) },
          ].map(r => (
            <div key={r.l} style={{ background: T.surface, borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{r.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.fontDisplay }}>{r.v}</div>
            </div>
          ))}
        </div>
        <Btn variant="success" onClick={exportCSV} style={{ padding: '10px 20px' }}>↓ Export CSV ({trades.length} trades)</Btn>
      </Card>

      {/* Deployment guide */}
      <Card>
        <SectionHead title="Deployment Guide" sub="Free Hosting in 10 min" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 16 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: T.accentDim, border: `1px solid ${T.accent}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: T.accent, fontSize: 12, flexShrink: 0,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 7 }}>{s.title}</div>
                {s.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: T.accent, fontSize: 10, flexShrink: 0, marginTop: 2 }}>›</span>
                    <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
