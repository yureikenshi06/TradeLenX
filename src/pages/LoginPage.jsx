import { useState } from 'react'
import { signIn } from '../lib/supabase'
import { THEME as T } from '../lib/theme'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bgDeep, fontFamily: T.fontMono, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.accent}0f 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Grid lines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${T.textMid} 1px, transparent 1px), linear-gradient(90deg, ${T.textMid} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      <div style={{ width: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>◈</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: T.fontDisplay, color: T.accent, letterSpacing: 1 }}>
            TRADE<span style={{ color: T.muted }}>LENX</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6, letterSpacing: 2 }}>
            YOUR PRIVATE FUTURES JOURNAL
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '32px',
          boxShadow: `0 0 60px rgba(0,0,0,0.6), inset 0 1px 0 ${T.borderMid}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: T.fontDisplay, marginBottom: 24, color: T.text }}>
            Sign in to your account
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="your@email.com"
                style={{
                  width: '100%', background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '10px 14px', color: T.text,
                  fontFamily: T.fontMono, fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{
                  width: '100%', background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '10px 14px', color: T.text,
                  fontFamily: T.fontMono, fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: T.redDim, border: `1px solid ${T.red}44`,
                borderRadius: 8, padding: '10px 14px', color: T.red,
                fontSize: 12, marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', background: T.accent, color: '#000',
                border: 'none', borderRadius: 10, padding: '12px',
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: 0.5,
              }}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>


        </div>
      </div>
    </div>
  )
}
