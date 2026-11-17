import {
  type ConversationCorrection,
  type ConversationLevel,
  type ConversationMode,
  type ConversationReply,
  type ConversationSummary,
  type ConversationVocabularyNote,
} from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'

const SESSIONS = 'conversationSessions'
const TURNS = 'turns'

export interface ConversationSessionRecord {
  id: string
  studentId: string
  status: 'active' | 'ended'
  mode: ConversationMode
  level: ConversationLevel
  topicId: string | null
  topicLabel: string | null
  startedAt: number
  endedAt: number | null
  turnCount: number
  summary: ConversationSummary | null
}

export interface ConversationTurnRecord {
  id: string
  sessionId: string
  speaker: 'student' | 'tutor'
  transcript: string
  corrections: ConversationCorrection[]
  vocabularyNotes: ConversationVocabularyNote[]
  createdAt: number
}

function toSession(id: string, data: FirebaseFirestore.DocumentData | undefined): ConversationSessionRecord | null {
  if (!data || typeof data.studentId !== 'string') return null
  return {
    id,
    studentId: data.studentId,
    status: data.status === 'ended' ? 'ended' : 'active',
    mode: data.mode === 'hands-free' ? 'hands-free' : 'push-to-talk',
    level: data.level === 'intermediate' || data.level === 'advanced' ? data.level : 'beginner',
    topicId: typeof data.topicId === 'string' ? data.topicId : null,
    topicLabel: typeof data.topicLabel === 'string' ? data.topicLabel : null,
    startedAt: typeof data.startedAt === 'number' ? data.startedAt : 0,
    endedAt: typeof data.endedAt === 'number' ? data.endedAt : null,
    turnCount: typeof data.turnCount === 'number' ? data.turnCount : 0,
    summary: (data.summary as ConversationSummary | null) ?? null,
  }
}

function toTurn(id: string, data: FirebaseFirestore.DocumentData | undefined): ConversationTurnRecord | null {
  if (!data || typeof data.transcript !== 'string') return null
  return {
    id,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
    speaker: data.speaker === 'tutor' ? 'tutor' : 'student',
    transcript: data.transcript,
    corrections: Array.isArray(data.corrections) ? (data.corrections as ConversationCorrection[]) : [],
    vocabularyNotes: Array.isArray(data.vocabularyNotes) ? (data.vocabularyNotes as ConversationVocabularyNote[]) : [],
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  }
}

export async function createConversationSession(input: {
  studentId: string
  level: ConversationLevel
  mode: ConversationMode
  topicId: string | null
  topicLabel: string | null
}): Promise<ConversationSessionRecord> {
  const db = getAdminDb()
  const reference = db.collection(SESSIONS).doc()
  const now = Date.now()
  const record: ConversationSessionRecord = {
    id: reference.id,
    studentId: input.studentId,
    status: 'active',
    mode: input.mode,
    level: input.level,
    topicId: input.topicId,
    topicLabel: input.topicLabel,
    startedAt: now,
    endedAt: null,
    turnCount: 0,
    summary: null,
  }

  await reference.create({
    studentId: record.studentId,
    status: record.status,
    mode: record.mode,
    level: record.level,
    topicId: record.topicId,
    topicLabel: record.topicLabel,
    startedAt: record.startedAt,
    endedAt: null,
    turnCount: 0,
    summary: null,
    createdAt: now,
    updatedAt: now,
  })

  return record
}

/** Ownership is enforced here: a session belonging to another student reads as missing. */
export async function getConversationSession(
  studentId: string,
  sessionId: string,
): Promise<ConversationSessionRecord | null> {
  const snapshot = await getAdminDb().collection(SESSIONS).doc(sessionId).get()
  const record = toSession(snapshot.id, snapshot.data())
  if (!record || record.studentId !== studentId) return null
  return record
}

function isMissingIndexError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code
  const message = (error as { message?: unknown } | null)?.message
  return code === 9 || (typeof message === 'string' && message.includes('index'))
}

export async function listConversationSessions(
  studentId: string,
  limit = 12,
): Promise<ConversationSessionRecord[]> {
  const collection = getAdminDb().collection(SESSIONS)
  const toRecords = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
    docs
      .map((doc) => toSession(doc.id, doc.data()))
      .filter((record): record is ConversationSessionRecord => record !== null)

  try {
    const snapshot = await collection
      .where('studentId', '==', studentId)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get()
    return toRecords(snapshot.docs)
  } catch (error) {
    // Firestore rejects this query until the (studentId, startedAt) composite
    // index is deployed. Sorting a bounded page in memory keeps history usable
    // instead of failing the whole request.
    if (!isMissingIndexError(error)) throw error
    const snapshot = await collection.where('studentId', '==', studentId).limit(limit * 4).get()
    return toRecords(snapshot.docs)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
  }
}

export async function loadConversationTurns(
  studentId: string,
  sessionId: string,
  limit = 40,
): Promise<ConversationTurnRecord[]> {
  const session = await getConversationSession(studentId, sessionId)
  if (!session) return []

  const snapshot = await getAdminDb()
    .collection(SESSIONS)
    .doc(sessionId)
    .collection(TURNS)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get()

  return snapshot.docs
    .map((doc) => toTurn(doc.id, doc.data()))
    .filter((record): record is ConversationTurnRecord => record !== null)
}

export interface SavedTurnPair {
  studentTurn: ConversationTurnRecord
  tutorTurn: ConversationTurnRecord
  duplicate: boolean
}

/**
 * Writes the student transcript and the tutor reply as one idempotent pair. A
 * retried request with the same turnId returns the stored pair instead of
 * appending a duplicate exchange.
 */
export async function saveConversationTurn(input: {
  studentId: string
  sessionId: string
  turnId: string
  transcript: string
  reply: ConversationReply
}): Promise<SavedTurnPair | null> {
  const db = getAdminDb()
  const sessionRef = db.collection(SESSIONS).doc(input.sessionId)
  const studentRef = sessionRef.collection(TURNS).doc(`${input.turnId}:student`)
  const tutorRef = sessionRef.collection(TURNS).doc(`${input.turnId}:tutor`)
  const now = Date.now()

  return db.runTransaction(async (transaction) => {
    const [sessionSnapshot, existingStudent, existingTutor] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(studentRef),
      transaction.get(tutorRef),
    ])

    const session = toSession(sessionSnapshot.id, sessionSnapshot.data())
    if (!session || session.studentId !== input.studentId) return null

    if (existingStudent.exists && existingTutor.exists) {
      const studentTurn = toTurn(existingStudent.id, existingStudent.data())
      const tutorTurn = toTurn(existingTutor.id, existingTutor.data())
      if (!studentTurn || !tutorTurn) return null
      return { studentTurn, tutorTurn, duplicate: true }
    }

    const studentTurn: ConversationTurnRecord = {
      id: studentRef.id,
      sessionId: input.sessionId,
      speaker: 'student',
      transcript: input.transcript,
      corrections: [],
      vocabularyNotes: [],
      createdAt: now,
    }
    const tutorTurn: ConversationTurnRecord = {
      id: tutorRef.id,
      sessionId: input.sessionId,
      speaker: 'tutor',
      transcript: input.reply.spokenResponse,
      corrections: input.reply.corrections,
      vocabularyNotes: input.reply.vocabularyNotes,
      createdAt: now + 1,
    }

    transaction.create(studentRef, { ...studentTurn })
    transaction.create(tutorRef, { ...tutorTurn })
    transaction.update(sessionRef, {
      turnCount: session.turnCount + 1,
      updatedAt: now,
    })

    return { studentTurn, tutorTurn, duplicate: false }
  })
}

export async function endConversationSession(input: {
  studentId: string
  sessionId: string
  summary: ConversationSummary
}): Promise<ConversationSessionRecord | null> {
  const db = getAdminDb()
  const reference = db.collection(SESSIONS).doc(input.sessionId)
  const snapshot = await reference.get()
  const session = toSession(snapshot.id, snapshot.data())
  if (!session || session.studentId !== input.studentId) return null

  const now = Date.now()
  await reference.update({
    status: 'ended',
    endedAt: session.endedAt ?? now,
    summary: input.summary,
    updatedAt: now,
  })

  return { ...session, status: 'ended', endedAt: session.endedAt ?? now, summary: input.summary }
}

/**
 * Turns the corrections already stored in this session into a short list of
 * recurring error labels, so the tutor can explain a repeated mistake in more
 * depth without a second model call.
 */
export function recurringErrorLabels(turns: ConversationTurnRecord[]): string[] {
  const counts = new Map<string, number>()
  for (const turn of turns) {
    for (const correction of turn.corrections) {
      const key = correction.category
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const labels: Record<string, string> = {
    grammar: 'grammar (tense, verb form, article)',
    vocabulary: 'word choice',
    sentence_structure: 'sentence structure',
    natural_expression: 'natural expression',
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => labels[category] ?? category)
}
