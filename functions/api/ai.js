// Cloudflare Pages Function — AI proxy via Groq (free)
// URL: /api/ai
// Set GROQ_API_KEY in Cloudflare Pages → Settings → Environment Variables

export async function onRequest(context) {
  const { request, env } = context

  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers })
  }

  const groqKey = env.GROQ_API_KEY

  // GET = debug check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      ok:           true,
      groqKeySet:   !!groqKey,
      keyPreview:   groqKey ? groqKey.slice(0, 12) + '...' : 'NOT FOUND',
      runtime:      'Cloudflare Workers',
      instructions: groqKey
        ? 'Key loaded. AI should work.'
        : 'Add GROQ_API_KEY in Cloudflare Pages → Settings → Environment Variables',
    }), { status: 200, headers })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers })
  }

  if (!groqKey) {
    return new Response(JSON.stringify({
      error: 'GROQ_API_KEY not set.\n\nFix: Cloudflare Pages dashboard → your project → Settings → Environment Variables → add GROQ_API_KEY',
    }), { status: 400, headers })
  }

  let system, userMsg
  try {
    const body = await request.json()
    system  = body.system
    userMsg = body.userMsg
    if (!system || !userMsg) throw new Error('Missing system or userMsg')
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request: ' + e.message }), { status: 400, headers })
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  2000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system  },
          { role: 'user',   content: userMsg },
        ],
      }),
    })

    const data = await res.json()

    if (data.error) {
      const msg  = data.error.message || JSON.stringify(data.error)
      const hint = res.status === 401            ? 'Invalid API key — check console.groq.com'
        : msg.includes('rate_limit')             ? 'Rate limit — wait 60 seconds'
        : msg.includes('model_not_found')        ? 'Model unavailable'
        : 'Check console.groq.com'
      return new Response(JSON.stringify({ error: msg, hint }), { status: res.status, headers })
    }

    const text = data.choices?.[0]?.message?.content
    if (!text) return new Response(JSON.stringify({ error: 'Empty response from Groq' }), { status: 500, headers })

    return new Response(JSON.stringify({ text }), { status: 200, headers })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
