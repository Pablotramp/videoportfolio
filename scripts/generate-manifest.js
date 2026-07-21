#!/usr/bin/env node
/**
 * generate-manifest.js
 *
 * Genera `_manifest.json` escaneando una carpeta de forma recursiva,
 * equivalente a `dir /s /b` en CMD o `find . -type f` en Unix.
 *
 * El resultado es un JSON con la lista plana de todas las rutas relativas
 * a la carpeta raíz. Este archivo se sube a la raíz del bucket R2 y permite
 * que videoportfolio resuelva el contenido sin necesidad de que el bucket
 * tenga listado público activado.
 *
 * Uso:
 *   node scripts/generate-manifest.js <carpeta-contenido> [salida]
 *
 * Ejemplos:
 *   node scripts/generate-manifest.js ./mi-contenido
 *     → escribe ./mi-contenido/_manifest.json
 *
 *   node scripts/generate-manifest.js ./mi-contenido ./mi-contenido/_manifest.json
 *     → salida explícita
 *
 *   node scripts/generate-manifest.js ./mi-contenido -
 *     → imprime el JSON por stdout (sin escribir archivo)
 *
 * Contrato de _manifest.json generado:
 * ─────────────────────────────────────
 * {
 *   "version": 1,
 *   "generatedAt": "<ISO-8601>",
 *   "files": [
 *     "Seccion1/video/master.m3u8",
 *     "Seccion1/video/00001.ts",
 *     "_estructura.json",
 *     ...
 *   ]
 * }
 *
 * Archivos excluidos por defecto (configurable con --exclude):
 *   .DS_Store  Thumbs.db  desktop.ini  *.tmp  *.log
 */

import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_EXCLUDE = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
const DEFAULT_EXCLUDE_EXTS = new Set(['tmp', 'log'])

// ── Helpers ────────────────────────────────────────────────────────────────────

function shouldExclude(filename, excludeNames, excludeExts) {
  if (excludeNames.has(filename)) return true
  const lastDot = filename.lastIndexOf('.')
  if (lastDot !== -1) {
    const ext = filename.slice(lastDot + 1).toLowerCase()
    if (excludeExts.has(ext)) return true
  }
  return false
}

/**
 * Walk a directory recursively and collect all file paths relative to rootDir.
 * Equivalent to `dir /s /b` (Windows CMD) or `find <dir> -type f` (Unix).
 *
 * @param {string} rootDir     - Absolute path to scan
 * @param {string} currentDir  - Current directory being scanned
 * @param {Set<string>} excludeNames
 * @param {Set<string>} excludeExts
 * @returns {Promise<string[]>} Sorted list of relative paths (forward slashes)
 */
async function walkDir(rootDir, currentDir, excludeNames, excludeExts) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (shouldExclude(entry.name, excludeNames, excludeExts)) continue

    const fullPath = join(currentDir, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await walkDir(rootDir, fullPath, excludeNames, excludeExts)
      files.push(...subFiles)
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      // Store as forward-slash relative path (works on all platforms + R2)
      const rel = relative(rootDir, fullPath).replace(/\\/g, '/')
      files.push(rel)
    }
  }

  return files
}

// ── Argument parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2)
  const positional = []
  const excludeNames = new Set(DEFAULT_EXCLUDE)
  const excludeExts = new Set(DEFAULT_EXCLUDE_EXTS)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--exclude' && i + 1 < args.length) {
      // --exclude name1,name2
      for (const name of args[++i].split(',')) {
        const n = name.trim()
        if (n) excludeNames.add(n)
      }
    } else if (arg === '-' || !arg.startsWith('-')) {
      // '-' means "stdout"; any other non-flag token is a positional path
      positional.push(arg)
    }
  }

  return { positional, excludeNames, excludeExts }
}

function usage() {
  console.error(
    'Uso: node scripts/generate-manifest.js <carpeta-contenido> [salida|-]\n' +
      '  <carpeta-contenido>  Carpeta raíz a escanear\n' +
      '  [salida]             Ruta de salida (por defecto: <carpeta>/_manifest.json)\n' +
      '  -                    Imprime por stdout en lugar de escribir archivo\n' +
      '  --exclude a,b        Nombres adicionales a excluir',
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { positional, excludeNames, excludeExts } = parseArgs(process.argv)

  if (positional.length === 0) {
    usage()
    process.exit(1)
  }

  const contentDir = resolve(positional[0])
  const outputArg = positional[1] ?? null
  const toStdout = outputArg === '-'

  // Verify content dir exists
  try {
    const s = await stat(contentDir)
    if (!s.isDirectory()) {
      console.error(`Error: "${contentDir}" no es una carpeta.`)
      process.exit(1)
    }
  } catch {
    console.error(`Error: no se puede leer la carpeta "${contentDir}".`)
    process.exit(1)
  }

  console.error(`Escaneando: ${contentDir}`)
  const files = await walkDir(contentDir, contentDir, excludeNames, excludeExts)
  files.sort()

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files,
  }

  const json = JSON.stringify(manifest, null, 2) + '\n'

  if (toStdout) {
    process.stdout.write(json)
    console.error(`\n${files.length} archivo(s) listado(s).`)
    return
  }

  const outputPath =
    outputArg !== null ? resolve(outputArg) : join(contentDir, '_manifest.json')

  await writeFile(outputPath, json, 'utf8')
  console.error(`_manifest.json escrito en: ${outputPath}`)
  console.error(`${files.length} archivo(s) listado(s).`)
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
