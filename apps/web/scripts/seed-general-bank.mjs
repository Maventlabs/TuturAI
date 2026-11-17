import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { GENERAL_BANK } from './general-bank-data.mjs'

/**
 * Publishes the authored general question bank: 100 items across three levels.
 *
 * These items are graded only inside a quiz attempt, so they are stored with
 * `contentType: 'general'` and are deliberately not answerable through the
 * single-question endpoint.
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

const OPTIONS_PER_QUESTION = 4

// The category decides which existing skill the item is filed under, so the
// rest of the platform's analytics keep working without a new taxonomy.
const SKILL_BY_CATEGORY = {
  grammar: 'grammar',
  'sentence-structure': 'grammar',
  vocabulary: 'vocabulary',
  expressions: 'vocabulary',
  everyday: 'vocabulary',
  comprehension: 'reading',
}

function rotateOptions(options, correctOption, target) {
  const shift = (correctOption - target + options.length) % options.length
  return {
    options: options.map((_, index) => options[(index + shift) % options.length]),
    correctOption: target,
  }
}

const documents = GENERAL_BANK.map((item, index) => {
  if (item.options.length !== OPTIONS_PER_QUESTION) {
    throw new Error(`${item.id} must have ${OPTIONS_PER_QUESTION} options`)
  }
  if (!Number.isInteger(item.correctOption) || item.correctOption < 0 || item.correctOption >= OPTIONS_PER_QUESTION) {
    throw new Error(`${item.id} has an invalid correctOption`)
  }
  const skill = SKILL_BY_CATEGORY[item.category]
  if (!skill) throw new Error(`${item.id} has an unknown category: ${item.category}`)

  const { options, correctOption } = rotateOptions(
    item.options,
    item.correctOption,
    index % OPTIONS_PER_QUESTION,
  )

  return {
    id: item.id,
    data: {
      contentType: 'general',
      skill,
      level: item.level,
      category: item.category,
      prompt: item.prompt,
      options,
      correctOption,
      explanation: item.explanation,
      tags: ['general', item.level, item.category],
      status: 'published',
      createdAt: now,
      updatedAt: now,
    },
  }
})

const existing = await db.collection('questionBank').where('contentType', '==', 'general').get()
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
  const level = document.data.level
  counts[level] = (counts[level] ?? 0) + 1
  return counts
}, {})

const perCategory = documents.reduce((counts, document) => {
  const category = document.data.category
  counts[category] = (counts[category] ?? 0) + 1
  return counts
}, {})

console.log(JSON.stringify({
  published: documents.length,
  perLevel,
  perCategory,
  archived: stale.map((doc) => doc.id),
}, null, 2))
