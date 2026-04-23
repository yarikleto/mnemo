#!/usr/bin/env node
// Create a mnemo card (frontmatter + body) on disk.
// The app's chokidar watcher auto-indexes new .md files, so this alone is enough —
// no IPC, no app running required.
//
// Usage:
//   create-card.mjs --namespace <ns> --question "<q>" [--tags "a,b,c"] \
//                   (--body-file <path> | --body "<md>" | stdin)
//   create-card.mjs --help
//
// Options:
//   --root <path>       Override mnemo root (default: read from config.json or ~/Documents/mnemo)
//   --namespace <ns>    Folder under cards/ (e.g. "algorithms/graphs"). Required.
//   --question <q>      Front-side prompt. Required.
//   --tags <csv>        Comma-separated tags. Optional.
//   --body-file <p>     Read body markdown from file.
//   --body <md>         Body markdown inline.
//   --dry-run           Print file path + content, don't write.
//
// If no --body / --body-file is given, body is read from stdin.

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    process.stdout.write(readHelp())
    return
  }

  const question = required(args, 'question')
  const namespace = required(args, 'namespace')
  const tags = args.tags
    ? args.tags.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  let body
  if (args['body-file']) body = await fs.readFile(args['body-file'], 'utf8')
  else if (args.body) body = args.body
  else body = await readStdin()

  if (!body.trim()) fail('body is empty — pass --body, --body-file, or pipe markdown on stdin')

  const rootPath = args.root ?? (await discoverRoot())
  const nsDir = path.join(rootPath, 'cards', namespace)

  const id = ulid()
  const created = new Date().toISOString()
  const slug = slugify(question) || id.toLowerCase()
  const file = path.join(nsDir, `${slug}.md`)

  const fm = [
    '---',
    `id: ${id}`,
    `question: ${yamlString(question)}`,
    `tags:${tags.length ? '' : ' []'}`,
    ...tags.map((t) => `  - ${yamlString(t)}`),
    `created: '${created}'`,
    '---',
    ''
  ].join('\n')

  const raw = `${fm}\n${body.endsWith('\n') ? body : body + '\n'}`

  if (args['dry-run']) {
    process.stdout.write(`# would write: ${file}\n\n${raw}`)
    return
  }

  await fs.mkdir(nsDir, { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, raw, 'utf8')
  await fs.rename(tmp, file)

  process.stdout.write(`${file}\n`)
}

// --- helpers ---

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { out.help = true; continue }
    if (!a.startsWith('--')) fail(`unexpected positional arg: ${a}`)
    const key = a.slice(2)
    const next = argv[i + 1]
    if (key === 'dry-run') { out[key] = true; continue }
    if (next === undefined || next.startsWith('--')) fail(`missing value for --${key}`)
    out[key] = next
    i++
  }
  return out
}

function required(args, name) {
  const v = args[name]
  if (!v) fail(`missing required --${name}`)
  return v
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  let buf = ''
  for await (const chunk of process.stdin) buf += chunk
  return buf
}

async function discoverRoot() {
  // Prefer the live config.json written by Electron's app.getPath('userData').
  const candidates = []
  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library/Application Support/mnemo/config.json'))
  } else if (process.platform === 'win32') {
    if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'mnemo/config.json'))
  } else {
    const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
    candidates.push(path.join(xdg, 'mnemo/config.json'))
  }
  for (const p of candidates) {
    try {
      const cfg = JSON.parse(await fs.readFile(p, 'utf8'))
      if (cfg.rootPath && typeof cfg.rootPath === 'string') return cfg.rootPath
    } catch { /* keep looking */ }
  }
  return path.join(os.homedir(), 'Documents/mnemo')
}

// Crockford base32 ULID, matching src/main/id.ts.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function ulid() {
  let t = Date.now()
  let time = ''
  for (let i = 9; i >= 0; i--) {
    const mod = t % 32
    time = ENCODING[mod] + time
    t = (t - mod) / 32
  }
  const bytes = randomBytes(16)
  let rand = ''
  for (let i = 0; i < 16; i++) rand += ENCODING[bytes[i] % 32]
  return time + rand
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function yamlString(s) {
  // Single-quoted YAML scalar: escape ' as ''. Safe for any printable string.
  return `'${String(s).replace(/'/g, "''")}'`
}

function fail(msg) {
  process.stderr.write(`create-card: ${msg}\n`)
  process.exit(1)
}

function readHelp() {
  return `Create a mnemo card (.md with YAML frontmatter).

Usage:
  create-card.mjs --namespace <ns> --question "<q>" [--tags "a,b"] \\
                  (--body-file <path> | --body "<md>" | stdin)

Options:
  --root <path>       Override mnemo root (default: read from config.json)
  --namespace <ns>    Folder under cards/ (e.g. "algorithms/graphs"). Required.
  --question <q>      Front-side prompt. Required.
  --tags <csv>        Comma-separated tags.
  --body-file <p>     Read markdown body from file.
  --body <md>         Inline markdown body.
  --dry-run           Print the file path + content, don't write.
  --help, -h          Show this help.

Prints the absolute path of the created file on stdout.
`
}

await main()
