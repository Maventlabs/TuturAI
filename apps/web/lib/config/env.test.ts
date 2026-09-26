import { afterEach, describe, expect, it } from 'vitest'
import { getAiEnv, getFirebaseAdminEnv } from './env'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('AI environment configuration', () => {
  it('uses the local API key for local TTS without exposing it through public config', () => {
    process.env.AI_TTS_ROUTE = 'local'
    process.env.AI_LOCAL_BASE_URL = 'https://voice.example.test'
    process.env.AI_LOCAL_API_KEY = 'local-secret'
    process.env.AI_STT_ROUTE = 'v1'
    process.env.AI_V1_BASE_URL = 'https://ai.example.test'
    process.env.AI_V1_API_KEY = 'v1-secret'
    process.env.AI_STT_MODEL_ID = 'whisper'
    process.env.AI_LLM_ROUTE = 'v1'
    process.env.AI_LLM_MODEL_ID = 'llm'

    const config = getAiEnv().ai

    expect(config.tts.apiKey).toBe('local-secret')
    expect(config.tts.baseUrl).toBe('https://voice.example.test')
    expect(config.localApiKey).toBe('local-secret')
  })

  it('does not fall back to the v1 key for a local provider', () => {
    process.env.AI_TTS_ROUTE = 'local'
    process.env.AI_LOCAL_BASE_URL = 'https://voice.example.test'
    process.env.AI_V1_API_KEY = 'v1-secret'
    process.env.AI_STT_ROUTE = 'v1'
    process.env.AI_V1_BASE_URL = 'https://ai.example.test'
    process.env.AI_STT_MODEL_ID = 'whisper'
    process.env.AI_LLM_ROUTE = 'v1'
    process.env.AI_LLM_MODEL_ID = 'llm'

    const config = getAiEnv().ai

    expect(config.tts.apiKey).toBeUndefined()
  })
})

describe('Firebase Admin environment', () => {
  it('rejects server credentials configured for a different Firebase Web project', () => {
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'server-project'
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'firebase-adminsdk@server-project.iam.gserviceaccount.com'
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'web-project'

    expect(() => getFirebaseAdminEnv()).toThrow('FIREBASE_ADMIN_PROJECT_ID')
  })

  it('normalizes escaped private-key newlines without exposing the key', () => {
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'web-project'
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'firebase-adminsdk@web-project.iam.gserviceaccount.com'
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'web-project'

    const config = getFirebaseAdminEnv()

    expect(config.privateKey).toContain('\nkey\n')
    expect(config.projectId).toBe('web-project')
  })

  it('rejects demo projects and emulator hosts in production', () => {
    Reflect.set(process.env, 'NODE_ENV', 'production')
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-tuturai'
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'firebase-adminsdk@demo-tuturai.iam.gserviceaccount.com'
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-tuturai'
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'

    expect(() => getFirebaseAdminEnv()).toThrow('cannot use a demo project in production')
  })

  it('rejects emulator endpoints in production even when project IDs match', () => {
    Reflect.set(process.env, 'NODE_ENV', 'production')
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'web-project'
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'firebase-adminsdk@web-project.iam.gserviceaccount.com'
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'web-project'
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'

    expect(() => getFirebaseAdminEnv()).toThrow('Firebase emulator variables must be unset in production')
  })
})
