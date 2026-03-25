import { useState, useEffect, useMemo } from 'react'
import { generateMockTrades, computeStats } from '../lib/data'
import { useAuth } from './useAuth'
import { fetchCachedTrades, fetchEarliestTradeTime, fetchLatestTradeTime, upsertCachedTrades } from '../lib/supabase'

const FAPI_ENDPOINTS = [
  'https://fapi.binance.com', 'https://fapi1.binance.com',
  'https://fapi2.binance.com', 'https://fapi3.binance.com', 'https://fapi4.binance.com',
]

const FUTURES_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT',
  'LINKUSDT', 'LTCUSDT', 'DOTUSDT', 'MATICUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT',
  'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'GALAUSDT', 'APEUSDT', 'OPUSDT', 'ARBUSDT', 'INJUSDT',
  'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'WLDUSDT', 'FETUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT',
  'RUNEUSDT', 'STXUSDT', 'ORDIUSDT', 'ENAUSDT', 'RENDERUSDT', 'NOTUSDT', 'PYTHUSDT',
  'ETCUSDT', 'XLMUSDT', 'ALGOUSDT', 'VETUSDT', 'TRXUSDT', 'FILUSDT', 'AAVEUSDT', 'GRTUSDT',
  '1000PEPEUSDT', 'WUSDT', 'JUPUSDT', 'JTOUSDT', 'MEMEUSDT',
]

const STORAGE_KEY = 'tlx_binance_keys'
const LOCAL_STORAGE_KEY = 'tlx_binance_keys_persisted'
const INITIAL_BACKFILL_START = new Date('2026-02-25T00:00:00+05:30').getTime()
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000

export const saveKeys = (k, s) => {
  const payload = JSON.stringify({ k, s })
  try { sessionStorage.setItem(STORAGE_KEY, payload) } catch {}
  try { localStorage.setItem(LOCAL_STORAGE_KEY, payload) } catch {}
}

export const loadKeys = () => {
  try {
    const sessionKeys = sessionStorage.getItem(STORAGE_KEY)
    if (sessionKeys) return JSON.parse(sessionKeys)
  } catch {}
  try {
    const localKeys = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (localKeys) {
      sessionStorage.setItem(STORAGE_KEY, localKeys)
      return JSON.parse(localKeys)
    }
  } catch {}
  return null
}

export const clearKeys = () => {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  try { localStorage.removeItem(LOCAL_STORAGE_KEY) } catch {}
}

async function hmacSign(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function binanceFetch(path, params, apiKey, apiSecret) {
  const timestamp = Date.now()
  const queryString = Object.entries({ ...params, timestamp })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const signature = await hmacSign(apiSecret, queryString)
  const fullQuery = `${queryString}&signature=${signature}`

  for (const base of FAPI_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}?${fullQuery}`, { headers: { 'X-MBX-APIKEY': apiKey } })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { continue }
      if (!data || (typeof data === 'object' && data.code === 403)) continue
      return { data, endpoint: base }
    } catch {
      continue
    }
  }

  throw new Error('All Binance endpoints unreachable.')
}

export async function fetchLiveAccount(apiKey, apiSecret) {
  const { data } = await binanceFetch('/fapi/v2/account', {}, apiKey, apiSecret)
  if (data.code) throw new Error(data.msg || `Error ${data.code}`)
  const positions = (data.positions || [])
    .filter((p) => parseFloat(p.positionAmt) !== 0)
    .map((p) => ({
      symbol: p.symbol,
      size: parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      markPrice: parseFloat(p.markPrice || 0),
      unrealizedPnl: parseFloat(p.unrealizedProfit),
      leverage: parseInt(p.leverage),
      margin: parseFloat(p.isolatedMargin || p.margin || 0),
      side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
    }))
  return {
    totalWalletBalance: parseFloat(data.totalWalletBalance),
    availableBalance: parseFloat(data.availableBalance),
    totalUnrealizedProfit: parseFloat(data.totalUnrealizedProfit),
    totalMarginBalance: parseFloat(data.totalMarginBalance),
    positions,
  }
}

function normalizeTrade(t, symbol) {
  return {
    id: `F-${symbol}-${t.id}-${t.time}`,
    symbol,
    side: t.side,
    qty: +Math.abs(parseFloat(t.qty)).toFixed(6),
    price: +parseFloat(t.price).toFixed(4),
    exitPrice: +parseFloat(t.price).toFixed(4),
    fee: +Math.abs(parseFloat(t.commission || 0)).toFixed(6),
    pnl: +parseFloat(t.realizedPnl || 0).toFixed(4),
    equity: 10000,
    time: t.time,
    leverage: 0,
    riskPercent: 0,
    source: 'futures',
    orderId: String(t.orderId || ''),
    positionSide: t.positionSide,
    maker: !!t.maker,
  }
}

function mapCachedTrade(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    qty: Number(row.qty || 0),
    price: Number(row.price || 0),
    exitPrice: Number(row.exit_price || 0),
    fee: Number(row.fee || 0),
    pnl: Number(row.pnl || 0),
    equity: Number(row.equity || 0),
    time: Number(row.time || 0),
    leverage: Number(row.leverage || 1),
    riskPercent: Number(row.risk_percent || 0),
    source: row.source || 'futures',
    orderId: row.order_id || '',
    positionSide: row.position_side || '',
    maker: !!row.maker,
  }
}

function buildEquityCurve(rawTrades, startingEquity = 10000, leverageMap = {}) {
  const sorted = [...rawTrades].sort((a, b) => a.time - b.time)
  let equity = startingEquity
  return sorted.map((trade) => {
    equity = +(equity + trade.pnl - trade.fee).toFixed(2)
    const tradeLeverage = Number(trade.leverage || 0)
    const fallbackLeverage = Number(leverageMap[trade.symbol] || 0)
    return {
      ...trade,
      equity,
      leverage: tradeLeverage > 1
        ? tradeLeverage
        : fallbackLeverage > 0
          ? fallbackLeverage
          : Math.max(1, tradeLeverage || 1),
    }
  })
}

function mergeTrades(existingTrades, incomingTrades) {
  const map = new Map()
  existingTrades.forEach((trade) => map.set(trade.id, trade))
  incomingTrades.forEach((trade) => map.set(trade.id, trade))
  return [...map.values()].sort((a, b) => a.time - b.time)
}

function getTrackedSymbols(existingTrades, discoveredSymbols) {
  const cachedSymbols = existingTrades.map((trade) => trade.symbol).filter(Boolean)
  return [...new Set([...cachedSymbols, ...discoveredSymbols, ...FUTURES_SYMBOLS])]
}

async function fetchTradesForSymbol(symbol, apiKey, apiSecret, startTime, windowSizeMs = SEVEN_DAYS_MS) {
  const now = Date.now()
  const effectiveStart = startTime || Math.max(INITIAL_BACKFILL_START, now - SIX_MONTHS_MS)
  const trades = []

  for (let windowStart = effectiveStart; windowStart <= now; windowStart += windowSizeMs) {
    const windowEnd = Math.min(windowStart + windowSizeMs - 1, now)
    const { data } = await binanceFetch(
      '/fapi/v1/userTrades',
      { symbol, limit: 1000, startTime: windowStart, endTime: windowEnd },
      apiKey,
      apiSecret
    )

    if (Array.isArray(data)) {
      data.forEach((trade) => trades.push(normalizeTrade(trade, symbol)))
    }
  }

  return trades
}

export function useTrades() {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
  const [allTrades, setAllTrades] = useState([])
  const [dateRange, setDateRange] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [source, setSource] = useState('demo')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [savedKeys, setSavedKeys] = useState(loadKeys)

  useEffect(() => {
    if (!allTrades.length) return
    if (!dateRange) {
      setTrades(allTrades)
      return
    }
    setTrades(allTrades.filter((t) => t.time >= dateRange.start && t.time <= dateRange.end))
  }, [dateRange, allTrades])

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      if (!user?.id) {
        const mock = generateMockTrades(150)
        if (!active) return
        setTrades(mock)
        setAllTrades(mock)
        setConnected(true)
        setSource('demo')
        setLoading(false)
        setProgress('')
        return
      }

      setLoading(true)
      setError('')
      setProgress('Loading saved trades...')

      const cachedRows = await fetchCachedTrades(user.id)
      if (!active) return

      if (cachedRows.length) {
        const cachedTrades = cachedRows.map(mapCachedTrade)
        setAllTrades(cachedTrades)
        setTrades(cachedTrades)
        setConnected(true)
        setSource('database')
        setProgress(`Loaded ${cachedTrades.length} saved trades. Checking for new trades...`)
      } else {
        setAllTrades([])
        setTrades([])
        setConnected(false)
        setSource('database')
        setProgress('No saved trades yet.')
      }

      const keys = loadKeys()
      setSavedKeys(keys)
      if (keys?.k && keys?.s) {
        await connectBinance(keys.k, keys.s, true)
      } else {
        setLoading(false)
        setProgress('')
      }
    }

    hydrate()

    return () => {
      active = false
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => computeStats(trades), [trades])

  const loadDemo = () => {
    setLoading(true)
    setError('')
    clearKeys()
    setSavedKeys(null)
    setTimeout(() => {
      const mock = generateMockTrades(150)
      setTrades(mock)
      setAllTrades(mock)
      setConnected(true)
      setSource('demo')
      setLoading(false)
      setProgress('')
      setDateRange(null)
    }, 500)
  }

  const applyDateRange = (start, end) =>
    setDateRange(start && end ? { start, end } : null)

  const connectBinance = async (apiKey, apiSecret, silent = false) => {
    if (!apiKey?.trim() || !apiSecret?.trim()) {
      setError('Enter both API Key and Secret Key')
      return { error: true }
    }

    const key = apiKey.trim()
    const sec = apiSecret.trim()
    const userId = user?.id

    if (!silent) {
      setLoading(true)
      setError('')
    }
    setProgress('Connecting to Binance...')

    try {
      const { data: acct, endpoint } = await binanceFetch('/fapi/v2/account', {}, key, sec)
      if (acct.code) {
        const c = acct.code
        const msg =
          c === -2015 ? 'Invalid API Key. Re-copy it from Binance API Management.' :
          c === -1022 ? 'Invalid Secret Key. Re-copy your secret.' :
          c === -2014 ? 'API Key format is wrong. Copy the full key.' :
          c === -4061 ? 'Enable Futures on your Binance API key.' :
          c === -1003 ? 'Rate limited. Wait 60 seconds and try again.' :
          `Binance error ${c}: ${acct.msg}`
        if (!silent) {
          setError(msg)
          loadDemo()
        }
        setProgress('')
        setLoading(false)
        return { error: true }
      }

      saveKeys(key, sec)
      setSavedKeys({ k: key, s: sec })

      const latestSavedTime = userId ? await fetchLatestTradeTime(userId) : null
      const earliestSavedTime = userId ? await fetchEarliestTradeTime(userId) : null
      const hasOnlyRecentCache = earliestSavedTime && (Date.now() - Number(earliestSavedTime) < SEVEN_DAYS_MS)
      const incompleteBackfill = earliestSavedTime && Number(earliestSavedTime) > INITIAL_BACKFILL_START
      const shouldDoFullBackfill = !latestSavedTime || hasOnlyRecentCache || incompleteBackfill
      const startTime = shouldDoFullBackfill ? undefined : Number(latestSavedTime) + 1
      const windowSizeMs = startTime ? ONE_DAY_MS : SEVEN_DAYS_MS
      setProgress(`Connected to ${endpoint}. ${startTime ? 'Syncing day-by-day new trades...' : 'Loading full trade history from February in 7-day chunks...'}`)

      let tradedSymbols = []
      try {
        const incomeParams = { incomeType: 'REALIZED_PNL', limit: 1000 }
        if (startTime) incomeParams.startTime = startTime
        const { data: income } = await binanceFetch('/fapi/v1/income', incomeParams, key, sec)
        if (Array.isArray(income)) tradedSymbols = [...new Set(income.map((i) => i.symbol).filter(Boolean))]
      } catch {}

      const trackedSymbols = getTrackedSymbols(allTrades, tradedSymbols)
      const raw = []
      const BATCH = 8

      for (let i = 0; i < trackedSymbols.length; i += BATCH) {
        const batch = trackedSymbols.slice(i, i + BATCH)
        setProgress(`Checking ${Math.min(i + BATCH, trackedSymbols.length)}/${trackedSymbols.length} symbols for new trades...`)
        const results = await Promise.allSettled(batch.map((sym) => fetchTradesForSymbol(sym, key, sec, startTime, windowSizeMs)))

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            result.value.forEach((trade) => raw.push(trade))
          }
        })
      }

      let leverageMap = {}
      try {
        const { data: accountData } = await binanceFetch('/fapi/v2/account', {}, key, sec)
        if (accountData.positions) {
          accountData.positions.forEach((position) => {
            if (position.leverage) leverageMap[position.symbol] = parseInt(position.leverage)
          })
        }
      } catch {}

      const merged = mergeTrades(allTrades, raw)
      if (!merged.length) {
        if (!silent) setError('No futures trades found. Check your Binance Futures API permissions.')
        setConnected(false)
        setSource('database')
        setLoading(false)
        setProgress('')
        return { demo: true }
      }

      setProgress(raw.length ? `Saving ${raw.length} new trades...` : 'No new trades found. Refreshing cache...')
      const finalTrades = buildEquityCurve(merged, 10000, leverageMap)

      if (userId) {
        await upsertCachedTrades(userId, finalTrades)
      }

      setAllTrades(finalTrades)
      setTrades(!dateRange ? finalTrades : finalTrades.filter((t) => t.time >= dateRange.start && t.time <= dateRange.end))
      setConnected(true)
      setSource('binance')
      setLoading(false)
      setProgress(raw.length ? `Synced ${raw.length} new trades.` : 'Already up to date.')
      setDateRange((current) => current)
      return {
        success: true,
        count: finalTrades.length,
        newCount: raw.length,
        symbols: [...new Set(finalTrades.map((trade) => trade.symbol))].length,
      }
    } catch (err) {
      const msg = err.message.includes('All Binance')
        ? 'Cannot reach Binance. Check your internet connection.'
        : `Error: ${err.message}`
      if (!silent) {
        setError(msg)
        loadDemo()
      } else {
        setError(msg)
      }
      setLoading(false)
      setProgress('')
      return { demo: true }
    }
  }

  const disconnectBinance = () => {
    clearKeys()
    setSavedKeys(null)
    if (user?.id) {
      setSource('database')
      setConnected(allTrades.length > 0)
      return
    }
    loadDemo()
  }

  return {
    trades,
    allTrades,
    stats,
    loading,
    connected,
    source,
    error,
    progress,
    dateRange,
    savedKeys,
    loadDemo,
    connectBinance,
    applyDateRange,
    disconnectBinance,
  }
}
