import { existsSync, readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { LISTENING_BANK } from './listening-bank-data.mjs'

/**
 * Publishes the authored Listening bank: ten one-minute recordings per level.
 *
 * Each document points at the WAV rendered by `render-listening-audio.mjs`, so
 * the player streams a static file instead of calling a TTS provider at
 * runtime. Older listening documents without a recording are archived, because
 * a question the student cannot hear is not answerable.
 */

function loadLocalEnv() {
  const candidates = ['../.env.local', '../../../.env.development.local']
  for (const candidate of candidates) {
    try {
      const source = readFileSync(new URL(candidate, import.meta.url), 'utf8')
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (!match || process.env[match[1]]) continue
        const value = match[2].trim().replace(/^["']+/, '').replace(/["']+$/, '')
        process.env[match[1]] = value.replace(/\\n/g, '\n')
      }
      return
    } catch {
      // Try the next location; CI can provide the admin variables directly.
    }
  }
}

loadLocalEnv()

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  }),
})
const db = getFirestore(app)
const now = Timestamp.now()

const AUDIO_PUBLIC_PATH = '/audio/listening'
const AUDIO_DIR = new URL('../public/audio/listening/', import.meta.url)

// The authored order keeps the correct answer wherever it reads best, which
// clusters it in one position. Rotating each item's options spreads the key
// across every position so the answer cannot be guessed from its slot.
function rotateOptions(options, correctOption, target) {
  const shift = (correctOption - target + options.length) % options.length
  return {
    options: options.map((_, index) => options[(index + shift) % options.length]),
    correctOption: target,
  }
}

const documents = LISTENING_BANK.map((item, index) => {
  const filename = `${item.id}.wav`
  if (!existsSync(new URL(filename, AUDIO_DIR))) {
    throw new Error(`Missing recording for ${item.id}; run scripts/render-listening-audio.mjs first`)
  }

  const { options, correctOption } = rotateOptions(
    item.question.options,
    item.question.correctOption,
    index % item.question.options.length,
  )

  return {
    id: item.id,
    data: {
      contentType: 'listening',
      skill: 'listening',
      level: item.level,
      title: item.title,
      topic: item.topic,
      prompt: item.question.prompt,
      options,
      correctOption,
      explanation: item.question.explanation,
      audioUrl: `${AUDIO_PUBLIC_PATH}/${filename}`,
      audioText: item.lines.map(([, text]) => text).join(' '),
      tags: ['listening', item.level],
      status: 'published',
      createdAt: now,
      updatedAt: now,
    },
  }
})

const existing = await db.collection('questionBank').where('contentType', '==', 'listening').get()
const authoredIds = new Set(documents.map((document) => document.id))
const stale = existing.docs.filter((doc) => !authoredIds.has(doc.id) && doc.data().status !== 'archived')

const operations = [
  ...documents.map((document) => ({ type: 'set', id: document.id, data: document.data })),
  ...stale.map((doc) => ({ type: 'update', id: doc.id, data: { status: 'archived', updatedAt: now } })),
]

for (let index = 0; index < operations.length; index += 400) {
  const batch = db.batch()
  for (const operation of operations.slice(index, index + 400)) {
    const reference = db.collection('questionBank').doc(operation.id)
    if (operation.type === 'set') batch.set(reference, operation.data)
    else batch.update(reference, operation.data)
  }
  await batch.commit()
}

const perLevel = documents.reduce((counts, document) => {
  counts[document.data.level] = (counts[document.data.level] ?? 0) + 1
  return counts
}, {})

console.log(JSON.stringify({
  published: documents.length,
  perLevel,
  archived: stale.map((doc) => doc.id),
}, null, 2))
