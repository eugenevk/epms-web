import { access, cp, mkdir, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '../..')
const sourceDir = join(webRoot, 'dist')
const epmsServerRoot = resolve(webRoot, '..', 'qepms', 'src', 'server')
const targetDir = join(epmsServerRoot, 'dist', 'spa')

async function pathExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function copyToEpmsHosting() {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`Build niet gevonden: ${sourceDir}\nVoer eerst een build uit.`)
  }

  if (!(await pathExists(epmsServerRoot))) {
    throw new Error(
      `qepms server-map niet gevonden: ${epmsServerRoot}\nVerwacht sibling map ../qepms/src/server naast epms-web.`,
    )
  }

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true })

  return { sourceDir, targetDir, epmsServerRoot }
}

export function getEpmsServerRoot() {
  return epmsServerRoot
}
