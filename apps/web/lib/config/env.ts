type Environment = 'development' | 'test' | 'production'
type AiRoute = 'local' | 'v1'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

function route(name: string, fallback: AiRoute): AiRoute {
  const value = optional(name) ?? fallback
  if (value !== 'local' && value !== 'v1') {
    throw new Error(`${name} must be either local or v1`)
  }
  return value
}

function baseUrlFor(route: AiRoute): string | undefined {
  return route === 'local' ? optional('AI_LOCAL_BASE_URL') : required('AI_V1_BASE_URL')
}

function apiKeyFor(route: AiRoute): string | undefined {
  return route === 'v1' ? required('AI_V1_API_KEY') : optional('AI_LOCAL_API_KEY')
}

export const publicEnv = {
  appUrl: optional('NEXT_PUBLIC_APP_URL'),
  firebase: {
    apiKey: optional('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: optional('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: optional('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: optional('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: optional('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: optional('NEXT_PUBLIC_FIREBASE_APP_ID'),
  },
} as const

export function getFirebaseAdminEnv() {
  const projectId = required('FIREBASE_ADMIN_PROJECT_ID')
  const clientProjectId = optional('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  const clientEmail = required('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')

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

export function getAiEnv() {
  const sttRoute = route('AI_STT_ROUTE', 'v1')
  const ttsRoute = route('AI_TTS_ROUTE', 'local')
  const llmRoute = route('AI_LLM_ROUTE', 'v1')

  return {
    ai: {
      localBaseUrl: optional('AI_LOCAL_BASE_URL'),
      localApiKey: optional('AI_LOCAL_API_KEY'),
      v1BaseUrl: optional('AI_V1_BASE_URL'),
      v1ApiKey: optional('AI_V1_API_KEY'),
      stt: {
        route: sttRoute,
        baseUrl: baseUrlFor(sttRoute),
        apiKey: apiKeyFor(sttRoute),
        modelId: required('AI_STT_MODEL_ID'),
      },
      tts: {
        route: ttsRoute,
        baseUrl: baseUrlFor(ttsRoute),
        apiKey: apiKeyFor(ttsRoute),
        modelId: optional('AI_TTS_MODEL_ID'),
        enrollmentPath: optional('AI_TTS_ENROLLMENT_PATH') ?? '/v1/voice-clones',
        synthesisPath: optional('AI_TTS_SYNTHESIS_PATH') ?? '/v1/audio/speech',
        deletePath: optional('AI_TTS_DELETE_PATH') ?? '/v1/voice-clones',
      },
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

export function hasPublicFirebaseConfig() {
  return Object.values(publicEnv.firebase).every(Boolean)
}
