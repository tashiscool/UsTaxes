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
run('npm run test:core')
run('node ./scripts/runtime-smoke-checks.mjs')
