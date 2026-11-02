import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_INSTRUCTION = `Kamu adalah guru bahasa Inggris yang interaktif, ramah, dan sabar. Tugasmu adalah:
1. Mendengarkan rekaman suara siswa
2. Menganalisis pelafalan dan tata bahasa
3. Memberikan respons audio balasan singkat (maksimal 2-3 kalimat)
4. Di akhir tanggapan, berikan evaluasi pelafalan/tata bahasa yang keliru secara halus
5. Akhiri dengan pertanyaan pemancing agar siswa terdorong merekam kembali

Gunakan bahasa Inggris sederhana dan jelas. Jadilah hangat dan mendorong.`

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'Audio file is required'), { status: 400 })
    }

    // Validate file size (max 10MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'Audio file too large (max 10MB)'), { status: 400 })
    }

    // Validate MIME type
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4']
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(apiError('VALIDATION_ERROR', `Unsupported audio type: ${audioFile.type}`), { status: 400 })
    }

    // Convert audio to base64 for AI processing
    const audioBuffer = await audioFile.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    // TODO: Replace with actual Gemini 3.8 Flash TTS / Flash Lite TTS API call
    // For now, this is a placeholder that returns a mock response
    // In production, this would:
    // 1. Send audio to Gemini for STT + analysis
    // 2. Generate response text based on system instruction
    // 3. Convert response to speech via Gemini TTS
    // 4. Return raw binary audio

    // Placeholder: Return a simple text response as JSON
    // In production, replace this with actual Gemini TTS binary response
    const responseText = "Great job speaking! I noticed a small pronunciation issue with the 'th' sound. Try saying 'think' again. What would you like to talk about next?"

    // For now, return JSON (will be replaced with binary audio in production)
    // To return binary audio, use:
    // return new NextResponse(audioBuffer, {
    //   status: 200,
    //   headers: { 'Content-Type': 'audio/mp3' }
    // })

    return NextResponse.json({
      data: {
        text: responseText,
        feedback: 'Pelafalan "th" perlu diperbaiki. Coba ucapkan "think" dengan lidah di antara gigi.',
      },
    }, { status: 200 })

  } catch (error) {
    console.error('Latihan Bicara AI error:', error)
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Gagal memproses audio. Coba lagi.'),
      { status: 500 },
    )
  }
}
