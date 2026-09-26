const REQUIRED_PUBLIC_FIELDS = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
  ['NEXT_PUBLIC_FIREBASE_APP_ID', 'appId'],
]

const OPTIONAL_PUBLIC_FIELDS = [
  ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'storageBucket'],
  ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'],
]

const EMULATOR_FIELDS = [
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
  'NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
]

function normalize(value) {
  const normalizedValue = typeof value === 'string' ? value.trim() : ''
  if (!normalizedValue || ['undefined', 'null', 'changeme'].includes(normalizedValue.toLowerCase())) return ''
  if (/^(your|replace[-_]|placeholder)/i.test(normalizedValue)) return ''
  return normalizedValue
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ nodeEnv?: string }} [options]
 * @returns {{ apiKey: string, authDomain: string, projectId: string, appId: string, storageBucket?: string, messagingSenderId?: string }}
 */
export function validateFirebaseClientConfig(env, options = {}) {
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? 'development'
  const config = {}
  const invalidFields = []

  for (const [envName, fieldName] of REQUIRED_PUBLIC_FIELDS) {
    const value = normalize(env[envName])
    if (!value) {
      invalidFields.push(envName)
      continue
    }
    config[fieldName] = value
  }

  const apiKey = config.apiKey
  if (apiKey && !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) invalidFields.push('NEXT_PUBLIC_FIREBASE_API_KEY')

  const authDomain = config.authDomain
  if (authDomain && (authDomain.includes('://') || authDomain.includes('/') || authDomain.includes(' '))) {
    invalidFields.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
  }

  const projectId = config.projectId
  if (projectId && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    invalidFields.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  }

  const appId = config.appId
  if (appId && !/^\d+:\d+:(web|ios|android):[A-Za-z0-9]+$/.test(appId)) {
    invalidFields.push('NEXT_PUBLIC_FIREBASE_APP_ID')
  }

  for (const [envName, fieldName] of OPTIONAL_PUBLIC_FIELDS) {
    const value = normalize(env[envName])
    if (value) config[fieldName] = value
  }

  const emulatorFields = EMULATOR_FIELDS.filter((field) => normalize(env[field]))
  if (nodeEnv === 'production') {
    if (projectId?.startsWith('demo-')) invalidFields.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
    invalidFields.push(...emulatorFields)
  } else if (projectId?.startsWith('demo-') && emulatorFields.length === 0) {
    invalidFields.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID (demo project requires a local emulator)')
  }

  if (invalidFields.length > 0) {
    throw new Error(`Firebase Web App configuration is invalid. Check: ${[...new Set(invalidFields)].join(', ')}`)
  }

  return config
}

/**
 * Build-time validator for production's browser-visible Firebase config.
 * Firebase Admin secrets remain in the runtime environment and are never read here.
 * @param {Record<string, string | undefined>} env
 */
export function validateFirebaseProductionConfig(env) {
  const config = validateFirebaseClientConfig(env, { nodeEnv: 'production' })
  const adminProjectId = normalize(env.FIREBASE_ADMIN_PROJECT_ID)
  if (adminProjectId && adminProjectId !== config.projectId) {
    throw new Error('FIREBASE_ADMIN_PROJECT_ID must match NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  }
  return config
}
