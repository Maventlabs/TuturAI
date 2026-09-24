import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { getGoogleOAuthEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const DRIVE_MAX_FILE_BYTES = 25 * 1024 * 1024
const DRIVE_CONNECTIONS_COLLECTION = 'googleDriveConnections'
const DRIVE_OAUTH_STATES_COLLECTION = 'googleDriveOAuthStates'
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

export class DriveConfigurationError extends Error {
  constructor(message = 'Google Drive is not configured') {
    super(message)
    this.name = 'DriveConfigurationError'
  }
}

export function validateDriveFile(input: { name: string; mimeType: string; size: number }) {
  const name = input.name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
  if (!name || name.length > 180) throw new Error('INVALID_FILE_NAME')
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new Error('UNSUPPORTED_FILE_TYPE')
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > DRIVE_MAX_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
  return { name, mimeType: input.mimeType, size: input.size }
}

function encryptionKey() {
  try {
    return createHash('sha256').update(getGoogleOAuthEnv().tokenEncryptionKey).digest()
  } catch {
    throw new DriveConfigurationError('Google Drive token encryption is not configured')
  }
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

function decrypt(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('INVALID_ENCRYPTED_TOKEN')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
}

export async function createDriveOAuthState(teacherId: string) {
  const env = getGoogleOAuthEnv()
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  await getAdminDb().collection(DRIVE_OAUTH_STATES_COLLECTION).doc(state).create({
    teacherId,
    codeVerifier: encrypt(verifier),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    createdAt: Timestamp.now(),
  })

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', env.clientId)
  url.searchParams.set('redirect_uri', env.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', DRIVE_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export async function completeDriveOAuth(state: string, code: string) {
  const env = getGoogleOAuthEnv()
  const reference = getAdminDb().collection(DRIVE_OAUTH_STATES_COLLECTION).doc(state)
  const snapshot = await reference.get()
  const stateData = snapshot.data()
  if (!snapshot.exists || !stateData || stateData.expiresAt.toMillis() < Date.now()) throw new Error('INVALID_OAUTH_STATE')
  await reference.delete()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: 'authorization_code',
      code,
      code_verifier: decrypt(stateData.codeVerifier),
    }),
  })
  if (!response.ok) throw new Error('DRIVE_OAUTH_EXCHANGE_FAILED')
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!token.access_token || !token.refresh_token) throw new Error('DRIVE_REFRESH_TOKEN_MISSING')

  await getAdminDb().collection(DRIVE_CONNECTIONS_COLLECTION).doc(stateData.teacherId).set({
    teacherId: stateData.teacherId,
    accessToken: encrypt(token.access_token),
    refreshToken: encrypt(token.refresh_token),
    expiresAt: Timestamp.fromMillis(Date.now() + (token.expires_in ?? 3600) * 1000),
    scope: DRIVE_SCOPE,
    updatedAt: Timestamp.now(),
  })
  return stateData.teacherId
}

async function getDriveAccessToken(teacherId: string) {
  const env = getGoogleOAuthEnv()
  const reference = getAdminDb().collection(DRIVE_CONNECTIONS_COLLECTION).doc(teacherId)
  const snapshot = await reference.get()
  const data = snapshot.data()
  if (!snapshot.exists || !data?.refreshToken) throw new Error('DRIVE_NOT_CONNECTED')
  if (data.accessToken && data.expiresAt?.toMillis?.() > Date.now() + 60_000) return decrypt(data.accessToken)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, grant_type: 'refresh_token', refresh_token: decrypt(data.refreshToken) }),
  })
  if (!response.ok) throw new Error('DRIVE_TOKEN_REFRESH_FAILED')
  const token = await response.json() as { access_token?: string; expires_in?: number }
  if (!token.access_token) throw new Error('DRIVE_ACCESS_TOKEN_MISSING')
  await reference.update({ accessToken: encrypt(token.access_token), expiresAt: Timestamp.fromMillis(Date.now() + (token.expires_in ?? 3600) * 1000), updatedAt: Timestamp.now() })
  return token.access_token
}

export async function uploadDriveFile(input: { teacherId: string; file: Uint8Array; name: string; mimeType: string; folderId?: string }) {
  const metadata = validateDriveFile({ name: input.name, mimeType: input.mimeType, size: input.file.byteLength })
  const accessToken = await getDriveAccessToken(input.teacherId)
  const boundary = `tuturai-${randomBytes(12).toString('hex')}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: metadata.name, mimeType: metadata.mimeType, ...(input.folderId ? { parents: [input.folderId] } : {}) })}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`),
    Buffer.from(input.file),
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.byteLength) },
    body,
  })
  if (!response.ok) throw new Error('DRIVE_UPLOAD_FAILED')
  return response.json() as Promise<{ id: string; name: string; mimeType: string; size?: string; webViewLink?: string }>
}

export async function getDriveConnectionStatus(teacherId: string) {
  const snapshot = await getAdminDb().collection(DRIVE_CONNECTIONS_COLLECTION).doc(teacherId).get()
  const data = snapshot.data()
  return {
    connected: snapshot.exists && typeof data?.refreshToken === 'string',
    scope: typeof data?.scope === 'string' ? data.scope : null,
    updatedAt: data?.updatedAt?.toDate?.()?.toISOString?.() ?? null,
  }
}

export async function disconnectDrive(teacherId: string) {
  await getAdminDb().collection(DRIVE_CONNECTIONS_COLLECTION).doc(teacherId).delete()
}

function folderName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'Untitled'
}

async function driveJsonRequest<T>(teacherId: string, url: string, init: RequestInit = {}) {
  const accessToken = await getDriveAccessToken(teacherId)
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error('DRIVE_API_FAILED')
  return response.json() as Promise<T>
}

async function findOrCreateDriveFolder(teacherId: string, name: string, parentId?: string) {
  const escapedName = name.replace(/'/g, "\\'")
  const query = [`name = '${escapedName}'`, `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`, 'trashed = false', ...(parentId ? [`'${parentId}' in parents`] : [])].join(' and ')
  const result = await driveJsonRequest<{ files?: Array<{ id: string }> }>(teacherId, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1&fields=files(id)`)
  const existing = result.files?.[0]
  if (existing?.id) return existing.id
  const created = await driveJsonRequest<{ id: string }>(teacherId, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName(name), mimeType: DRIVE_FOLDER_MIME_TYPE, ...(parentId ? { parents: [parentId] } : {}) }),
  })
  return created.id
}

export async function ensureDriveFolderStructure(input: { teacherId: string; classroomId: string; assignmentId: string; studentId?: string }) {
  const root = await findOrCreateDriveFolder(input.teacherId, 'TuturAI')
  const classroom = await findOrCreateDriveFolder(input.teacherId, `class-${input.classroomId}`, root)
  const assignment = await findOrCreateDriveFolder(input.teacherId, `assignment-${input.assignmentId}`, classroom)
  if (!input.studentId) return { root, classroom, assignment }
  const submission = await findOrCreateDriveFolder(input.teacherId, 'submission', assignment)
  const student = await findOrCreateDriveFolder(input.teacherId, `student-${input.studentId}`, submission)
  return { root, classroom, assignment, submission, student }
}

export async function deleteDriveFile(teacherId: string, fileId: string) {
  const accessToken = await getDriveAccessToken(teacherId)
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404) throw new Error('DRIVE_DELETE_FAILED')
}
