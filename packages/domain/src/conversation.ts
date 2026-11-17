export const CONVERSATION_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type ConversationLevel = (typeof CONVERSATION_LEVELS)[number]

export const CONVERSATION_MODES = ['push-to-talk', 'hands-free'] as const
export type ConversationMode = (typeof CONVERSATION_MODES)[number]

export const CORRECTION_CATEGORIES = [
  'grammar',
  'vocabulary',
  'sentence_structure',
  'natural_expression',
] as const
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]

export const CORRECTION_SEVERITIES = ['minor', 'moderate', 'important'] as const
export type CorrectionSeverity = (typeof CORRECTION_SEVERITIES)[number]

export const CONVERSATION_INTENTS = ['answer', 'follow_up', 'clarification', 'encouragement'] as const
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number]

export interface ConversationCorrection {
  original: string
  corrected: string
  category: CorrectionCategory
  severity: CorrectionSeverity
  /** Indonesian teaching note. Never spoken by the tutor voice. */
  explanation: string
}

export interface ConversationVocabularyNote {
  phrase: string
  meaning: string
  example: string
}

export interface ConversationSuggestedExpression {
  original: string
  natural: string
  explanation: string
}

export interface ConversationReply {
  /** The only text that may be sent to TTS. */
  spokenResponse: string
  intent: ConversationIntent
  corrections: ConversationCorrection[]
  vocabularyNotes: ConversationVocabularyNote[]
  suggestedExpression: ConversationSuggestedExpression | null
  shouldContinue: boolean
}

export interface ConversationSummary {
  overview: {
    durationMinutes: number
    turns: number
    topics: string[]
    summary: string
  }
  grammar: Array<{ original: string; corrected: string; explanation: string }>
  vocabulary: Array<{ phrase: string; meaning: string }>
  naturalExpressions: Array<{ original: string; natural: string }>
  recommendations: string[]
  /** False when the session was too short to support a representative summary. */
  sufficientEvidence: boolean
}

export type ConversationValidation<T> =
  | { success: true; data: T }
  | { success: false; message: string }

const MAX_SPOKEN_CHARS = 600
const MAX_CORRECTIONS = 2
const MAX_VOCABULARY_NOTES = 3
const MAX_RECOMMENDATIONS = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text
}

/**
 * The tutor voice must never read markup, emoji, or metadata aloud, so the
 * spoken text is flattened before it reaches TTS or the transcript.
 */
export function sanitizeSpokenText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~#>|]+/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function readCorrection(value: unknown): ConversationCorrection | null {
  if (!isRecord(value)) return null
  const original = readText(value.original, 240)
  const corrected = readText(value.corrected, 240)
  const explanation = readText(value.explanation ?? value.explanation_id, 400)
  if (!original || !corrected || !explanation) return null
  if (original.toLowerCase() === corrected.toLowerCase()) return null
  return {
    original,
    corrected,
    category: readEnum(value.category, CORRECTION_CATEGORIES, 'grammar'),
    severity: readEnum(value.severity, CORRECTION_SEVERITIES, 'moderate'),
    explanation,
  }
}

function readVocabularyNote(value: unknown): ConversationVocabularyNote | null {
  if (!isRecord(value)) return null
  const phrase = readText(value.phrase ?? value.word_or_phrase, 80)
  const meaning = readText(value.meaning ?? value.meaning_id, 200)
  if (!phrase || !meaning) return null
  return {
    phrase,
    meaning,
    example: readText(value.example ?? value.example_en, 240) ?? '',
  }
}

function readSuggestedExpression(value: unknown): ConversationSuggestedExpression | null {
  if (!isRecord(value)) return null
  const original = readText(value.original, 240)
  const natural = readText(value.natural ?? value.natural_version, 240)
  const explanation = readText(value.explanation ?? value.explanation_id, 400)
  if (!original || !natural || !explanation) return null
  return { original, natural, explanation }
}

/**
 * Validates the tutor's structured reply. Anything the model gets wrong is
 * dropped rather than rendered, so the UI never shows a half-built correction
 * or an empty spoken response.
 */
export function normalizeConversationReply(payload: unknown): ConversationValidation<ConversationReply> {
  if (!isRecord(payload)) return { success: false, message: 'Reply is not an object' }

  const rawSpoken = payload.spoken_response ?? payload.spokenResponse
  const spoken = typeof rawSpoken === 'string' ? sanitizeSpokenText(rawSpoken) : ''
  if (!spoken) return { success: false, message: 'Reply has no spoken response' }

  const corrections = Array.isArray(payload.corrections)
    ? payload.corrections
        .map(readCorrection)
        .filter((item): item is ConversationCorrection => item !== null)
        .slice(0, MAX_CORRECTIONS)
    : []

  const vocabularyNotes = Array.isArray(payload.vocabulary_notes ?? payload.vocabularyNotes)
    ? ((payload.vocabulary_notes ?? payload.vocabularyNotes) as unknown[])
        .map(readVocabularyNote)
        .filter((item): item is ConversationVocabularyNote => item !== null)
        .slice(0, MAX_VOCABULARY_NOTES)
    : []

  return {
    success: true,
    data: {
      spokenResponse: spoken.length > MAX_SPOKEN_CHARS ? `${spoken.slice(0, MAX_SPOKEN_CHARS - 1).trimEnd()}…` : spoken,
      intent: readEnum(payload.response_intent ?? payload.responseIntent, CONVERSATION_INTENTS, 'follow_up'),
      corrections,
      vocabularyNotes,
      suggestedExpression: readSuggestedExpression(payload.suggested_expression ?? payload.suggestedExpression),
      shouldContinue: payload.should_continue === false || payload.shouldContinue === false ? false : true,
    },
  }
}

export function normalizeConversationSummary(payload: unknown): ConversationValidation<ConversationSummary> {
  if (!isRecord(payload)) return { success: false, message: 'Summary is not an object' }

  const overview = isRecord(payload.overview) ? payload.overview : {}
  const summaryText = readText(overview.summary ?? payload.summary, 600)
  if (!summaryText) return { success: false, message: 'Summary has no overview text' }

  const grammar = Array.isArray(payload.grammar)
    ? payload.grammar
        .map((item) => {
          if (!isRecord(item)) return null
          const original = readText(item.original, 240)
          const corrected = readText(item.corrected, 240)
          const explanation = readText(item.explanation ?? item.explanation_id, 400)
          return original && corrected && explanation ? { original, corrected, explanation } : null
        })
        .filter((item): item is { original: string; corrected: string; explanation: string } => item !== null)
        .slice(0, 5)
    : []

  const vocabulary = Array.isArray(payload.vocabulary)
    ? payload.vocabulary
        .map((item) => {
          if (!isRecord(item)) return null
          const phrase = readText(item.phrase ?? item.word_or_phrase, 80)
          const meaning = readText(item.meaning ?? item.meaning_id, 200)
          return phrase && meaning ? { phrase, meaning } : null
        })
        .filter((item): item is { phrase: string; meaning: string } => item !== null)
        .slice(0, 6)
    : []

  const naturalExpressions = Array.isArray(payload.natural_expressions ?? payload.naturalExpressions)
    ? ((payload.natural_expressions ?? payload.naturalExpressions) as unknown[])
        .map((item) => {
          if (!isRecord(item)) return null
          const original = readText(item.original, 240)
          const natural = readText(item.natural ?? item.natural_version, 240)
          return original && natural ? { original, natural } : null
        })
        .filter((item): item is { original: string; natural: string } => item !== null)
        .slice(0, 4)
    : []

  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations
        .map((item) => readText(item, 200))
        .filter((item): item is string => item !== null)
        .slice(0, MAX_RECOMMENDATIONS)
    : []

  const topics = Array.isArray(overview.topics)
    ? overview.topics.map((item) => readText(item, 60)).filter((item): item is string => item !== null).slice(0, 4)
    : []

  const durationMinutes = Number(overview.duration_minutes ?? overview.durationMinutes)
  const turns = Number(overview.turns)

  return {
    success: true,
    data: {
      overview: {
        durationMinutes: Number.isFinite(durationMinutes) && durationMinutes >= 0 ? Math.round(durationMinutes) : 0,
        turns: Number.isFinite(turns) && turns >= 0 ? Math.round(turns) : 0,
        topics,
        summary: summaryText,
      },
      grammar,
      vocabulary,
      naturalExpressions,
      recommendations,
      sufficientEvidence: payload.sufficient_evidence === false || payload.sufficientEvidence === false ? false : true,
    },
  }
}

/** Maps the gamified student level onto a conversation difficulty band. */
export function conversationLevelFromNumber(level: number): ConversationLevel {
  if (!Number.isFinite(level) || level <= 3) return 'beginner'
  if (level <= 6) return 'intermediate'
  return 'advanced'
}

export interface ConversationStarter {
  id: string
  label: string
  blurb: string
  /** Authored opening question per level, so starting a topic costs no LLM call. */
  openings: Record<ConversationLevel, string>
}

export const CONVERSATION_STARTERS: readonly ConversationStarter[] = [
  {
    id: 'daily-life',
    label: 'Daily life',
    blurb: 'Rutinitas harian',
    openings: {
      beginner: 'Hi! Let us talk about your day. What do you usually do in the morning?',
      intermediate: 'Let us talk about your daily routine. Which part of your day do you enjoy most, and why?',
      advanced: 'Let us talk about routines. How much of your day is actually planned, and how do you feel when the plan falls apart?',
    },
  },
  {
    id: 'hobbies',
    label: 'Hobbies',
    blurb: 'Kegemaran',
    openings: {
      beginner: 'What do you like to do in your free time?',
      intermediate: 'Tell me about a hobby you have kept for a long time. What keeps you interested in it?',
      advanced: 'Do you think hobbies should always be productive, or is it fine to spend time on something purely for fun?',
    },
  },
  {
    id: 'travel',
    label: 'Travel',
    blurb: 'Perjalanan',
    openings: {
      beginner: 'Do you like traveling? Where do you want to go?',
      intermediate: 'Describe a trip you still remember. What made it memorable?',
      advanced: 'Some people say travel changes how you see your own country. What do you think?',
    },
  },
  {
    id: 'technology',
    label: 'Technology',
    blurb: 'Teknologi',
    openings: {
      beginner: 'Do you use a smartphone every day? What do you use it for?',
      intermediate: 'Which piece of technology has changed your daily life the most?',
      advanced: 'How do you think technology has changed the way people build meaningful relationships?',
    },
  },
  {
    id: 'education',
    label: 'Education',
    blurb: 'Pendidikan',
    openings: {
      beginner: 'What is your favorite subject at school?',
      intermediate: 'What is one thing you wish school taught you better?',
      advanced: 'Should students have more control over what they study? Why or why not?',
    },
  },
  {
    id: 'career',
    label: 'Career',
    blurb: 'Karier',
    openings: {
      beginner: 'What job do you want to have in the future?',
      intermediate: 'What kind of work environment helps you do your best?',
      advanced: 'How do you weigh a stable job against work that feels meaningful?',
    },
  },
  {
    id: 'food',
    label: 'Food',
    blurb: 'Makanan',
    openings: {
      beginner: 'What is your favorite food? Can you describe it?',
      intermediate: 'Tell me about a meal you will never forget.',
      advanced: 'How much of our food culture do you think is shaped by convenience rather than taste?',
    },
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    blurb: 'Hiburan',
    openings: {
      beginner: 'What kind of music or film do you like?',
      intermediate: 'What have you watched or listened to recently that you would recommend?',
      advanced: 'Why do you think certain stories stay popular across generations?',
    },
  },
  {
    id: 'personal-experience',
    label: 'Personal experience',
    blurb: 'Pengalaman pribadi',
    openings: {
      beginner: 'Tell me about something good that happened this week.',
      intermediate: 'Tell me about a moment when you learned something about yourself.',
      advanced: 'Looking back, which decision changed the direction of your life the most?',
    },
  },
  {
    id: 'social-issues',
    label: 'Social issues',
    blurb: 'Isu sosial',
    openings: {
      beginner: 'What is one thing you want to change in your school or town?',
      intermediate: 'What is one issue in your community that people should talk about more?',
      advanced: 'Which social issue do you think your generation will be judged by, and why?',
    },
  },
] as const

export function findConversationStarter(id: string | null | undefined): ConversationStarter | null {
  if (!id) return null
  return CONVERSATION_STARTERS.find((starter) => starter.id === id) ?? null
}

export function conversationOpening(level: ConversationLevel, topicId: string | null | undefined): string {
  const starter = findConversationStarter(topicId)
  if (starter) return starter.openings[level]
  return level === 'beginner'
    ? 'Hi! I am your English tutor. Tell me, how are you today?'
    : level === 'intermediate'
      ? 'Hi! Good to see you. What has your week been like so far?'
      : 'Hi! Let us get started. What has been on your mind this week?'
}
