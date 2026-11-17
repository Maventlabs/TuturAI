import { createHash } from 'node:crypto'
import { getCloudinaryEnv } from '@/lib/config/env'

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto'

export class CloudinaryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'CloudinaryError'
  }
}

export interface CloudinaryUploadResult {
  url: string
  publicId: string
  bytes: number
  resourceType: string
}

interface CloudinaryUploadPayload {
  secure_url?: string
  public_id?: string
  bytes?: number
  resource_type?: string
  error?: { message?: string }
}

/**
 * Signed upload to Cloudinary. Audio is stored under the `video` resource type,
 * which is how Cloudinary classifies every non-image media asset.
 */
export async function uploadToCloudinary(input: {
  file: Blob
  filename?: string
  folder?: string
  resourceType?: CloudinaryResourceType
  fetchImpl?: typeof fetch
}): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryEnv()
  const resourceType = input.resourceType ?? 'auto'
  const timestamp = Math.floor(Date.now() / 1000)
  const params: Record<string, string> = { timestamp: String(timestamp) }
  if (input.folder) params.folder = input.folder

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  const signature = createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex')

  const form = new FormData()
  form.append('file', input.file, input.filename)
  form.append('api_key', apiKey)
  for (const [key, value] of Object.entries(params)) form.append(key, value)
  form.append('signature', signature)

  const response = await (input.fetchImpl ?? fetch)(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: 'POST', body: form },
  )
  const payload = (await response.json().catch(() => null)) as CloudinaryUploadPayload | null

  if (!response.ok || !payload?.secure_url) {
    throw new CloudinaryError(payload?.error?.message ?? 'Cloudinary upload failed', response.status)
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id ?? '',
    bytes: payload.bytes ?? 0,
    resourceType: payload.resource_type ?? resourceType,
  }
}
