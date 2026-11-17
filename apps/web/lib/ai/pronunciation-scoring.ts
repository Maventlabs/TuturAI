export type PronunciationVerdict = 'correct' | 'close' | 'incorrect'

export interface PronunciationSegment {
  /** Letters of the target word in this chunk, empty for an inserted sound. */
  target: string
  /** Letters the recognizer reported for the same chunk, null when dropped. */
  heard: string | null
  match: boolean
}

export interface SingleWordPronunciationScore {
  targetText: string
  transcript: string
  /** The single token the score was computed from. */
  heardWord: string
  score: number
  confidence: number | null
  verdict: PronunciationVerdict
  feedback: string
  segments: PronunciationSegment[]
}

export interface ScoreSingleWordInput {
  target: string
  transcript: string
  confidence?: number | null
}

/**
 * Spelling-to-sound rules, applied in order. They are not a phoneme inventory:
 * they collapse the spellings that English pronounces the same way so that a
 * recognizer writing "thoro" for "thorough" is not punished for the spelling.
 */
const SOUND_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ough/g, 'o'],
  [/augh/g, 'a'],
  [/tion/g, 'Sn'],
  [/sion/g, 'Sn'],
  [/ture/g, 'C'],
  [/ph/g, 'f'],
  [/th/g, '0'],
  [/sh/g, 'S'],
  [/ch/g, 'C'],
  [/ck/g, 'k'],
  [/qu/g, 'kw'],
  [/wh/g, 'w'],
  [/gh/g, ''],
  [/kn/g, 'n'],
  [/wr/g, 'r'],
  [/mb$/g, 'm'],
  [/eau/g, 'o'],
  [/ee/g, 'i'],
  [/ea/g, 'i'],
  [/oo/g, 'u'],
  [/ou/g, 'au'],
  [/ow/g, 'au'],
  [/ai/g, 'ei'],
  [/ay/g, 'ei'],
  [/oi/g, 'oi'],
  [/oy/g, 'oi'],
  [/igh/g, 'ai'],
  [/er/g, 'a'],
  [/ar/g, 'a'],
  [/or/g, 'o'],
  [/ir/g, 'a'],
  [/ur/g, 'a'],
  [/le$/g, 'l'],
  [/e$/g, ''],
  [/c(?=[eiy])/g, 's'],
  [/c/g, 'k'],
  [/x/g, 'ks'],
  [/z/g, 's'],
]

/**
 * A recognizer returns the word it thinks it heard, and English has words that
 * sound identical. These are the spellings accepted for the bank's targets so a
 * correct recording is not marked wrong because the recognizer picked the other
 * homophone ("Close" for "clothes", "Thoreau" for "thorough").
 */
const ACCEPTED_VARIANTS: Record<string, readonly string[]> = {
  clothes: ['close', 'cloze', 'cloths', 'clothe'],
  thorough: ['thoreau', 'thoro'],
  receipt: ['reseat', 'receit'],
  island: ['iland'],
  colleague: ['collegue', 'college'],
  determine: ['determin'],
  months: ['munce', 'monts'],
  vegetable: ['vegtable', 'vegitible'],
  comfortable: ['comftable', 'comfterble', 'comfortible'],
  recipe: ['resipe', 'recipy', 'resepi'],
  entrepreneur: ['entrepeneur', 'entrepenuer'],
  photography: ['photograpy', 'fotography'],
  development: ['developement'],
  phenomenon: ['phenominon', 'phenomenom'],
  particularly: ['particulary', 'paticularly'],
  opportunity: ['oportunity', 'oppurtunity'],
  environment: ['enviroment', 'envirnoment'],
  analysis: ['analisis'],
  architecture: ['arkitecture', 'architechture'],
  pronunciation: ['pronounciation', 'pronounciaton'],
  conscientious: ['consciencious', 'conscientous'],
  simultaneously: ['simultaniously', 'simultainiously'],
  unprecedented: ['unpresidented', 'unprecidented'],
  infrastructure: ['infrastucture', 'infrastruture'],
  mischievous: ['mischievious', 'mischieveous'],
  inevitable: ['inevitible', 'inevetable'],
  jurisdiction: ['jurisdicton', 'juristiction'],
  rural: ['rual', 'rurral'],
  statistics: ['statictics', 'statistiks'],
  unequivocal: ['unequvocal', 'unequivocable'],
}

export function normalizeWord(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z']/g, '')
    .replace(/'/g, '')
}

export function soundKey(value: string) {
  let key = normalizeWord(value)
  if (!key) return ''
  for (const [pattern, replacement] of SOUND_RULES) key = key.replace(pattern, replacement)
  return key.replace(/(.)\1+/g, '$1')
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

function similarity(a: string, b: string) {
  if (!a && !b) return 1
  const longest = Math.max(a.length, b.length)
  if (!longest) return 1
  return 1 - levenshtein(a, b) / longest
}

type AlignmentOp = { type: 'match' | 'sub' | 'ins' | 'del'; target: string; heard: string | null }

function alignOps(target: string, heard: string): AlignmentOp[] {
  const rows = target.length + 1
  const cols = heard.length + 1
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i += 1) table[i][0] = i
  for (let j = 0; j < cols; j += 1) table[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = target[i - 1] === heard[j - 1] ? 0 : 1
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + cost)
    }
  }

  const ops: AlignmentOp[] = []
  let i = target.length
  let j = heard.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (target[i - 1] === heard[j - 1] ? 0 : 1)) {
      const same = target[i - 1] === heard[j - 1]
      ops.push({ type: same ? 'match' : 'sub', target: target[i - 1], heard: heard[j - 1] })
      i -= 1
      j -= 1
    } else if (i > 0 && table[i][j] === table[i - 1][j] + 1) {
      ops.push({ type: 'del', target: target[i - 1], heard: null })
      i -= 1
    } else {
      ops.push({ type: 'ins', target: '', heard: heard[j - 1] })
      j -= 1
    }
  }
  return ops.reverse()
}

function groupSegments(ops: AlignmentOp[]): PronunciationSegment[] {
  const segments: PronunciationSegment[] = []
  for (const op of ops) {
    const match = op.type === 'match'
    const last = segments[segments.length - 1]
    if (last && last.match === match) {
      last.target += op.target
      last.heard = `${last.heard ?? ''}${op.heard ?? ''}`
    } else {
      segments.push({ target: op.target, heard: op.heard, match })
    }
  }
  return segments.filter((segment) => segment.target.length > 0 || (segment.heard ?? '').length > 0)
}

function verdictFor(score: number): PronunciationVerdict {
  if (score >= 85) return 'correct'
  if (score >= 65) return 'close'
  return 'incorrect'
}

function hintFor(segments: PronunciationSegment[]) {
  const first = segments.find((segment) => !segment.match)
  if (!first) return ''
  if (!first.target) return `Ada bunyi tambahan "${first.heard}" yang tidak ada di kata target.`
  if (!first.heard) return `Bagian "${first.target}" belum terdengar sama sekali.`
  return `Perhatikan "${first.target}" yang terdengar sebagai "${first.heard}".`
}

function tokensOf(transcript: string) {
  return transcript
    .split(/[^A-Za-z']+/)
    .map((token) => token.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

/**
 * Scores one spoken word against its target on a 1-100 scale.
 *
 * The recognizer returns text, not acoustics, so the score is a spelling and
 * sound-key agreement between what it heard and the target word. A recognizer
 * that returns several tokens is scored on its best-matching token, and the
 * caller is told which token that was.
 */
export function scoreSingleWord({ target, transcript, confidence = null }: ScoreSingleWordInput): SingleWordPronunciationScore {
  const targetText = target.trim()
  const normalizedTarget = normalizeWord(targetText)
  const tokens = tokensOf(transcript)

  if (!normalizedTarget || tokens.length === 0) {
    return {
      targetText,
      transcript: transcript.trim(),
      heardWord: '',
      score: 1,
      confidence,
      verdict: 'incorrect',
      feedback: 'Tidak ada kata yang terdeteksi. Rekam ulang lebih dekat ke mikrofon.',
      segments: [],
    }
  }

  const acceptedVariants = ACCEPTED_VARIANTS[normalizedTarget] ?? []
  let best = { token: tokens[0], score: 0, variant: false, segments: [] as PronunciationSegment[] }
  for (const token of tokens) {
    const normalizedHeard = normalizeWord(token)
    const variant = normalizedHeard !== normalizedTarget && acceptedVariants.includes(normalizedHeard)
    const spelling = similarity(normalizedTarget, normalizedHeard)
    const sound = similarity(soundKey(normalizedTarget), soundKey(normalizedHeard))
    const raw = normalizedTarget === normalizedHeard || variant ? 1 : 0.45 * spelling + 0.55 * sound
    const score = Math.max(1, Math.min(100, Math.round(raw * 100)))
    if (score > best.score) {
      best = {
        token,
        score,
        variant,
        segments: variant
          ? [{ target: normalizedTarget, heard: normalizedHeard, match: true }]
          : groupSegments(alignOps(normalizedTarget, normalizedHeard)),
      }
    }
  }

  const verdict = verdictFor(best.score)
  const hint = hintFor(best.segments)
  const extraTokens = tokens.length > 1 ? ` STT menangkap ${tokens.length} kata; yang dinilai "${best.token}".` : ''

  const feedback = best.variant
    ? `Pelafalan "${targetText}" diterima. STT menulis "${best.token}" yang berbunyi sama.${extraTokens}`
    : verdict === 'correct'
    ? `Pelafalan "${targetText}" sudah jelas dan cocok dengan target.${extraTokens}`
    : verdict === 'close'
      ? `Hampir tepat. STT mendengar "${best.token}". ${hint}${extraTokens}`.trim()
      : `STT mendengar "${best.token}", belum cocok dengan "${targetText}". ${hint}${extraTokens}`.trim()

  return {
    targetText,
    transcript: transcript.trim(),
    heardWord: best.token,
    score: best.score,
    confidence,
    verdict,
    feedback,
    segments: best.segments,
  }
}
