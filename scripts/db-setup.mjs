// scripts/db-setup.mjs — cross-platform Node database setup script
// (Works on Windows, macOS, Linux, and Vercel CI without requiring bash)
//
// Usage:
//   npm run db:setup
//   node scripts/db-setup.mjs --if-configured

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ifConfiguredOnly = process.argv.includes('--if-configured')

// Load .env if DATABASE_URL is not already in process.env
if (!process.env.DATABASE_URL) {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/)
        if (match) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, '')
          if (val) process.env.DATABASE_URL = val
        }
      }
      if (process.env.DATABASE_URL) break
    }
  }
}

const rawUrl = process.env.DATABASE_URL || ''
const isPlaceholder =
  !rawUrl ||
  rawUrl.includes('[YOUR-PASSWORD]') ||
  rawUrl.includes('[YOUR-PROJECT-REF]')

if (isPlaceholder) {
  if (ifConfiguredOnly) {
    console.log('[db:setup] DATABASE_URL not configured — skipping build-time DB migration (local fallback mode active).')
    process.exit(0)
  }
  console.error('── Database setup ─────────────────────────────────────')
  console.error('  ERROR: DATABASE_URL is not set (or still has placeholder values).')
  console.error('  - Locally: copy .env.example to .env and set your Postgres DATABASE_URL')
  console.error('  - Vercel:  Project Settings → Environment Variables → add DATABASE_URL')
  process.exit(1)
}

function getMigrateUrl(url) {
  try {
    const u = new URL(url)
    const pooler = u.hostname.endsWith('.pooler.supabase.com')
    const tx = u.port === '6543' || u.searchParams.get('pgbouncer') === 'true'
    if (pooler && tx) {
      u.port = '5432'
      u.searchParams.delete('pgbouncer')
      u.searchParams.delete('connection_limit')
    }
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname)
    if (!local && !u.searchParams.has('sslmode') && !u.searchParams.has('ssl')) {
      u.searchParams.set('sslmode', 'require')
    }
    return u.toString()
  } catch {
    return url
  }
}

function getHostDisplay(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? ':' + u.port : ''}`
  } catch {
    return '(configured)'
  }
}

function run(cmd, env = process.env) {
  execSync(cmd, { stdio: 'inherit', env })
}

const migrateUrl = getMigrateUrl(rawUrl)
console.log('── Database setup ─────────────────────────────────────')
console.log(`  DATABASE_URL: ${getHostDisplay(rawUrl)}`)

if (migrateUrl !== rawUrl) {
  console.log('  migrations: routed via the session pooler (port 5432)')
}

try {
  console.log('  [1/3] generating the Prisma client…')
  run('npx prisma generate && node scripts/patch-prisma-wasm.mjs')

  console.log('  [2/3] applying migrations…')
  const migrateEnv = { ...process.env, DATABASE_URL: migrateUrl }
  try {
    run('npx prisma migrate deploy', migrateEnv)
    console.log('  migrations: ok')
  } catch {
    console.log('  existing schema without migration history detected — baselining…')
    run('npx prisma migrate resolve --applied 0001_init', migrateEnv)
    run('npx prisma migrate deploy', migrateEnv)
    console.log('  migrations: ok (baselined)')
  }

  console.log('  [3/3] seeding the template library…')
  run('npx tsx prisma/seed.ts')

  console.log('── done. Your database is ready: 110 templates, all free. ──')
} catch (err) {
  if (ifConfiguredOnly) {
    console.warn('[db:setup] Warning: could not migrate/seed database during build — runtime self-healing + local fallback remain active.')
    process.exit(0)
  }
  console.error('  Database setup failed. Check DATABASE_URL / network / password.')
  process.exit(1)
}

