import { isGeminiTtsBaseUrl } from '@/lib/ai/gemini-tts-provider'

type Environment = 'development' | 'test' | 'production'
type AiRoute = 'local' | 'v1'

const ENV_ALIAS = /^process\.env\.([A-Za-z_][A-Za-z0-9_]*)$/

function stripWrappingQuotes(value: string) {
  return /^(['"])[\s\S]*\1$/.test(value) ? value.slice(1, -1).trim() : value
}

/**
 * Some dashboard entries are saved as `process.env.OTHER_NAME` instead of a
 * literal value, and a few arrive wrapped in quotes. Follow those references
 * (bounded and cycle-safe) so a mis-pasted alias still resolves to the real
 * value, and treat an unresolvable chain as unset rather than handing the
 * placeholder string to a provider.
 */
export function resolveEnv(name: string, maxHops = 5): string | undefined {
  let current: string | undefined = name
  const seen = new Set<string>()

  for (let hop = 0; hop <= maxHops && current; hop += 1) {
    if (seen.has(current)) return undefined
    seen.add(current)

    const raw = process.env[current]
    if (!raw) return undefined

    const value = stripWrappingQuotes(raw.trim())
    if (!value) return undefined

    const alias = ENV_ALIAS.exec(value)
    if (!alias) return value
    current = alias[1]
  }

  return undefined
}

function required(name: string): string {
  const value = resolveEnv(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string): string | undefined {
  return resolveEnv(name)
}

function uniqueValues(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function route(name: string, fallback: AiRoute): AiRoute {
  const value = optional(name) ?? fallback
  if (value !== 'local' && value !== 'v1') {
    throw new Error(`${name} must be either local or v1`)
  }
  return value
}

/**
 * `AI_STT_ROUTE` is documented as a route selector, but dashboards also store
 * the full endpoint there (`v1/audio/transcriptions`). Accept both shapes: the
 * first segment picks the route and the remainder becomes the provider path.
 */
function routeWithPath(name: string, fallback: AiRoute): { route: AiRoute; path?: string } {
  const value = optional(name)
  if (!value) return { route: fallback }
  const [head, ...rest] = value.split('/').filter(Boolean)
  if (head !== 'local' && head !== 'v1') {
    throw new Error(`${name} must start with either local or v1`)
  }
  return { route: head, path: rest.length > 0 ? `/${rest.join('/')}` : undefined }
}

function baseUrlFor(route: AiRoute): string | undefined {
  return route === 'local' ? optional('AI_LOCAL_BASE_URL') : required('AI_V1_BASE_URL')
}

function apiKeyFor(route: AiRoute): string | undefined {
  return route === 'v1' ? required('AI_V1_API_KEY') : optional('AI_LOCAL_API_KEY')
}

/**
 * STT base URL, resolved leniently. The audio-upload path needs a real STT
 * endpoint (whisper.cpp self-hosted via `AI_LOCAL_BASE_URL`, or a hosted
 * Whisper via `AI_V1_BASE_URL`); the browser Web Speech API path needs none.
 * Returning `undefined` instead of throwing lets the caller decide, and the
 * audio route still fails closed with 503 when nothing is configured.
 */
function readSttBaseUrl(route: AiRoute): string | undefined {
  if (route === 'local') return optional('AI_LOCAL_BASE_URL') ?? undefined
  return optional('AI_V1_BASE_URL') ?? optional('AI_LOCAL_BASE_URL') ?? undefined
}

export const publicEnv = {
  appUrl: optional('NEXT_PUBLIC_APP_URL'),
  firebase: {
    apiKey: optional('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: optional('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: optional('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    messagingSenderId: optional('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: optional('NEXT_PUBLIC_FIREBASE_APP_ID'),
  },
} as const

// Secrets pasted from dashboards often arrive wrapped in quotes with escaped
// newlines, which makes the PEM unparseable. Normalize before validating.
function normalizePem(value: string) {
  const trimmed = value.trim()
  const unquoted = /^(['"])[\s\S]*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  return unquoted.replace(/\\n/g, '\n').trim()
}

export function getFirebaseAdminEnv() {
  const projectId = required('FIREBASE_ADMIN_PROJECT_ID')
  const clientProjectId = optional('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  const clientEmail = required('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = normalizePem(required('FIREBASE_ADMIN_PRIVATE_KEY'))

  if (clientProjectId && clientProjectId !== projectId) {
    throw new Error('FIREBASE_ADMIN_PROJECT_ID must match NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  }

  if (!clientEmail.endsWith('.iam.gserviceaccount.com')) {
    throw new Error('FIREBASE_ADMIN_CLIENT_EMAIL must be a service-account email')
  }

  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.trimEnd().endsWith('-----END PRIVATE KEY-----')) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY must be a PEM private key')
  }

  if (process.env.NODE_ENV === 'production') {
    if (projectId.startsWith('demo-')) {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID cannot use a demo project in production')
    }
    const emulatorVariables = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']
      .filter((name) => optional(name))
    if (emulatorVariables.length > 0) {
      throw new Error(`Firebase emulator variables must be unset in production: ${emulatorVariables.join(', ')}`)
    }
    if (!clientEmail.endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
      throw new Error('FIREBASE_ADMIN_CLIENT_EMAIL must belong to FIREBASE_ADMIN_PROJECT_ID')
    }
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  } as const
}

export function getGoogleOAuthEnv() {
  return {
    clientId: required('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirectUri: required('GOOGLE_OAUTH_REDIRECT_URI'),
    tokenEncryptionKey: required('GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY'),
  } as const
}

const TTS_ATTEMPT_TIMEOUT_MS = 10_000

export function getTtsEnv() {
  const ttsRoute = route('AI_TTS_ROUTE', 'local')
  const apiKey = optional('AI_TTS_API_KEY') ?? apiKeyFor(ttsRoute)
  const modelIds = uniqueValues([
    optional('AI_TTS_MODEL_ID_1'),
    optional('AI_TTS_MODEL_ID_2'),
    optional('AI_TTS_MODEL_ID_3'),
    optional('AI_TTS_MODEL_ID'),
  ])

  const baseUrl = optional('AI_TTS_BASE_URL') ?? baseUrlFor(ttsRoute)
  const configuredProtocol = optional('AI_TTS_PROTOCOL')

  return {
    route: ttsRoute,
    baseUrl,
    // Gemini's speech models answer on their own native endpoint, so the
    // transport follows the host unless AI_TTS_PROTOCOL overrides it.
    protocol: configuredProtocol === 'gemini' || configuredProtocol === 'openai'
      ? configuredProtocol
      : isGeminiTtsBaseUrl(baseUrl) ? 'gemini' : 'openai',
    voiceName: optional('AI_TTS_VOICE_NAME') ?? 'Kore',
    apiKey,
    // Synthesis walks every model/key pair in order, so a slow or failing model
    // falls through to the next one instead of failing the whole request.
    apiKeys: uniqueValues([apiKey, optional('AI_TTS_API_KEY_2')]),
    modelIds,
    modelId: modelIds[0],
    attemptTimeoutMs: TTS_ATTEMPT_TIMEOUT_MS,
    enrollmentPath: optional('AI_TTS_ENROLLMENT_PATH') ?? '/v1/voice-clones',
    statusPath: optional('AI_TTS_STATUS_PATH') ?? optional('AI_TTS_ENROLLMENT_PATH') ?? '/v1/voice-clones',
    synthesisPath: optional('AI_TTS_SYNTHESIS_PATH') ?? '/v1/audio/speech',
    deletePath: optional('AI_TTS_DELETE_PATH') ?? '/v1/voice-clones',
  } as const
}

export function getPronunciationEnv() {
  const providerRoute = route('AI_PRONUNCIATION_ROUTE', 'v1')
  const providerPrefix = providerRoute === 'local' ? 'AI_LOCAL' : 'AI_V1'
  const configuredTimeout = optional('AI_PRONUNCIATION_TIMEOUT_MS')
  const timeoutMs = configuredTimeout ? Number(configuredTimeout) : 30_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error('AI_PRONUNCIATION_TIMEOUT_MS must be an integer between 1000 and 120000')
  }
  return {
    route: providerRoute,
    baseUrl: optional(`${providerPrefix}_BASE_URL`),
    apiKey: optional(`${providerPrefix}_API_KEY`),
    modelId: optional('AI_PRONUNCIATION_MODEL_ID'),
    path: optional('AI_PRONUNCIATION_PATH'),
    timeoutMs,
  } as const
}

export function getAiEnv() {
  const stt = routeWithPath('AI_STT_ROUTE', 'v1')
  const llmRoute = route('AI_LLM_ROUTE', 'v1')
  const tts = getTtsEnv()

  // STT is only required for the audio-upload path. The browser Web Speech API
  // path transcribes client-side and needs no STT endpoint at all, so a missing
  // STT base URL/model must not throw here. Routes validate what they need.
  const sttBaseUrl = readSttBaseUrl(stt.route)

  return {
    ai: {
      localBaseUrl: optional('AI_LOCAL_BASE_URL'),
      localApiKey: optional('AI_LOCAL_API_KEY'),
      v1BaseUrl: optional('AI_V1_BASE_URL'),
      v1ApiKey: optional('AI_V1_API_KEY'),
      stt: {
        route: stt.route,
        path: stt.path ?? '/audio/transcriptions',
        baseUrl: sttBaseUrl,
        apiKey: sttBaseUrl ? apiKeyFor(stt.route) : undefined,
        modelId: optional('AI_STT_MODEL_ID'),
      },
      tts,
      llm: {
        route: llmRoute,
        baseUrl: baseUrlFor(llmRoute),
        apiKey: apiKeyFor(llmRoute),
        modelId: required('AI_LLM_MODEL_ID'),
      },
    },
  } as const
}

export function getServerEnv() {
  return {
    nodeEnv: (process.env.NODE_ENV ?? 'development') as Environment,
    firebase: getFirebaseAdminEnv(),
    ai: getAiEnv().ai,
  } as const
}

// The dashboard keeps several Cloudinary accounts side by side under numbered
// aliases. The active account is the `_7`/`_4` chain, so those names win over
// the plain ones, which still point at an older account.
const CLOUDINARY_ALIASES = {
  cloudName: ['CLOUDINARY_CLOUD_NAME_7', 'CLOUDINARY_CLOUD_NAME'],
  apiSecret: ['CLOUDINARY_API_SECRET_7', 'CLOUDINARY_API_SECRET'],
} as const

// Cloudinary API keys are public identifiers (they ship in signed-upload
// requests), and this account's key is not stored as a project variable.
const CLOUDINARY_API_KEY_FALLBACK = '914834288553626'

function firstResolved(names: readonly string[]) {
  for (const name of names) {
    const value = optional(name)
    if (value) return value
  }
  return undefined
}

export function getCloudinaryEnv() {
  const cloudName = firstResolved(CLOUDINARY_ALIASES.cloudName)
  const apiSecret = firstResolved(CLOUDINARY_ALIASES.apiSecret)
  const apiKey = optional('CLOUDINARY_API_KEY') ?? CLOUDINARY_API_KEY_FALLBACK
  if (!cloudName) throw new Error('Missing required environment variable: CLOUDINARY_CLOUD_NAME')
  if (!apiSecret) throw new Error('Missing required environment variable: CLOUDINARY_API_SECRET')
  return { cloudName, apiKey, apiSecret } as const
}

export function hasCloudinaryConfig() {
  return Boolean(firstResolved(CLOUDINARY_ALIASES.cloudName) && firstResolved(CLOUDINARY_ALIASES.apiSecret))
}

export function hasPublicFirebaseConfig() {
  return Object.values(publicEnv.firebase).every(Boolean)
}
