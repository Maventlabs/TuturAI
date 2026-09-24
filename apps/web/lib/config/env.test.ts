import { afterEach, describe, expect, it } from 'vitest'
import { getAiEnv } from './env'

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
