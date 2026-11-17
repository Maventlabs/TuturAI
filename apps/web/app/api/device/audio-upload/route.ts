import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { getSessionProfile } from '@/lib/firebase/session'
import { hasCloudinaryConfig } from '@/lib/config/env'
import { CloudinaryError, uploadToCloudinary } from '@/lib/storage/cloudinary'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  const { user } = await getSessionProfile()
  if (!user) return NextResponse.json(apiError('UNAUTHENTICATED', 'Authentication required'), { status: 401 })

  if (!hasCloudinaryConfig()) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Audio storage is not configured'), { status: 503 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'An audio file is required'), { status: 400 })
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Audio file must be 10 MB or smaller'), { status: 413 })
  }
  if (!file.type.startsWith('audio/')) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Only audio uploads are accepted'), { status: 415 })
  }

  try {
    const uploaded = await uploadToCloudinary({
      file,
      filename: file.name || 'recording.webm',
      folder: `tuturai/audio/${user.uid}`,
      resourceType: 'video',
    })
    return NextResponse.json(
      { url: uploaded.url, publicId: uploaded.publicId, bytes: uploaded.bytes },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CloudinaryError) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Audio could not be stored', { status: error.status }),
        { status: 502 },
      )
    }
    throw error
  }
}
