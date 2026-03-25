import React, { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useTrades } from './hooks/useTrades'
import Layout        from './components/Layout'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TradesPage    from './pages/TradesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CalendarPage  from './pages/CalendarPage'
import SymbolsPage   from './pages/SymbolsPage'
import NotesPage     from './pages/NotesPage'
import AIPage        from './pages/AIPage'
import SettingsPage  from './pages/SettingsPage'
import ProgressPage  from './pages/ProgressPage'
import EODPage       from './pages/EODPage'
import EODInsightsPage from './pages/EODInsightsPage'
import ChecklistPage from './pages/ChecklistPage'
import ShareCardPage from './pages/ShareCardPage'
import WalletPage    from './pages/WalletPage'
import { THEME as T } from './lib/theme'
import { Spinner } from './components/UI'

class PageBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown render error' }
  }

  componentDidCatch(error) {
    console.error('Page render failed:', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:'32px',maxWidth:760 }}>
          <div style={{ background:T.card,border:`1px solid ${T.red}44`,borderRadius:12,padding:'24px' }}>
            <div style={{ fontSize:11,color:T.red,textTransform:'uppercase',letterSpacing:1.5,marginBottom:8 }}>Render Error</div>
            <div style={{ fontSize:22,fontWeight:700,color:T.text,marginBottom:8 }}>This page hit an error</div>
            <div style={{ fontSize:12,color:T.muted,lineHeight:1.7,marginBottom:12 }}>
              The app stayed alive, but the current page could not render.
            </div>
            <div style={{ fontSize:12,color:T.text,fontFamily:T.fontMono,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'12px 14px' }}>
              {this.state.message}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const { user, loading: authLoading } = useAuth()
  const {
    trades, allTrades, stats, loading, connected, source,
    error, progress, dateRange, savedKeys,
    loadDemo, connectBinance, applyDateRange, disconnectBinance,
  } = useTrades()
  const [page, setPage] = useState('dashboard')

  if (authLoading) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.bgDeep,flexDirection:'column',gap:16 }}>
      <div style={{ fontSize:32,color:T.accent }}>◈</div>
      <Spinner size={32}/>
      <div style={{ fontSize:12,color:T.muted,fontFamily:T.fontMono }}>Loading Tradelenx...</div>
    </div>
  )

  if (!user) return <LoginPage />

  const shared = { trades, stats }
  const pages = {
    dashboard: <DashboardPage {...shared} applyDateRange={applyDateRange} dateRange={dateRange} allTrades={allTrades}/>,
    trades:    <TradesPage    {...shared}/>,
    charts:    <AnalyticsPage {...shared}/>,
    calendar:  <CalendarPage  {...shared}/>,
    symbols:   <SymbolsPage   {...shared}/>,
    wallet:    <WalletPage savedKeys={savedKeys} source={source} trades={allTrades}/>,
    notes:     <NotesPage     {...shared}/>,
    ai:        <AIPage        {...shared}/>,
    progress:  <ProgressPage  {...shared}/>,
    eod:       <EODPage       {...shared}/>,
    eodInsights: <EODInsightsPage />,
    checklist: <ChecklistPage/>,
    share:     <ShareCardPage {...shared}/>,
    settings:  <SettingsPage
                 {...shared}
                 source={source} error={error} progress={progress}
                 savedKeys={savedKeys}
                 onConnectBinance={connectBinance}
                 onLoadDemo={loadDemo}
                 onDisconnect={disconnectBinance}
               />,
  }

  return (
    <Layout activePage={page} onPageChange={setPage} connected={connected} source={source} trades={trades}>
      <PageBoundary resetKey={page}>
        <div style={{ position:'relative', minHeight:'100%' }}>
          <div className="page-ambient" aria-hidden="true">
            <div className="page-orb page-orb-a" />
            <div className="page-orb page-orb-b" />
            <div className="page-orb page-orb-c" />
          </div>
          <div className="page-content">
            {loading ? (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'80vh',flexDirection:'column',gap:16 }}>
                <Spinner size={36}/>
                <div style={{ fontSize:12,color:T.muted,fontFamily:T.fontMono }}>{progress||'Loading...'}</div>
              </div>
            ) : pages[page]}
          </div>
        </div>
      </PageBoundary>
    </Layout>
  )
}

export default function App() {
  return <AuthProvider><AppInner/></AuthProvider>
}
