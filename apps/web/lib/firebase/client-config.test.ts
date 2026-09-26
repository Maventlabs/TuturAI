import { describe, expect, it } from 'vitest'
import { validateFirebaseClientConfig, validateFirebaseProductionConfig } from './client-config.mjs'

const validConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIza0123456789abcdefghijklmnopqrstuv',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'tuturai.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tuturai-prod-123',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef0123456789',
}

describe('validateFirebaseClientConfig', () => {
  it('does not require storage or messaging config for Firebase Auth', () => {
    expect(validateFirebaseClientConfig(validConfig, { nodeEnv: 'production' })).toEqual({
      apiKey: validConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: validConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: validConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: validConfig.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  })

  it('fails with the missing public variable name, not its value', () => {
    const { NEXT_PUBLIC_FIREBASE_API_KEY: _apiKey, ...missingApiKey } = validConfig

    expect(() => validateFirebaseClientConfig(missingApiKey, { nodeEnv: 'production' }))
      .toThrow('NEXT_PUBLIC_FIREBASE_API_KEY')
  })

  it('rejects a demo project in production', () => {
    expect(() => validateFirebaseClientConfig({
      ...validConfig,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-tuturai',
    }, { nodeEnv: 'production' })).toThrow('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  })

  it('rejects emulator hosts in production', () => {
    expect(() => validateFirebaseClientConfig({
      ...validConfig,
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    }, { nodeEnv: 'production' })).toThrow('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST')
  })

  it('allows the demo project only with a local emulator configured', () => {
    expect(validateFirebaseClientConfig({
      ...validConfig,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-tuturai',
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    }, { nodeEnv: 'development' }).projectId)
      .toBe('demo-tuturai')
    expect(() => validateFirebaseClientConfig({
      ...validConfig,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-tuturai',
    }, { nodeEnv: 'development' })).toThrow('emulator')
  })

  it('rejects an Admin project mismatch during production build validation', () => {
    expect(() => validateFirebaseProductionConfig({
      ...validConfig,
      FIREBASE_ADMIN_PROJECT_ID: 'another-project',
    })).toThrow('FIREBASE_ADMIN_PROJECT_ID')
  })
})
