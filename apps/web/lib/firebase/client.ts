import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

let authEmulatorConnected = false
let firestoreEmulatorConnected = false

function getClientConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (Object.values(config).some((value) => !value)) {
    throw new Error('Firebase client configuration is incomplete')
  }

  return config
}

export function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(getClientConfig())
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp())
  const emulatorHost = process.env.NODE_ENV === 'production'
    ? undefined
    : process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
  if (emulatorHost && !authEmulatorConnected) {
    const [host, port = '9099'] = emulatorHost.split(':')
    connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true })
    authEmulatorConnected = true
  }
  return auth
}

export function getFirebaseDb(): Firestore {
  const db = getFirestore(getFirebaseApp())
  const emulatorHost = process.env.NODE_ENV === 'production'
    ? undefined
    : process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST
  if (emulatorHost && !firestoreEmulatorConnected) {
    const [host, port = '8080'] = emulatorHost.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    firestoreEmulatorConnected = true
  }
  return db
}
