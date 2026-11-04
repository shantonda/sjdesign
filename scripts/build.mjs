// scripts/build.mjs — one build entrypoint for every deploy target
// (Vercel, self-hosted Node, Netlify, and Cloudflare Workers).

import { execSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'

/** run a shell command, inheriting stdio so CI logs stream normally */
function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

const isWorkersBuildsCi = process.env.WORKERS_CI === '1'

// Ensure Prisma client is generated and, if DATABASE_URL is configured,
// automatically apply migrations + seed the 110-template library.
run('node scripts/db-setup.mjs --if-configured')

if (isWorkersBuildsCi) {
  console.log('[build] Cloudflare Workers Builds detected (WORKERS_CI=1) → building the OpenNext worker (.open-next/)')
  run('opennextjs-cloudflare build')
} else {
  run('next build')
  // standalone server layout (Vercel / self-hosted `npm start` / Netlify)
  if (existsSync('.next/standalone') && existsSync('.next/static')) {
    cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
  }
  if (existsSync('.next/standalone') && existsSync('public')) {
    cpSync('public', '.next/standalone/public', { recursive: true })
  }
}
