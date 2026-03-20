import { useState, useEffect, useMemo } from 'react'
import { generateMockTrades, computeStats } from '../lib/data'

// All USDT perpetual futures pairs — covers 3 months of typical trading
const FUTURES_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT',
  'DOGEUSDT','AVAXUSDT','LINKUSDT','LTCUSDT','DOTUSDT','MATICUSDT',
  'UNIUSDT','ATOMUSDT','NEARUSDT','FTMUSDT','SANDUSDT','MANAUSDT',
  'AXSUSDT','GALAUSDT','APEUSDT','OPUSDT','ARBUSDT','INJUSDT',
  'SUIUSDT','SEIUSDT','TIAUSDT','WLDUSDT','FETUSDT','PEPEUSDT',
  'WIFUSDT','BONKUSDT','SHIBUSDT','RUNEUSDT','STXUSDT','ORDIUSDT',
  '1000SATSUSDT','NOTUSDT','EIGENUSDT','ENAUSDT','RENDERUSDT','JUPUSDT',
  'PYTHUSDT','ALTUSDT','ZETAUSDT','MYROUSDT','BLURUSDT','GMTUSDT',
  'AAVEUSDT','MKRUSDT','COMPUSDT','CRVUSDT','SNXUSDT','GRTUSDT',
  'ETCUSDT','XLMUSDT','ALGOUSDT','VETUSDT','TRXUSDT','FILUSDT',
]

async function apiFetch(mode, params = {}, apiKey, apiSecret) {
  const qs  = new URLSearchParams({ mode, ...params }).toString()
  const res = await fetch(`/.netlify/functions/binance?${qs}`, {
    headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Convert a raw Binance futures userTrade into TradeLens format
function normalizeFuturesTrade(t, symbol) {
  const qty   = Math.abs(parseFloat(t.qty))
  const price = parseFloat(t.price)
  const pnl   = parseFloat(t.realizedPnl || 0)
  const fee   = parseFloat(t.commission  || 0)
  return {
    id:              `F${t.id}`,
    symbol,
    side:            t.side,           // BUY or SELL
    qty:             +qty.toFixed(6),
    price:           +price.toFixed(4),
    exitPrice:       +price.toFixed(4),
    fee:             Math.abs(fee),
    pnl:             +pnl.toFixed(4),  // Binance gives real realized PnL per trade ✓
    equity:          10000,
    time:            t.time,
    duration:        0,
    leverage:        1,
    riskPercent:     0,
    source:          'futures',
    orderId:         t.orderId,
    positionSide:    t.positionSide,   // LONG / SHORT / BOTH
    maker:           t.maker,
  }
}

export function useTrades() {
  const [trades,    setTrades]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [connected, setConnected] = useState(false)
  const [source,    setSource]    = useState('demo')
  const [error,     setError]     = useState('')
  const [progress,  setProgress]  = useState('')

  useEffect(() => {
    setTrades(generateMockTrades(120))
    setConnected(true)
    setSource('demo')
  }, [])

  const stats = useMemo(() => computeStats(trades), [trades])

  const loadDemo = () => {
    setLoading(true); setError('')
    setTimeout(() => {
      setTrades(generateMockTrades(120))
      setConnected(true); setSource('demo')
      setLoading(false); setProgress('')
    }, 500)
  }

  const connectBinance = async (apiKey, apiSecret) => {
    if (!apiKey?.trim() || !apiSecret?.trim()) {
      setError('Enter both API Key and Secret Key')
      return { error: true }
    }
    const key = apiKey.trim(), sec = apiSecret.trim()
    setLoading(true); setError(''); setProgress('Connecting to Binance Futures...')

    try {
      // ── Step 1: Verify credentials & check futures account ───────────────
      setProgress('Verifying API credentials...')
      const ping = await apiFetch('ping', {}, key, sec)

      if (!ping.ok) {
        const code = ping.code
        const msg  = code === -2015 ? 'Invalid API Key — copy it again from Binance → API Management'
          : code === -1022          ? 'Invalid Secret Key — re-copy your secret (it\'s only shown once)'
          : code === -2014          ? 'API Key format is wrong — make sure you copied the full string'
          : code === -4061          ? 'This API key doesn\'t have Futures permission. Go to Binance → API Management → Edit → enable "Enable Futures"'
          : ping.error || 'Connection failed'
        setError(msg); loadDemo(); return { error: true }
      }

      setProgress(`✓ Futures account connected · Balance: $${parseFloat(ping.totalWalletBalance || 0).toFixed(2)} · Finding your symbols...`)

      // ── Step 2: Discover symbols via income history (fastest method) ──────
      let tradedSymbols = []
      try {
        const symData = await apiFetch('futures_symbols', {}, key, sec)
        tradedSymbols = symData.symbols || []
      } catch {}

      // Always add common symbols as fallback
      const allSymbols = [...new Set([...tradedSymbols, ...FUTURES_SYMBOLS])]
      setProgress(`Found ${tradedSymbols.length} symbols in your history · Fetching trades for ${allSymbols.length} pairs...`)

      // ── Step 3: Fetch userTrades for each symbol ──────────────────────────
      // userTrades gives us: exact entry/exit price, qty, realized PnL, fee per fill
      const allTrades = []
      const BATCH     = 10

      // Fetch traded symbols first (priority), then rest
      const priority  = [...tradedSymbols, ...FUTURES_SYMBOLS.filter(s => !tradedSymbols.includes(s))]

      for (let i = 0; i < priority.length; i += BATCH) {
        const batch = priority.slice(i, i + BATCH)
        setProgress(`Fetching trades... ${Math.min(i + BATCH, priority.length)} / ${priority.length} symbols · ${allTrades.length} trades found so far`)

        const results = await Promise.allSettled(
          batch.map(sym => apiFetch('futures_trades', { symbol: sym, limit: 1000 }, key, sec))
        )
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value?.trades)) {
            r.value.trades.forEach(t => allTrades.push(normalizeFuturesTrade(t, batch[idx])))
          }
        })
      }

      // ── Step 3b: Fetch leverage per symbol ──────────────────────────────────
      let leverageMap = {}
      try {
        const levData = await apiFetch('futures_leverage', {}, key, sec)
        leverageMap = levData.leverageMap || {}
      } catch {}

      // ── Step 4: Handle no trades found ───────────────────────────────────
      if (allTrades.length === 0) {
        setError(
          `Futures account connected (Balance: $${parseFloat(ping.totalWalletBalance || 0).toFixed(2)}) but no trades found.\n\n` +
          `Possible reasons:\n` +
          `• API key needs "Enable Futures" permission → Binance → API Management → Edit your key\n` +
          `• You might be on a sub-account — generate the API key from that sub-account directly\n` +
          `• All trades might be older than 3 months (Binance limits history on some endpoints)\n` +
          `• Try restarting netlify dev and connecting again`
        )
        loadDemo(); return { demo: true }
      }

      // ── Step 5: Sort by time, rebuild equity curve ────────────────────────
      setProgress(`Processing ${allTrades.length} trades...`)
      allTrades.sort((a, b) => a.time - b.time)

      // Binance futures gives realizedPnl per fill — use it directly
      let equity = 10000
      const final = allTrades.map(t => {
        equity = +(equity + t.pnl - t.fee).toFixed(2)
        return {
          ...t,
          equity,
          leverage: leverageMap[t.symbol] || 1,
          // Estimate risk% from position size vs balance at time of trade
          riskPercent: equity > 0 ? +((Math.abs(t.pnl) / equity) * 100).toFixed(2) : 0,
        }
      })

      setTrades(final)
      setConnected(true)
      setSource('binance')
      setLoading(false)
      setProgress('')

      return { success: true, count: final.length, symbols: tradedSymbols.length }

    } catch (err) {
      const msg = err.message.includes('Failed to fetch') || err.message.includes('NetworkError')
        ? 'Cannot reach the server function.\n\nMake sure you ran "netlify dev" (not "npm run dev") and the app is open at localhost:8888'
        : `Error: ${err.message}`
      setError(msg); loadDemo()
      setLoading(false); setProgress('')
      return { demo: true }
    }
  }

  return { trades, stats, loading, connected, source, error, progress, loadDemo, connectBinance }
}
