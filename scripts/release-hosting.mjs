#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { copyToEpmsHosting, getEpmsServerRoot } from './lib/copyToEpmsHosting.mjs'

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      reject(new Error(`"${command} ${args.join(' ')}" mislukt (exit ${code})`))
    })
  })
}

async function main() {
  console.log('1/2  Build kopiëren naar qepms/src/server/dist/spa…')
  const { sourceDir, targetDir } = await copyToEpmsHosting()
  console.log(`     ${sourceDir}`)
  console.log(`  →  ${targetDir}`)

  console.log('\n2/2  Firebase Hosting deployen…')
  await run('firebase', ['deploy', '--only', 'hosting'], getEpmsServerRoot())

  console.log('\nKlaar — productie-hosting is bijgewerkt.')
}

main().catch((error) => {
  console.error('\nRelease mislukt:', error.message || error)
  process.exit(1)
})
