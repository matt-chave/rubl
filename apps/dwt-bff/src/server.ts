/**
 * Local BFF for workshop UIs. It holds software client secrets and operator
 * API keys so the browser never sees them on the movements path, and it
 * proxies onboarding signup to DwtOnboarding so the widgets never call AWS.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(): void {
  for (const file of [join(here, '..', '.env.local'), join(here, '..', '..', '..', '.env.local')]) {
    if (!existsSync(file)) {
      continue
    }
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const eq = trimmed.indexOf('=')
      if (eq < 1) {
        continue
      }
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

loadEnv()

const PORT = Number(process.env.BFF_PORT ?? 8787)
const API_BASE = (process.env.API_BASE ?? '').replace(/\/$/, '')
const ONBOARDING_API_BASE = (process.env.ONBOARDING_API_BASE ?? '').replace(/\/$/, '')
const TOKEN_URL = process.env.TOKEN_URL ?? ''
const CLIENT_ID = process.env.CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? ''
const API_KEY = process.env.API_KEY ?? ''

let cachedToken: { value: string; expiresAt: number } | null = null

async function softwareToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }
  if (!TOKEN_URL || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('BFF is missing TOKEN_URL, CLIENT_ID or CLIENT_SECRET in .env.local')
  }
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=dwt/movements',
  })
  const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!response.ok || !body.access_token) {
    throw new Error(body.error ?? `Token request failed (${response.status})`)
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  }
  return body.access_token
}

async function proxy(path: string, method: string, payload?: unknown): Promise<{ status: number; body: unknown }> {
  if (!API_BASE || !API_KEY) {
    throw new Error('BFF is missing API_BASE or API_KEY in .env.local')
  }
  const token = await softwareToken()
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : {} }
}

async function onboardingProxy(
  path: string,
  payload: unknown,
): Promise<{ status: number; body: unknown }> {
  if (!ONBOARDING_API_BASE) {
    throw new Error('BFF is missing ONBOARDING_API_BASE in .env.local (DwtOnboarding output OnboardingApiBaseUrl)')
  }
  const response = await fetch(`${ONBOARDING_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : {} }
}

function cors(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function send(res: ServerResponse, status: number, body: unknown): void {
  cors(res)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
    if (req.method === 'OPTIONS') {
      cors(res)
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'GET' && url.pathname === '/bff/health') {
      send(res, 200, {
        ok: true,
        configured: Boolean(API_BASE && TOKEN_URL && CLIENT_ID && API_KEY),
        onboardingConfigured: Boolean(ONBOARDING_API_BASE),
      })
      return
    }
    if (req.method === 'POST' && url.pathname === '/bff/software-providers') {
      const payload = await readJson(req)
      const result = await onboardingProxy('/software-providers', payload)
      send(res, result.status, result.body)
      return
    }
    if (req.method === 'POST' && url.pathname === '/bff/operators') {
      const payload = await readJson(req)
      const result = await onboardingProxy('/operators', payload)
      send(res, result.status, result.body)
      return
    }
    if (req.method === 'POST' && url.pathname === '/bff/id-reservations') {
      const payload = (await readJson(req)) as { movementCount?: number; deliveryCount?: number }
      const result = await proxy('/id-reservations', 'POST', {
        movementCount: payload.movementCount ?? 5,
        deliveryCount: payload.deliveryCount ?? 0,
      })
      send(res, result.status, result.body)
      return
    }
    if (req.method === 'POST' && url.pathname === '/bff/movements') {
      const payload = await readJson(req)
      const result = await proxy('/movements', 'POST', payload)
      send(res, result.status, result.body)
      return
    }
    send(res, 404, { message: 'Not found' })
  } catch (error) {
    send(res, 500, { message: error instanceof Error ? error.message : 'BFF error' })
  }
})

server.listen(PORT, () => {
  console.log(`DWT BFF listening on http://127.0.0.1:${PORT}`)
  if (!ONBOARDING_API_BASE) {
    console.log('For signup forms, set ONBOARDING_API_BASE from DwtOnboarding OnboardingApiBaseUrl.')
  }
  if (!API_BASE || !CLIENT_ID) {
    console.log('Copy apps/dwt-bff/.env.example to apps/dwt-bff/.env.local and fill it from Bruno.')
  }
})
