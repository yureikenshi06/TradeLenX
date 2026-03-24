import { useState } from 'react'
import { THEME as T } from '../lib/theme'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { id: 'dashboard', icon: '◦', label: 'Dashboard', group: 'main' },
  { id: 'trades', icon: '≡', label: 'Trade Log', group: 'main' },
  { id: 'charts', icon: '↗', label: 'Analytics', group: 'main' },
  { id: 'calendar', icon: '◫', label: 'Calendar', group: 'main' },
  { id: 'symbols', icon: '◎', label: 'Symbols', group: 'main' },
  { id: 'wallet', icon: '◑', label: 'Wallet', group: 'main' },
  { id: 'progress', icon: '◉', label: 'Progress', group: 'tools' },
  { id: 'eod', icon: '◷', label: 'Day Summary', group: 'tools' },
  { id: 'checklist', icon: '☑', label: 'Checklists', group: 'tools' },
  { id: 'notes', icon: '✎', label: 'Journal', group: 'tools' },
  { id: 'ai', icon: '◈', label: 'AI Analysis', group: 'tools' },
  { id: 'share', icon: '⬡', label: 'Share Card', group: 'tools' },
  { id: 'settings', icon: '⚙', label: 'Settings', group: 'system' },
]

export default function Layout({ children, activePage, onPageChange, connected, source }) {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const groups = [
    { key: 'main', label: 'TRADING' },
    { key: 'tools', label: 'TOOLS' },
    { key: 'system', label: 'SYSTEM' },
  ]

  return (
    <div className="ambient-shell" style={{ display: 'flex', minHeight: '100vh', background: T.bgDeep }}>
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-grid" />
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      <aside style={{
        width: collapsed ? 52 : 210,
        background: 'rgba(12,15,20,0.76)',
        borderRight: `1px solid ${T.border}`,
        backdropFilter: 'blur(18px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(.22,1,.36,1)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
        overflow: 'hidden',
      }}>
        <div className="glass-sheen" />

        <div style={{ padding: collapsed ? '16px 14px' : '16px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flexShrink: 0 }}>
          <div data-float="soft" style={{ fontSize: 18, color: T.accent, flexShrink: 0, fontWeight: 700 }}>◈</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, letterSpacing: -0.3, whiteSpace: 'nowrap', fontFamily: T.fontSans }}>Tradelenx</div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>Futures Journal</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {groups.map((group) => (
            <div key={group.key} style={{ marginBottom: 6 }}>
              {!collapsed && (
                <div style={{ fontSize: 9, color: `${T.muted}88`, letterSpacing: 2, fontWeight: 700, padding: '10px 10px 5px', textTransform: 'uppercase' }}>
                  {group.label}
                </div>
              )}
              {NAV.filter((item) => item.group === group.key).map((item) => {
                const active = activePage === item.id
                return (
                  <button key={item.id} onClick={() => onPageChange(item.id)} title={collapsed ? item.label : ''} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: collapsed ? '9px 0' : '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: T.fontSans,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    background: active ? 'linear-gradient(135deg, rgba(226,184,74,0.16), rgba(226,184,74,0.06))' : 'transparent',
                    color: active ? T.accent : T.textMid,
                    border: active ? `1px solid ${T.accent}44` : '1px solid transparent',
                    width: '100%',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    marginBottom: 2,
                    letterSpacing: active ? 0 : -0.1,
                    boxShadow: active ? `0 10px 24px rgba(226,184,74,0.08)` : 'none',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && active && (
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, boxShadow: `0 0 10px ${T.accent}`, flexShrink: 0 }} />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {!collapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: connected ? T.greenDim : T.redDim,
              border: `1px solid ${connected ? T.green : T.red}33`,
              borderRadius: 7,
              padding: '6px 10px',
              marginBottom: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? T.green : T.red, flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: connected ? T.green : T.red, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {connected ? (source === 'demo' ? 'DEMO DATA' : 'BINANCE LIVE') : 'OFFLINE'}
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed((c) => !c)} style={{
            width: '100%',
            padding: '6px',
            borderRadius: 7,
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.muted,
            fontFamily: T.fontSans,
            fontSize: 10,
            cursor: 'pointer',
            marginBottom: user && !collapsed ? 6 : 0,
          }}>
            {collapsed ? '→' : '← Collapse'}
          </button>
          {!collapsed && user && (
            <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(15,19,24,0.82)', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 2 }}>SIGNED IN</div>
              <div style={{ fontSize: 11, color: T.textMid, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              <button onClick={signOut} style={{ fontSize: 10, color: T.red, background: T.redDim, border: `1px solid ${T.red}22`, borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontFamily: T.fontSans }}>Sign Out</button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'linear-gradient(180deg, rgba(4,5,7,0.68) 0%, rgba(7,9,13,0.94) 100%)', position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </div>
  )
}
