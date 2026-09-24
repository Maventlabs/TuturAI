import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const env = { ...process.env }

if (process.platform === 'win32') {
  const candidates = [
    env.JAVA_HOME,
    'C:\\Program Files\\Java\\jdk-25.0.4.1',
    'C:\\Program Files\\Java\\jdk-21',
  ].filter(Boolean)
  const javaHome = candidates.find((candidate) => existsSync(candidate))

  if (javaHome) {
    env.JAVA_HOME = javaHome
    const existingPath = env.Path ?? env.PATH ?? ''
    env.Path = `${javaHome}\\bin;${existingPath}`
    env.PATH = env.Path
  }
}

const pnpmArgs = [
    'dlx',
    'firebase-tools@latest',
    'emulators:exec',
    '--project',
    'demo-tuturai',
    '--config',
    '../../firebase.json',
    '--only',
    'firestore',
    'pnpm vitest run --passWithNoTests',
  ]

const execPath = process.env.npm_execpath
const command = execPath && existsSync(execPath)
  ? process.execPath
  : process.platform === 'win32'
    ? join(process.env.APPDATA ?? '', 'npm', 'pnpm.cmd')
    : 'pnpm'
const args = execPath && existsSync(execPath) ? [execPath, ...pnpmArgs] : pnpmArgs

const result = spawnSync(command, args, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32' && !(execPath && existsSync(execPath)),
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
