import { useState } from 'react'
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
import ChecklistPage from './pages/ChecklistPage'
import ShareCardPage from './pages/ShareCardPage'
import WalletPage    from './pages/WalletPage'
import { THEME as T } from './lib/theme'
import { Spinner } from './components/UI'

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
    wallet:    <WalletPage/>,
    notes:     <NotesPage     {...shared}/>,
    ai:        <AIPage        {...shared}/>,
    progress:  <ProgressPage  {...shared}/>,
    eod:       <EODPage       {...shared}/>,
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
      {loading ? (
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'80vh',flexDirection:'column',gap:16 }}>
          <Spinner size={36}/>
          <div style={{ fontSize:12,color:T.muted,fontFamily:T.fontMono }}>{progress||'Loading...'}</div>
        </div>
      ) : pages[page]}
    </Layout>
  )
}

export default function App() {
  return <AuthProvider><AppInner/></AuthProvider>
}
