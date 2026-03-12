/**
 * Build script for the Rhythm Navigator CLI.
 *
 * Uses esbuild to bundle the CLI entry points (index.ts and mcp.ts)
 * into standalone Node.js scripts, resolving the @/ path alias
 * used throughout the source.
 */
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: path.join(__dirname, 'dist-cli', 'cli'),
  alias: {
    '@': path.join(__dirname, 'src')
  },
  // Externalize node_modules that should be resolved at runtime
  external: [
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/*',
    'zod'
  ]
}

async function build() {
  // Build CLI entry point
  await esbuild.build({
    ...sharedOptions,
    entryPoints: [path.join(__dirname, 'src', 'cli', 'index.ts')],
  })

  // Build MCP entry point as a separate chunk (imported by index.ts)
  // Actually, since index.ts imports mcp.ts, esbuild will handle the dependency.
  // We just need index.ts as the entry point.

  console.log('CLI build complete → dist-cli/cli/index.js')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
