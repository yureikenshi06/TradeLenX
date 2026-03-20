const crypto = require('crypto')

const SPOT_BASE    = 'https://api.binance.com'
const FUTURES_BASE = 'https://fapi.binance.com'   // USDT-M Perpetual Futures

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex')
}

async function fFetch(baseUrl, path, params, apiKey, apiSecret) {
  const timestamp   = Date.now()
  const queryString = Object.entries({ ...params, timestamp })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const signature = sign(queryString, apiSecret)
  const url = `${baseUrl}${path}?${queryString}&signature=${signature}`
  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': apiKey },
  })
  const text = await res.text()
  try { return JSON.parse(text) }
  catch { return { error: text, code: res.status } }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-api-secret',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  const apiKey    = event.headers['x-api-key']    || process.env.BINANCE_API_KEY
  const apiSecret = event.headers['x-api-secret'] || process.env.BINANCE_API_SECRET
  if (!apiKey || !apiSecret) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing API credentials' }) }
  }

  const mode   = event.queryStringParameters?.mode || 'futures_trades'
  const symbol = event.queryStringParameters?.symbol
  const limit  = parseInt(event.queryStringParameters?.limit || '1000')
  const startTime = event.queryStringParameters?.startTime

  try {

    // ── MODE: ping — verify credentials against futures account ────────────
    if (mode === 'ping') {
      // Try futures account first (since user does perpetual futures)
      const fut = await fFetch(FUTURES_BASE, '/fapi/v2/account', {}, apiKey, apiSecret)
      if (!fut.code && fut.totalWalletBalance !== undefined) {
        return { statusCode: 200, headers, body: JSON.stringify({
          ok: true,
          accountType: 'FUTURES',
          totalWalletBalance: fut.totalWalletBalance,
          totalUnrealizedProfit: fut.totalUnrealizedProfit,
          totalMarginBalance: fut.totalMarginBalance,
          positions: (fut.positions || [])
            .filter(p => parseFloat(p.positionAmt) !== 0)
            .map(p => ({ symbol: p.symbol, size: p.positionAmt, pnl: p.unrealizedProfit })),
          availableBalance: fut.availableBalance,
        })}
      }
      // Fallback: try spot
      const spot = await fFetch(SPOT_BASE, '/api/v3/account', {}, apiKey, apiSecret)
      if (spot.code) return { statusCode: 400, headers, body: JSON.stringify({ error: spot.msg || spot.error, code: spot.code }) }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, accountType: 'SPOT' }) }
    }

    // ── MODE: futures_symbols — get all symbols ever traded ─────────────────
    if (mode === 'futures_symbols') {
      // incomeHistory gives us all symbols with PnL activity
      const income = await fFetch(FUTURES_BASE, '/fapi/v1/income', {
        incomeType: 'REALIZED_PNL',
        limit: 1000,
      }, apiKey, apiSecret)

      if (income.code) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: income.msg, code: income.code }) }
      }

      const symbols = [...new Set((income || []).map(i => i.symbol).filter(Boolean))]
      return { statusCode: 200, headers, body: JSON.stringify({ symbols, incomeCount: income.length }) }
    }

    // ── MODE: futures_trades — trades for one symbol ────────────────────────
    if (mode === 'futures_trades') {
      if (!symbol) return { statusCode: 400, headers, body: JSON.stringify({ error: 'symbol required' }) }
      const params = { symbol, limit }
      if (startTime) params.startTime = startTime
      const data = await fFetch(FUTURES_BASE, '/fapi/v1/userTrades', params, apiKey, apiSecret)
      if (data.code) {
        // -2011 = unknown order, -1121 = invalid symbol — not an error, just no trades
        if (data.code === -2011 || data.code === -1121) {
          return { statusCode: 200, headers, body: JSON.stringify({ trades: [] }) }
        }
        return { statusCode: 400, headers, body: JSON.stringify({ error: data.msg, code: data.code }) }
      }
      return { statusCode: 200, headers, body: JSON.stringify({
        trades: Array.isArray(data) ? data : [],
        source: 'futures',
      })}
    }

    // ── MODE: futures_income — realized PnL history (most complete) ─────────
    if (mode === 'futures_income') {
      const params = { incomeType: 'REALIZED_PNL', limit: 1000 }
      if (startTime) params.startTime = startTime
      if (symbol)    params.symbol    = symbol
      const data = await fFetch(FUTURES_BASE, '/fapi/v1/income', params, apiKey, apiSecret)
      if (data.code) return { statusCode: 400, headers, body: JSON.stringify({ error: data.msg, code: data.code }) }
      return { statusCode: 200, headers, body: JSON.stringify({
        income: Array.isArray(data) ? data : [],
      })}
    }

    // ── MODE: futures_orders — closed orders with avgPrice ──────────────────
    if (mode === 'futures_orders') {
      if (!symbol) return { statusCode: 400, headers, body: JSON.stringify({ error: 'symbol required' }) }
      const data = await fFetch(FUTURES_BASE, '/fapi/v1/allOrders', { symbol, limit }, apiKey, apiSecret)
      if (data.code) return { statusCode: 400, headers, body: JSON.stringify({ error: data.msg, code: data.code }) }
      const filled = (Array.isArray(data) ? data : []).filter(o => o.status === 'FILLED')
      return { statusCode: 200, headers, body: JSON.stringify({ orders: filled }) }
    }


    // ── MODE: futures_leverage — get leverage for all positions ─────────────
    if (mode === 'futures_leverage') {
      const data = await fFetch(FUTURES_BASE, '/fapi/v2/account', {}, apiKey, apiSecret)
      if (data.code) return { statusCode: 400, headers, body: JSON.stringify({ error: data.msg }) }
      const leverageMap = {}
      ;(data.positions || []).forEach(p => { if (p.leverage) leverageMap[p.symbol] = parseInt(p.leverage) })
      return { statusCode: 200, headers, body: JSON.stringify({ leverageMap }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown mode: ${mode}` }) }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, stack: err.stack }) }
  }
}
