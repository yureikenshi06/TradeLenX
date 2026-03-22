// Cloudflare Pages Function — Binance Futures proxy
// URL: /api/binance?mode=ping
// Set BINANCE_API_KEY and BINANCE_API_SECRET in Cloudflare Pages Environment Variables
// NOTE: Binance may still block some Cloudflare IPs — the app also connects directly
//       from the browser using WebCrypto, so this proxy is only used as a fallback.

const FUTURES_ENDPOINTS = [
  'https://fapi.binance.com',
  'https://fapi1.binance.com',
  'https://fapi2.binance.com',
  'https://fapi3.binance.com',
  'https://fapi4.binance.com',
]

async function hmacSign(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function futuresFetch(path, params, apiKey, apiSecret) {
  const timestamp   = Date.now()
  const queryString = Object.entries({ ...params, timestamp })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const signature = await hmacSign(apiSecret, queryString)
  const fullQuery = `${queryString}&signature=${signature}`

  for (const base of FUTURES_ENDPOINTS) {
    try {
      const res  = await fetch(`${base}${path}?${fullQuery}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
        signal:  AbortSignal.timeout(7000),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { continue }
      if (data && data.code !== 403) return { data, endpoint: base }
    } catch { continue }
  }
  return { data: { code: -1, msg: 'All endpoints unreachable' }, endpoint: null }
}

export async function onRequest(context) {
  const { request, env } = context
  const url    = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)

  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-api-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers })

  const apiKey    = request.headers.get('x-api-key')    || env.BINANCE_API_KEY
  const apiSecret = request.headers.get('x-api-secret') || env.BINANCE_API_SECRET

  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({
      error: 'Missing API credentials. Set BINANCE_API_KEY and BINANCE_API_SECRET in Cloudflare Pages Environment Variables.',
    }), { status: 400, headers })
  }

  const mode   = params.mode   || 'ping'
  const symbol = params.symbol
  const limit  = parseInt(params.limit || '1000')

  try {
    if (mode === 'ping') {
      const { data, endpoint } = await futuresFetch('/fapi/v2/account', {}, apiKey, apiSecret)
      if (data.code) {
        return new Response(JSON.stringify({ error: data.msg, code: data.code, triedEndpoints: FUTURES_ENDPOINTS }), { status: 400, headers })
      }
      return new Response(JSON.stringify({
        ok: true, accountType: 'FUTURES', endpoint,
        totalWalletBalance:    data.totalWalletBalance,
        availableBalance:      data.availableBalance,
        totalUnrealizedProfit: data.totalUnrealizedProfit,
      }), { status: 200, headers })
    }

    if (mode === 'futures_symbols') {
      const { data } = await futuresFetch('/fapi/v1/income', { incomeType: 'REALIZED_PNL', limit: 1000 }, apiKey, apiSecret)
      if (data.code) return new Response(JSON.stringify({ error: data.msg }), { status: 400, headers })
      const symbols = [...new Set((data || []).map(i => i.symbol).filter(Boolean))]
      return new Response(JSON.stringify({ symbols }), { status: 200, headers })
    }

    if (mode === 'futures_trades') {
      if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400, headers })
      const { data } = await futuresFetch('/fapi/v1/userTrades', { symbol, limit }, apiKey, apiSecret)
      if (data.code && data.code !== -2011 && data.code !== -1121) {
        return new Response(JSON.stringify({ error: data.msg, code: data.code }), { status: 400, headers })
      }
      return new Response(JSON.stringify({ trades: Array.isArray(data) ? data : [] }), { status: 200, headers })
    }

    if (mode === 'futures_income') {
      const p = { incomeType: 'REALIZED_PNL', limit: 1000 }
      if (params.startTime) p.startTime = params.startTime
      if (symbol)           p.symbol    = symbol
      const { data } = await futuresFetch('/fapi/v1/income', p, apiKey, apiSecret)
      if (data.code) return new Response(JSON.stringify({ error: data.msg }), { status: 400, headers })
      return new Response(JSON.stringify({ income: Array.isArray(data) ? data : [] }), { status: 200, headers })
    }

    if (mode === 'futures_leverage') {
      const { data } = await futuresFetch('/fapi/v2/account', {}, apiKey, apiSecret)
      if (data.code) return new Response(JSON.stringify({ error: data.msg }), { status: 400, headers })
      const leverageMap = {}
      ;(data.positions || []).forEach(p => { if (p.leverage) leverageMap[p.symbol] = parseInt(p.leverage) })
      return new Response(JSON.stringify({ leverageMap }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), { status: 400, headers })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
