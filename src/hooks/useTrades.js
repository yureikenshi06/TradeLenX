import { useState, useEffect, useMemo } from 'react'
import { generateMockTrades, computeStats } from '../lib/data'

const FAPI_ENDPOINTS = [
  'https://fapi.binance.com','https://fapi1.binance.com',
  'https://fapi2.binance.com','https://fapi3.binance.com','https://fapi4.binance.com',
]

const FUTURES_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT',
  'LINKUSDT','LTCUSDT','DOTUSDT','MATICUSDT','UNIUSDT','ATOMUSDT','NEARUSDT','FTMUSDT',
  'SANDUSDT','MANAUSDT','AXSUSDT','GALAUSDT','APEUSDT','OPUSDT','ARBUSDT','INJUSDT',
  'SUIUSDT','SEIUSDT','TIAUSDT','WLDUSDT','FETUSDT','PEPEUSDT','WIFUSDT','BONKUSDT',
  'RUNEUSDT','STXUSDT','ORDIUSDT','ENAUSDT','RENDERUSDT','NOTUSDT','PYTHUSDT',
  'ETCUSDT','XLMUSDT','ALGOUSDT','VETUSDT','TRXUSDT','FILUSDT','AAVEUSDT','GRTUSDT',
  '1000PEPEUSDT','WUSDT','JUPUSDT','JTOUSDT','MEMEUSDT',
]

// Keys stored in sessionStorage (cleared when browser closes — safer than localStorage)
const STORAGE_KEY = 'tlx_binance_keys'
export const saveKeys   = (k, s) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ k, s })) } catch {} }
export const loadKeys   = ()     => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null') } catch { return null } }
export const clearKeys  = ()     => { try { sessionStorage.removeItem(STORAGE_KEY) } catch {} }

async function hmacSign(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

async function binanceFetch(path, params, apiKey, apiSecret) {
  const timestamp   = Date.now()
  const queryString = Object.entries({ ...params, timestamp })
    .map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const signature = await hmacSign(apiSecret, queryString)
  const fullQuery = `${queryString}&signature=${signature}`

  for (const base of FAPI_ENDPOINTS) {
    try {
      const res  = await fetch(`${base}${path}?${fullQuery}`, { headers: { 'X-MBX-APIKEY': apiKey } })
      const text = await res.text()
      let data; try { data = JSON.parse(text) } catch { continue }
      if (!data || (typeof data === 'object' && data.code === 403)) continue
      return { data, endpoint: base }
    } catch { continue }
  }
  throw new Error('All Binance endpoints unreachable.')
}

// Fetch live account balance + open positions
export async function fetchLiveAccount(apiKey, apiSecret) {
  const { data } = await binanceFetch('/fapi/v2/account', {}, apiKey, apiSecret)
  if (data.code) throw new Error(data.msg || `Error ${data.code}`)
  const positions = (data.positions||[])
    .filter(p => parseFloat(p.positionAmt) !== 0)
    .map(p => ({
      symbol:     p.symbol,
      size:       parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      markPrice:  parseFloat(p.markPrice||0),
      unrealizedPnl: parseFloat(p.unrealizedProfit),
      leverage:   parseInt(p.leverage),
      margin:     parseFloat(p.isolatedMargin||p.margin||0),
      side:       parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
    }))
  return {
    totalWalletBalance:    parseFloat(data.totalWalletBalance),
    availableBalance:      parseFloat(data.availableBalance),
    totalUnrealizedProfit: parseFloat(data.totalUnrealizedProfit),
    totalMarginBalance:    parseFloat(data.totalMarginBalance),
    positions,
  }
}

function normalizeTrade(t, symbol) {
  return {
    id:`F${t.id}`, symbol, side:t.side,
    qty:          +Math.abs(parseFloat(t.qty)).toFixed(6),
    price:        +parseFloat(t.price).toFixed(4),
    exitPrice:    +parseFloat(t.price).toFixed(4),
    fee:          +Math.abs(parseFloat(t.commission||0)).toFixed(6),
    pnl:          +parseFloat(t.realizedPnl||0).toFixed(4),
    equity:       10000, time:t.time, leverage:1, riskPercent:0,
    source:'futures', orderId:t.orderId, positionSide:t.positionSide, maker:t.maker,
  }
}

export function useTrades() {
  const [trades,    setTrades]    = useState([])
  const [allTrades, setAllTrades] = useState([])
  const [dateRange, setDateRange] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [connected, setConnected] = useState(false)
  const [source,    setSource]    = useState('demo')
  const [error,     setError]     = useState('')
  const [progress,  setProgress]  = useState('')
  const [savedKeys, setSavedKeys] = useState(loadKeys)  // {k, s}

  // On mount: load mock, then auto-connect if saved keys exist
  useEffect(() => {
    const mock = generateMockTrades(150)
    setTrades(mock); setAllTrades(mock)
    setConnected(true); setSource('demo')
    const keys = loadKeys()
    if (keys?.k && keys?.s) {
      // auto-connect in background
      connectBinance(keys.k, keys.s, true)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!allTrades.length) return
    if (!dateRange) { setTrades(allTrades); return }
    setTrades(allTrades.filter(t => t.time >= dateRange.start && t.time <= dateRange.end))
  }, [dateRange, allTrades])

  const stats = useMemo(() => computeStats(trades), [trades])

  const loadDemo = () => {
    setLoading(true); setError('')
    clearKeys(); setSavedKeys(null)
    setTimeout(() => {
      const mock = generateMockTrades(150)
      setTrades(mock); setAllTrades(mock)
      setConnected(true); setSource('demo')
      setLoading(false); setProgress(''); setDateRange(null)
    }, 500)
  }

  const applyDateRange = (start, end) =>
    setDateRange(start && end ? { start, end } : null)

  const connectBinance = async (apiKey, apiSecret, silent = false) => {
    if (!apiKey?.trim() || !apiSecret?.trim()) {
      setError('Enter both API Key and Secret Key'); return { error:true }
    }
    const key = apiKey.trim(), sec = apiSecret.trim()
    if (!silent) { setLoading(true); setError('') }
    setProgress('Connecting to Binance...')

    try {
      const { data: acct, endpoint } = await binanceFetch('/fapi/v2/account', {}, key, sec)
      if (acct.code) {
        const c = acct.code
        const msg =
          c===-2015 ? 'Invalid API Key — re-copy from Binance → API Management' :
          c===-1022 ? 'Invalid Secret Key — re-copy your secret' :
          c===-2014 ? 'API Key format wrong — copy the full key' :
          c===-4061 ? 'Enable Futures: Binance → API Management → Edit key → Enable Futures' :
          c===-1003 ? 'Rate limited — wait 60 seconds' :
          `Binance error ${c}: ${acct.msg}`
        if (!silent) { setError(msg); loadDemo() }
        setProgress(''); setLoading(false)
        return { error:true }
      }

      setProgress(`✓ ${endpoint} · $${parseFloat(acct.totalWalletBalance||0).toFixed(2)} · Finding symbols...`)

      // Save keys to sessionStorage so user doesn't re-enter
      saveKeys(key, sec); setSavedKeys({ k:key, s:sec })

      let tradedSymbols = []
      try {
        const { data: income } = await binanceFetch('/fapi/v1/income', { incomeType:'REALIZED_PNL', limit:1000 }, key, sec)
        if (Array.isArray(income)) tradedSymbols = [...new Set(income.map(i=>i.symbol).filter(Boolean))]
      } catch {}

      const allSym = [...new Set([...tradedSymbols,...FUTURES_SYMBOLS])]
      const raw = []
      const BATCH = 8
      for (let i=0; i<allSym.length; i+=BATCH) {
        const batch = allSym.slice(i,i+BATCH)
        setProgress(`Fetching trades ${Math.min(i+BATCH,allSym.length)}/${allSym.length} · ${raw.length} found`)
        const results = await Promise.allSettled(
          batch.map(sym => binanceFetch('/fapi/v1/userTrades',{symbol:sym,limit:1000},key,sec))
        )
        results.forEach((r,idx) => {
          if (r.status==='fulfilled' && Array.isArray(r.value?.data))
            r.value.data.forEach(t => raw.push(normalizeTrade(t,batch[idx])))
        })
      }

      if (!raw.length) {
        if (!silent) setError('No futures trades found. Check "Enable Futures" permission on your API key.')
        if (!silent) loadDemo()
        setProgress(''); setLoading(false)
        return { demo:true }
      }

      let leverageMap = {}
      try {
        const { data: a2 } = await binanceFetch('/fapi/v2/account',{},key,sec)
        if (a2.positions) a2.positions.forEach(p => { if (p.leverage) leverageMap[p.symbol]=parseInt(p.leverage) })
      } catch {}

      setProgress(`Building equity curve for ${raw.length} trades...`)
      raw.sort((a,b)=>a.time-b.time)
      let equity = 10000
      const final = raw.map(t => {
        equity = +(equity+t.pnl-t.fee).toFixed(2)
        return { ...t, equity, leverage:leverageMap[t.symbol]||1 }
      })

      setTrades(final); setAllTrades(final)
      setConnected(true); setSource('binance')
      setLoading(false); setProgress(''); setDateRange(null)
      return { success:true, count:final.length }

    } catch(err) {
      const msg = err.message.includes('All Binance')
        ? 'Cannot reach Binance. Check internet connection.'
        : `Error: ${err.message}`
      if (!silent) { setError(msg); loadDemo() }
      setLoading(false); setProgress('')
      return { demo:true }
    }
  }

  const disconnectBinance = () => { clearKeys(); setSavedKeys(null); loadDemo() }

  return {
    trades, allTrades, stats, loading, connected, source,
    error, progress, dateRange, savedKeys,
    loadDemo, connectBinance, applyDateRange, disconnectBinance,
  }
}
