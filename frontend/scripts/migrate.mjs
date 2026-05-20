#!/usr/bin/env node
// ============================================================
// Supabase Migration Runner
// ============================================================
// Usage:
//   pnpm db:migrate          → Run all pending migrations
//   pnpm db:migrate:status   → Show migration status
//   pnpm db:seed             → Run only seed migrations (20240002_*)
//   pnpm db:reset            → Drop _migrations table and re-run everything
//
// Requires in .env (or .env.local):
//   SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres
//   OR
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (REST fallback)
// ============================================================

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ── Config ────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  Missing env vars:')
  console.error('    NEXT_PUBLIC_SUPABASE_URL')
  console.error('    SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n    Add them to your .env file and retry.\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────
const COLORS = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
}

const log = {
  info:    (msg) => console.log(`${COLORS.cyan}ℹ  ${msg}${COLORS.reset}`),
  ok:      (msg) => console.log(`${COLORS.green}✔  ${msg}${COLORS.reset}`),
  skip:    (msg) => console.log(`${COLORS.grey}⏭  ${msg}${COLORS.reset}`),
  warn:    (msg) => console.warn(`${COLORS.yellow}⚠  ${msg}${COLORS.reset}`),
  error:   (msg) => console.error(`${COLORS.red}✖  ${msg}${COLORS.reset}`),
  section: (msg) => console.log(`\n${COLORS.cyan}── ${msg} ──${COLORS.reset}`),
}

// ── Execute raw SQL via Supabase RPC ─────────────────────────
async function exec(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
  if (error) throw new Error(error.message)
}

// Bootstrap: create exec_sql helper + _migrations tracking table
async function bootstrap() {
  // Create a helper RPC that can execute arbitrary SQL (service role only)
  const helperFn = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `
  const { error: fnErr } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' })

  if (fnErr) {
    // RPC doesn't exist yet — create it via REST (only works if service role can do DDL)
    log.warn('exec_sql RPC not found — trying to create it via REST …')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql_query: helperFn }),
    })
    if (!res.ok) {
      log.error('Cannot bootstrap exec_sql. Run the following in Supabase SQL editor first:')
      console.log(helperFn)
      process.exit(1)
    }
  }

  // Create migrations tracking table
  await exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      checksum    TEXT
    );
  `)
}

// ── Read applied migrations ───────────────────────────────────
async function getApplied() {
  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('name')

  if (error) throw new Error(`Cannot read _migrations: ${error.message}`)
  return new Set((data ?? []).map((r) => r.name))
}

// ── Record migration as applied ───────────────────────────────
async function markApplied(name, checksum) {
  const { error } = await supabase
    .from('_migrations')
    .insert({ name, checksum })

  if (error) throw new Error(`Cannot record migration "${name}": ${error.message}`)
}

// ── Simple checksum (length + first 64 chars hash proxy) ──────
function checksum(content) {
  let h = 0
  for (let i = 0; i < content.length; i++) {
    h = (Math.imul(31, h) + content.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}

// ── Get sorted migration files ────────────────────────────────
function getMigrationFiles(filter) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log.warn(`Migrations directory not found: ${MIGRATIONS_DIR}`)
    return []
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => (filter ? f.includes(filter) : true))
    .sort()
}

// ── Run pending migrations ────────────────────────────────────
async function runMigrations({ filter, reset } = {}) {
  log.section('Supabase Migration Runner')

  await bootstrap()

  if (reset) {
    log.warn('RESET mode — dropping _migrations table …')
    await exec('DROP TABLE IF EXISTS _migrations;')
    await bootstrap()
    log.ok('_migrations table recreated.')
  }

  const applied = await getApplied()
  const files   = getMigrationFiles(filter)

  if (files.length === 0) {
    log.warn('No migration files found.')
    return
  }

  let ranCount = 0

  for (const file of files) {
    if (applied.has(file)) {
      log.skip(`${file}  (already applied)`)
      continue
    }

    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql      = fs.readFileSync(filePath, 'utf-8')
    const hash     = checksum(sql)

    log.info(`Applying: ${file}`)
    try {
      await exec(sql)
      await markApplied(file, hash)
      log.ok(`Applied:  ${file}`)
      ranCount++
    } catch (err) {
      log.error(`Failed:   ${file}`)
      log.error(err.message)
      process.exit(1)
    }
  }

  if (ranCount === 0) {
    log.ok('Database is up-to-date — no pending migrations.')
  } else {
    log.ok(`\n${ranCount} migration(s) applied successfully. ✨`)
  }
}

// ── Status report ─────────────────────────────────────────────
async function printStatus() {
  log.section('Migration Status')
  await bootstrap()

  const applied = await getApplied()
  const files   = getMigrationFiles()

  if (files.length === 0) {
    log.warn('No migration files found.')
    return
  }

  for (const file of files) {
    if (applied.has(file)) {
      log.ok(`${file}`)
    } else {
      log.warn(`${file}  ← PENDING`)
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────
const command = process.argv[2]

switch (command) {
  case 'status':
    await printStatus()
    break

  case 'seed':
    await runMigrations({ filter: 'seed' })
    break

  case 'reset':
    await runMigrations({ reset: true })
    break

  default: // no arg → migrate
    await runMigrations()
    break
}
