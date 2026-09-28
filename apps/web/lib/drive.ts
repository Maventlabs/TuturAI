import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { getGoogleOAuthEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const DRIVE_MAX_FILE_BYTES = 25 * 1024 * 1024
const DRIVE_CONNECTIONS_COLLECTION = 'googleDriveConnections'
const DRIVE_OAUTH_STATES_COLLECTION = 'googleDriveOAuthStates'
const DRIVE_UPLOAD_OPERATIONS_COLLECTION = 'googleDriveUploadOperations'
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const GOOGLE_REQUEST_TIMEOUT_MS = 15_000
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MIME_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

export class DriveConfigurationError extends Error {
  constructor(message = 'Google Drive is not configured') {
    super(message)
    this.name = 'DriveConfigurationError'
  }
}

async function fetchDrive(url: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('The operation timed out', 'TimeoutError')), GOOGLE_REQUEST_TIMEOUT_MS)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') throw new Error('DRIVE_REQUEST_TIMEOUT')
    if (cause instanceof DOMException && cause.name === 'AbortError') throw new Error('DRIVE_REQUEST_CANCELLED')
    throw new Error('DRIVE_PROVIDER_UNAVAILABLE')
  } finally {
    clearTimeout(timeout)
  }
}

export function validateDriveFile(input: { name: string; mimeType: string; size: number }) {
  const name = input.name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
  if (!name || name.length > 180) throw new Error('INVALID_FILE_NAME')
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new Error('UNSUPPORTED_FILE_TYPE')
  const expectedExtension = MIME_EXTENSIONS[input.mimeType]
  if (!expectedExtension?.some((extension) => name.toLowerCase().endsWith(extension))) throw new Error('INVALID_FILE_EXTENSION')
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

  const response = await fetchDrive('https://oauth2.googleapis.com/token', {
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
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) throw new Error('DRIVE_PROVIDER_UNAVAILABLE')
    throw new Error('DRIVE_OAUTH_EXCHANGE_FAILED')
  }
  let token: { access_token?: string; refresh_token?: string; expires_in?: number }
  try {
    token = await response.json() as typeof token
  } catch {
    throw new Error('DRIVE_INVALID_RESPONSE')
  }
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

async function getDriveAccessToken(teacherId: string, fetchImpl: typeof fetch = fetch) {
  const env = getGoogleOAuthEnv()
  const reference = getAdminDb().collection(DRIVE_CONNECTIONS_COLLECTION).doc(teacherId)
  const snapshot = await reference.get()
  const data = snapshot.data()
  if (!snapshot.exists || !data?.refreshToken) throw new Error('DRIVE_NOT_CONNECTED')
  if (data.accessToken && data.expiresAt?.toMillis?.() > Date.now() + 60_000) return decrypt(data.accessToken)

  const response = await fetchDrive('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, grant_type: 'refresh_token', refresh_token: decrypt(data.refreshToken) }),
  }, fetchImpl)
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) throw new Error('DRIVE_PROVIDER_UNAVAILABLE')
    let providerCode: string | undefined
    try {
      providerCode = (await response.json() as { error?: string }).error
    } catch {
      // Keep provider response bodies out of logs and expose only stable codes.
    }
    if (providerCode === 'invalid_grant' || response.status === 400 || response.status === 401) throw new Error('DRIVE_REAUTH_REQUIRED')
    throw new Error('DRIVE_TOKEN_REFRESH_FAILED')
  }
  let token: { access_token?: string; refresh_token?: string; expires_in?: number }
  try {
    token = await response.json() as typeof token
  } catch {
    throw new Error('DRIVE_INVALID_RESPONSE')
  }
  if (!token.access_token) throw new Error('DRIVE_ACCESS_TOKEN_MISSING')
  await reference.update({
    accessToken: encrypt(token.access_token),
    ...(token.refresh_token ? { refreshToken: encrypt(token.refresh_token) } : {}),
    expiresAt: Timestamp.fromMillis(Date.now() + (token.expires_in ?? 3600) * 1000),
    updatedAt: Timestamp.now(),
  })
  return token.access_token
}

export async function uploadDriveFile(input: {
  teacherId: string
  file: Uint8Array
  name: string
  mimeType: string
  folderId?: string
  idempotencyKey: string
  fetchImpl?: typeof fetch
}) {
  const metadata = validateDriveFile({ name: input.name, mimeType: input.mimeType, size: input.file.byteLength })
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 256) throw new Error('DRIVE_IDEMPOTENCY_KEY_REQUIRED')
  const fetchImpl = input.fetchImpl ?? fetch
  const db = getAdminDb()
  const accessToken = await getDriveAccessToken(input.teacherId, fetchImpl)
  const requestHash = createHash('sha256')
    .update(input.teacherId).update('\0')
    .update(input.folderId ?? '').update('\0')
    .update(metadata.name).update('\0')
    .update(metadata.mimeType).update('\0')
    .update(input.file)
    .digest('hex')
  const operationId = createHash('sha256').update(`${input.teacherId}:${input.idempotencyKey}`).digest('hex')
  const operationReference = db.collection(DRIVE_UPLOAD_OPERATIONS_COLLECTION).doc(operationId)
  const existingOperation = await operationReference.get()
  const existingData = existingOperation.data()
  if (existingOperation.exists && existingData?.requestHash !== requestHash) throw new Error('DRIVE_IDEMPOTENCY_KEY_REUSED')
  if (existingOperation.exists && existingData?.status === 'completed' && existingData.file) {
    return existingData.file as { id: string; name: string; mimeType: string; size?: string; webViewLink?: string }
  }

  let driveFileId = typeof existingData?.driveFileId === 'string' ? existingData.driveFileId : ''
  if (!driveFileId) {
    const generated = await driveJsonRequest<{ ids?: string[] }>(input.teacherId, 'https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&fields=ids', {}, fetchImpl)
    const generatedId = generated.ids?.[0]
    if (!generatedId || !/^[A-Za-z0-9_-]{10,256}$/.test(generatedId)) throw new Error('DRIVE_FILE_ID_GENERATION_FAILED')
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(operationReference)
      const operation = snapshot.data()
      if (snapshot.exists && operation?.requestHash !== requestHash) throw new Error('DRIVE_IDEMPOTENCY_KEY_REUSED')
      if (snapshot.exists && operation?.status === 'completed' && operation.file) {
        driveFileId = String(operation.driveFileId)
        return
      }
      if (snapshot.exists && typeof operation?.driveFileId === 'string') {
        driveFileId = operation.driveFileId
        return
      }
      driveFileId = generatedId
      transaction.create(operationReference, {
        teacherId: input.teacherId,
        requestHash,
        driveFileId,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const afterClaim = await operationReference.get()
    const afterData = afterClaim.data()
    if (afterData?.status === 'completed' && afterData.file) {
      return afterData.file as { id: string; name: string; mimeType: string; size?: string; webViewLink?: string }
    }
    if (typeof afterData?.driveFileId === 'string') driveFileId = afterData.driveFileId
  }

  const boundary = `tuturai-${randomBytes(12).toString('hex')}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ id: driveFileId, name: metadata.name, mimeType: metadata.mimeType, appProperties: { tuturaiRequestHash: requestHash }, ...(input.folderId ? { parents: [input.folderId] } : {}) })}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`),
    Buffer.from(input.file),
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await fetchDrive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,appProperties', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.byteLength) },
    body,
  }, fetchImpl)
  let uploaded: { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; appProperties?: Record<string, string> }
  if (response.status === 409) {
    uploaded = await driveJsonRequest<typeof uploaded>(input.teacherId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,webViewLink,appProperties`, {}, fetchImpl)
    if (uploaded.appProperties?.tuturaiRequestHash !== requestHash) throw new Error('DRIVE_IDEMPOTENCY_CONFLICT')
  } else {
    if (!response.ok) throw new Error('DRIVE_UPLOAD_FAILED')
    try {
      uploaded = await response.json() as typeof uploaded
    } catch {
      throw new Error('DRIVE_INVALID_RESPONSE')
    }
  }
  if (uploaded.id !== driveFileId || uploaded.name !== metadata.name || uploaded.mimeType !== metadata.mimeType) {
    throw new Error('DRIVE_INVALID_RESPONSE')
  }
  const result = { id: uploaded.id, name: uploaded.name, mimeType: uploaded.mimeType, ...(uploaded.size ? { size: uploaded.size } : {}), ...(uploaded.webViewLink ? { webViewLink: uploaded.webViewLink } : {}) }
  await operationReference.update({ status: 'completed', file: result, updatedAt: Timestamp.now() })
  return result
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
  const db = getAdminDb()
  const reference = db.collection(DRIVE_CONNECTIONS_COLLECTION).doc(teacherId)
  const snapshot = await reference.get()
  if (!snapshot.exists) return
  const encryptedRefreshToken = snapshot.data()?.refreshToken
  if (typeof encryptedRefreshToken !== 'string' || !encryptedRefreshToken) throw new Error('DRIVE_REFRESH_TOKEN_MISSING')
  const response = await fetchDrive('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: decrypt(encryptedRefreshToken) }),
  })
  // Google reports an already-revoked/expired token as invalid; deleting the
  // local encrypted copy is still safe because it can no longer be refreshed.
  if (!response.ok && response.status !== 400) throw new Error('DRIVE_TOKEN_REVOKE_FAILED')
  await reference.delete()
}

function folderName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'Untitled'
}

async function driveJsonRequest<T>(teacherId: string, url: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch) {
  const accessToken = await getDriveAccessToken(teacherId, fetchImpl)
  const response = await fetchDrive(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  }, fetchImpl)
  if (!response.ok) throw new Error('DRIVE_API_FAILED')
  try {
    return await response.json() as T
  } catch {
    throw new Error('DRIVE_INVALID_RESPONSE')
  }
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
  if (typeof created.id !== 'string' || !/^[A-Za-z0-9_-]{10,256}$/.test(created.id)) throw new Error('DRIVE_INVALID_RESPONSE')
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

export async function deleteDriveFile(teacherId: string, fileId: string, options: { allowMissingOperation?: boolean } = {}) {
  const db = getAdminDb()
  const operations = await db.collection(DRIVE_UPLOAD_OPERATIONS_COLLECTION).where('driveFileId', '==', fileId).get()
  const ownedOperations = operations.docs.filter((operation) => operation.data().teacherId === teacherId)
  if (!ownedOperations.length && !options.allowMissingOperation) throw new Error('DRIVE_FILE_NOT_OWNED')
  const accessToken = await getDriveAccessToken(teacherId)
  const response = await fetchDrive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404) throw new Error('DRIVE_DELETE_FAILED')
  if (ownedOperations.length) {
    const batch = db.batch()
    ownedOperations.forEach((operation) => batch.delete(operation.ref))
    await batch.commit()
  }
}
