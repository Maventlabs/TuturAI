import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { validateFirebaseClientConfig } from './client-config.mjs'

let authEmulatorConnected = false
let firestoreEmulatorConnected = false

function getClientConfig() {
  return validateFirebaseClientConfig({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
    NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST,
  })
}

export function getFirebaseApp(): FirebaseApp {
  const config = getClientConfig()
  return getApps()[0] ?? initializeApp(config)
}

export function getFirebaseClientDiagnostics() {
  return {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || null,
  }
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
