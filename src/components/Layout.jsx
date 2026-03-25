import { useState } from 'react'
import {
  Bot,
  CalendarDays,
  CandlestickChart,
  CheckSquare,
  Gauge,
  LayoutDashboard,
  NotebookPen,
  ScanSearch,
  Settings,
  Share2,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react'
import { THEME as T } from '../lib/theme'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'main' },
  { id: 'trades', icon: CandlestickChart, label: 'Trade Log', group: 'main' },
  { id: 'charts', icon: ScanSearch, label: 'Analytics', group: 'main' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendar', group: 'main' },
  { id: 'symbols', icon: Target, label: 'Symbols', group: 'main' },
  { id: 'wallet', icon: Wallet, label: 'Wallet', group: 'main' },
  { id: 'progress', icon: Gauge, label: 'Progress', group: 'tools' },
  { id: 'eod', icon: NotebookPen, label: 'Day Summary', group: 'tools' },
  { id: 'eodInsights', icon: ShieldCheck, label: 'EOD Insights', group: 'tools' },
  { id: 'checklist', icon: CheckSquare, label: 'Checklists', group: 'tools' },
  { id: 'notes', icon: NotebookPen, label: 'Journal', group: 'tools' },
  { id: 'ai', icon: Bot, label: 'AI Analysis', group: 'tools' },
  { id: 'share', icon: Share2, label: 'Share Card', group: 'tools' },
  { id: 'settings', icon: Settings, label: 'Settings', group: 'system' },
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
      <style>{`
        @keyframes shellFloatA {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.25; }
          50% { transform: translate3d(28px, -22px, 0) scale(1.08); opacity: 0.42; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.25; }
        }
        @keyframes shellFloatB {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
          50% { transform: translate3d(-24px, 18px, 0) scale(1.12); opacity: 0.34; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
        }
        @keyframes gridDrift {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(40px, 32px, 0); }
        }
        @keyframes sheenMove {
          0% { transform: translateX(-160%) skewX(-18deg); opacity: 0; }
          35% { opacity: 0.16; }
          100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
        }
        .ambient-bg {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .ambient-grid {
          position: absolute;
          inset: -10%;
          background-image:
            linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at center, rgba(0,0,0,0.72), transparent 80%);
          animation: gridDrift 18s linear infinite alternate;
        }
        .orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
        }
        .orb-a {
          width: 340px;
          height: 340px;
          background: rgba(6,182,212,0.12);
          top: 10%;
          left: 14%;
          animation: shellFloatA 10s ease-in-out infinite;
        }
        .orb-b {
          width: 400px;
          height: 400px;
          background: rgba(226,184,74,0.10);
          bottom: 8%;
          right: 12%;
          animation: shellFloatB 12s ease-in-out infinite;
        }
        .orb-c {
          width: 280px;
          height: 280px;
          background: rgba(34,197,94,0.08);
          top: 48%;
          right: 28%;
          animation: shellFloatA 14s ease-in-out infinite reverse;
        }
        .glass-sheen {
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.06) 48%, transparent 72%);
          transform: translateX(-160%) skewX(-18deg);
          animation: sheenMove 7s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-grid" />
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      <aside style={{ width: collapsed ? 56 : 220, background: 'rgba(12,15,20,0.76)', borderRight: `1px solid ${T.border}`, backdropFilter: 'blur(18px)', display: 'flex', flexDirection: 'column', transition: 'width 0.22s cubic-bezier(.22,1,.36,1)', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', zIndex: 50, overflow: 'hidden' }}>
        <div className="glass-sheen" />

        <div style={{ padding: collapsed ? '16px 14px' : '16px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: T.accentDim, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <LayoutDashboard size={16} strokeWidth={2.2} />
          </div>
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
              {!collapsed && <div style={{ fontSize: 9, color: `${T.muted}88`, letterSpacing: 2, fontWeight: 700, padding: '10px 10px 5px', textTransform: 'uppercase' }}>{group.label}</div>}
              {NAV.filter((item) => item.group === group.key).map((item) => {
                const Icon = item.icon
                const active = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onPageChange(item.id)}
                    title={collapsed ? item.label : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '10px 0' : '9px 12px',
                      borderRadius: 10,
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
                    }}
                  >
                    <span style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', flexShrink: 0, opacity: active ? 1 : 0.78 }}>
                      <Icon size={16} strokeWidth={2.1} />
                    </span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, boxShadow: `0 0 10px ${T.accent}`, flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: connected ? T.greenDim : T.redDim, border: `1px solid ${connected ? T.green : T.red}33`, borderRadius: 7, padding: '6px 10px', marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? T.green : T.red, flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: connected ? T.green : T.red, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {connected ? (source === 'demo' ? 'DEMO DATA' : 'BINANCE LIVE') : 'OFFLINE'}
              </div>
            </div>
          )}

          <button onClick={() => setCollapsed((value) => !value)} style={{ width: '100%', padding: '6px', borderRadius: 7, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, fontFamily: T.fontSans, fontSize: 10, cursor: 'pointer', marginBottom: user && !collapsed ? 6 : 0 }}>
            {collapsed ? 'Expand' : 'Collapse'}
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
