#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const cwd = new URL('..', import.meta.url)

const run = (command) => {
  execFileSync('/bin/zsh', ['-lc', command], {
    cwd,
    stdio: 'inherit',
    env: process.env
  })
}

run('npm run check')
run('npx vitest run --exclude test/worker/cloudflareRuntime.e2e.test.ts')
run('node ./scripts/runtime-smoke-checks.mjs')
