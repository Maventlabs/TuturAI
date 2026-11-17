import { GeminiTtsProvider } from './gemini-tts-provider'
import { HttpVoiceProvider, VoiceProviderError, type VoiceSynthesisResult } from './voice-provider'

export interface TtsSynthesisConfig {
  baseUrl: string
  apiKeys: readonly string[]
  modelIds: readonly string[]
  attemptTimeoutMs: number
  protocol?: 'openai' | 'gemini'
  voiceName?: string
  statusPath?: string
  synthesisPath?: string
}

export interface TtsAttempt {
  modelId?: string
  apiKey?: string
}

export interface TtsSynthesisDeps {
  fetchImpl?: typeof fetch
}

export function buildTtsAttempts(
  config: Pick<TtsSynthesisConfig, 'apiKeys' | 'modelIds'>,
): TtsAttempt[] {
  const models: (string | undefined)[] = config.modelIds.length > 0 ? [...config.modelIds] : [undefined]
  const keys: (string | undefined)[] = config.apiKeys.length > 0 ? [...config.apiKeys] : [undefined]

  return models.flatMap((modelId) => keys.map((apiKey) => ({ modelId, apiKey })))
}

/**
 * Synthesize speech with automatic failover. Every model/key pair gets its own
 * attempt budget, so a model that errors or takes longer than the budget hands
 * the request to the next pair instead of failing the whole call. The last
 * provider error is rethrown so callers still learn why every attempt failed.
 */
export async function synthesizeWithFailover(
  config: TtsSynthesisConfig,
  input: { providerVoiceId: string; text: string },
  deps: TtsSynthesisDeps = {},
): Promise<VoiceSynthesisResult> {
  const attempts = buildTtsAttempts(config)
  let lastError: unknown

  for (const [index, attempt] of attempts.entries()) {
    try {
      const provider = config.protocol === 'gemini'
        ? new GeminiTtsProvider({
            baseUrl: config.baseUrl,
            apiKey: attempt.apiKey,
            modelId: attempt.modelId,
            voiceName: config.voiceName,
            timeoutMs: config.attemptTimeoutMs,
            fetchImpl: deps.fetchImpl,
          })
        : new HttpVoiceProvider({
            baseUrl: config.baseUrl,
            apiKey: attempt.apiKey,
            modelId: attempt.modelId,
            statusPath: config.statusPath,
            synthesisPath: config.synthesisPath,
            timeoutMs: config.attemptTimeoutMs,
            fetchImpl: deps.fetchImpl,
          })
      return await provider.synthesize(input)
    } catch (error) {
      if (!(error instanceof VoiceProviderError)) throw error
      if (error.code === 'INVALID_REQUEST') throw error

      lastError = error
      if (index < attempts.length - 1) {
        console.warn(`[tts] ${attempt.modelId ?? 'default model'} failed (${error.code}); trying the next model`)
      }
    }
  }

  throw lastError ?? new VoiceProviderError('PROVIDER_UNAVAILABLE', 'No TTS model is configured', false)
}
