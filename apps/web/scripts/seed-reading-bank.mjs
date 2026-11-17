import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { READING_BANK } from './reading-bank-data.mjs'

/**
 * Publishes the authored reading bank: 20 passages, five questions each.
 *
 * A passage and its questions are written together so the quiz can never draw a
 * passage whose questions are missing. The script refuses to publish a passage
 * that breaks the exam contract (3–4 paragraphs, exactly 5 questions, 4 options
 * per question), which keeps authoring mistakes out of the database.
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

const QUESTIONS_PER_PASSAGE = 5
const MIN_PARAGRAPHS = 3
const MAX_PARAGRAPHS = 4
const OPTIONS_PER_QUESTION = 4

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

const passageDocuments = []
const questionDocuments = []

READING_BANK.forEach((passage, passageIndex) => {
  if (passage.paragraphs.length < MIN_PARAGRAPHS || passage.paragraphs.length > MAX_PARAGRAPHS) {
    throw new Error(`${passage.id} must have ${MIN_PARAGRAPHS}-${MAX_PARAGRAPHS} paragraphs`)
  }
  if (passage.questions.length !== QUESTIONS_PER_PASSAGE) {
    throw new Error(`${passage.id} must have exactly ${QUESTIONS_PER_PASSAGE} questions`)
  }

  passageDocuments.push({
    id: passage.id,
    data: {
      level: passage.level,
      title: passage.title,
      topic: passage.topic,
      paragraphs: passage.paragraphs,
      paragraphCount: passage.paragraphs.length,
      wordCount: passage.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
      questionIds: passage.questions.map((question) => question.id),
      status: 'published',
      createdAt: now,
      updatedAt: now,
    },
  })

  passage.questions.forEach((question, questionIndex) => {
    if (question.options.length !== OPTIONS_PER_QUESTION) {
      throw new Error(`${question.id} must have ${OPTIONS_PER_QUESTION} options`)
    }
    if (!Number.isInteger(question.correctOption) || question.correctOption < 0 || question.correctOption >= OPTIONS_PER_QUESTION) {
      throw new Error(`${question.id} has an invalid correctOption`)
    }

    const { options, correctOption } = rotateOptions(
      question.options,
      question.correctOption,
      (passageIndex + questionIndex) % OPTIONS_PER_QUESTION,
    )

    questionDocuments.push({
      id: question.id,
      data: {
        contentType: 'reading',
        skill: 'reading',
        level: passage.level,
        passageId: passage.id,
        questionType: question.type,
        prompt: question.prompt,
        options,
        correctOption,
        explanation: question.explanation,
        tags: ['reading', passage.level, question.type],
        status: 'published',
        createdAt: now,
        updatedAt: now,
      },
    })
  })
})

const [existingQuestions, existingPassages] = await Promise.all([
  db.collection('questionBank').where('contentType', '==', 'reading').get(),
  db.collection('readingPassages').limit(500).get(),
])

const authoredQuestionIds = new Set(questionDocuments.map((document) => document.id))
const authoredPassageIds = new Set(passageDocuments.map((document) => document.id))

const staleQuestions = existingQuestions.docs.filter(
  (doc) => !authoredQuestionIds.has(doc.id) && doc.data().status !== 'archived',
)
const stalePassages = existingPassages.docs.filter(
  (doc) => !authoredPassageIds.has(doc.id) && doc.data().status !== 'archived',
)

const operations = [
  ...passageDocuments.map((document) => ({ collection: 'readingPassages', type: 'set', id: document.id, data: document.data })),
  ...questionDocuments.map((document) => ({ collection: 'questionBank', type: 'set', id: document.id, data: document.data })),
  ...stalePassages.map((doc) => ({ collection: 'readingPassages', type: 'update', id: doc.id, data: { status: 'archived', updatedAt: now } })),
  ...staleQuestions.map((doc) => ({ collection: 'questionBank', type: 'update', id: doc.id, data: { status: 'archived', updatedAt: now } })),
]

for (let index = 0; index < operations.length; index += 400) {
  const batch = db.batch()
  for (const operation of operations.slice(index, index + 400)) {
    const reference = db.collection(operation.collection).doc(operation.id)
    if (operation.type === 'set') batch.set(reference, operation.data)
    else batch.update(reference, operation.data)
  }
  await batch.commit()
}

const perLevel = passageDocuments.reduce((counts, document) => {
  const level = document.data.level
  counts[level] = counts[level] ?? { passages: 0, questions: 0 }
  counts[level].passages += 1
  counts[level].questions += document.data.questionIds.length
  return counts
}, {})

console.log(JSON.stringify({
  passages: passageDocuments.length,
  questions: questionDocuments.length,
  perLevel,
  archivedPassages: stalePassages.map((doc) => doc.id),
  archivedQuestions: staleQuestions.map((doc) => doc.id),
}, null, 2))
