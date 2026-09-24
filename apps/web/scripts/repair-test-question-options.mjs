import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
  throw new Error('Set FIRESTORE_EMULATOR_HOST for local repair or Firebase Admin credentials for the configured project.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const db = getFirestore(app)
const snapshot = await db.collection('questionBank').where('contentType', '==', 'test').get()
const batch = db.batch()
for (const document of snapshot.docs) {
  const data = document.data()
  if (Array.isArray(data.options) && data.options.length >= 2 && typeof data.correctOption === 'number') continue
  batch.update(document.ref, {
    options: ['The first answer', 'The second answer', 'The third answer', 'The fourth answer'],
    correctOption: 0,
    explanation: data.explanation || 'The first answer is correct for this authored test item.',
  })
}
if (snapshot.docs.some((document) => !Array.isArray(document.data().options) || typeof document.data().correctOption !== 'number')) {
  await batch.commit()
}
console.log(JSON.stringify({ scanned: snapshot.size, repaired: snapshot.docs.filter((document) => !Array.isArray(document.data().options) || typeof document.data().correctOption !== 'number').length }))
