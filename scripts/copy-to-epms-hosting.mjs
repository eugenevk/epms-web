import { copyToEpmsHosting } from './lib/copyToEpmsHosting.mjs'

async function main() {
  const { sourceDir, targetDir } = await copyToEpmsHosting()
  console.log('Hosting-build gekopieerd:')
  console.log(`  van: ${sourceDir}`)
  console.log(`  naar: ${targetDir}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
