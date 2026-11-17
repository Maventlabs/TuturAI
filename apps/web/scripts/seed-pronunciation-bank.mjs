import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

/**
 * Publishes the Pronunciation Lab bank: ten words per level, each with a
 * pre-rendered model recording stored under `public/audio/pronunciation`.
 *
 * The recordings are generated once here, not at request time, so the lab can
 * play a model voice without a TTS call in the student's session. Every word is
 * an IELTS-level target: the difficulty is in the sound (silent letters, stress
 * shift, consonant clusters), not in the meaning.
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

const AUDIO_DIR = new URL('../public/audio/pronunciation/', import.meta.url)
const AUDIO_PUBLIC_PATH = '/audio/pronunciation'
const FORCE_AUDIO = process.argv.includes('--force-audio')

// [word, ipa, meaning, example, tip]
const BANK = {
  beginner: [
    ['comfortable', '/ˈkʌmf.tə.bəl/', 'nyaman', 'The reading room is quiet and comfortable.', 'Tiga suku kata: KUMF-te-bəl. Jangan ucapkan "kom-for-tei-bel".'],
    ['vegetable', '/ˈvedʒ.tə.bəl/', 'sayur', 'She buys fresh vegetables at the morning market.', 'Tiga suku kata: VEJ-te-bəl. Suku kata kedua menghilang, bukan "ve-ge-ta-bel".'],
    ['recipe', '/ˈres.ə.pi/', 'resep', 'This recipe needs only four ingredients.', 'Berakhiran bunyi /pi/, bukan /paɪ/. Bukan "re-sipe".'],
    ['colleague', '/ˈkɒl.iːɡ/', 'rekan kerja', 'My colleague checked the data before the deadline.', 'Tekanan di suku pertama dan "ue" tidak dibunyikan: KOL-eeg.'],
    ['determine', '/dɪˈtɜː.mɪn/', 'menentukan', 'The committee will determine the final score.', 'Akhiran berbunyi /mɪn/, bukan /maɪn/. Bukan "dee-ter-mine".'],
    ['thorough', '/ˈθʌr.ə/', 'menyeluruh', 'The teacher gave a thorough explanation of the task.', 'Dua suku kata dengan /θ/ di awal dan schwa di akhir: THUH-re.'],
    ['clothes', '/kləʊðz/', 'pakaian', 'Wear comfortable clothes for the speaking test.', 'Satu suku kata dengan gugus /ðz/ di akhir, bukan "klo-thes".'],
    ['months', '/mʌnθs/', 'bulan-bulan', 'The course runs for six months.', 'Akhiran /nθs/ diucapkan rapat tanpa vokal tambahan.'],
    ['island', '/ˈaɪ.lənd/', 'pulau', 'The ferry leaves for the island at dawn.', 'Huruf "s" tidak dibunyikan: AI-lənd.'],
    ['receipt', '/rɪˈsiːt/', 'tanda terima', 'Keep the receipt in case you need a refund.', 'Huruf "p" tidak dibunyikan: ri-SEET.'],
  ],
  intermediate: [
    ['entrepreneur', '/ˌɒn.trə.prəˈnɜː/', 'wirausaha', 'The young entrepreneur opened a repair shop.', 'Empat suku kata dengan tekanan di akhir: on-truh-pruh-NUR.'],
    ['photography', '/fəˈtɒɡ.rə.fi/', 'fotografi', 'Her photography project documents the old market.', 'Tekanan di suku kedua: fuh-TOG-ruh-fee, bukan FO-to-gra-fi.'],
    ['development', '/dɪˈvel.əp.mənt/', 'perkembangan', 'The report tracks the development of the new campus.', 'Empat suku kata: di-VEL-up-muhnt. Jangan tambahkan vokal antara /p/ dan /m/.'],
    ['phenomenon', '/fəˈnɒm.ɪ.nən/', 'fenomena', 'The survey describes a phenomenon that appears every rainy season.', 'Awali dengan schwa: fuh-NOM-i-nun.'],
    ['particularly', '/pəˈtɪk.jə.lə.li/', 'terutama', 'The second question is particularly difficult.', 'Lima suku kata dengan dua schwa: puh-TIK-yuh-luh-lee.'],
    ['opportunity', '/ˌɒp.əˈtjuː.nə.ti/', 'kesempatan', 'The exchange programme offers a rare opportunity.', 'Tekanan di suku ketiga: op-uh-TYOO-nuh-tee.'],
    ['environment', '/ɪnˈvaɪ.rən.mənt/', 'lingkungan', 'The school reduced plastic waste to protect the environment.', 'Empat suku kata: in-VY-run-muhnt, bukan "en-vi-ron-ment".'],
    ['analysis', '/əˈnæl.ə.sɪs/', 'analisis', 'The analysis shows a steady rise in reading time.', 'Tekanan di suku kedua dan akhiran /sɪs/: uh-NAL-uh-sis.'],
    ['architecture', '/ˈɑː.kɪ.tek.tʃə/', 'arsitektur', 'The library architecture keeps the rooms cool.', 'Bunyi /k/ di suku kedua, bukan /tʃ/: AA-ki-tek-chuh.'],
    ['pronunciation', '/prəˌnʌn.siˈeɪ.ʃən/', 'pelafalan', 'Regular practice improves pronunciation more than memorising rules.', 'Tidak ada "pronoun": pruh-nun-see-AY-shun.'],
  ],
  advanced: [
    ['conscientious', '/ˌkɒn.ʃiˈen.ʃəs/', 'teliti dan berhati-hati', 'A conscientious editor checks every citation.', 'Lima suku kata dengan dua bunyi /ʃ/: kon-shee-EN-shus.'],
    ['simultaneously', '/ˌsɪm.əlˈteɪ.ni.əs.li/', 'secara bersamaan', 'The two experiments ran simultaneously.', 'Enam suku kata dengan tekanan di suku keempat: si-mul-TAY-nee-us-lee.'],
    ['unprecedented', '/ʌnˈpres.ɪ.den.tɪd/', 'belum pernah terjadi', 'The city recorded unprecedented rainfall this year.', 'Lima suku kata: un-PRES-i-den-tid, tanpa vokal tambahan di tengah.'],
    ['infrastructure', '/ˈɪn.frə.strʌk.tʃə/', 'infrastruktur', 'The region needs better transport infrastructure.', 'Gugus /nfr/ dan /str/ diucapkan tanpa vokal sisipan: IN-fruh-struk-chuh.'],
    ['mischievous', '/ˈmɪs.tʃɪ.vəs/', 'nakal', 'The mischievous narrator hides the truth until the last page.', 'Tiga suku kata: MIS-chi-vus, bukan "mis-CHEE-vee-us".'],
    ['inevitable', '/ɪˈnev.ɪ.tə.bəl/', 'tak terhindarkan', 'Some delay was inevitable after the storm.', 'Empat suku kata dengan tekanan di suku kedua: i-NEV-i-tuh-bul.'],
    ['jurisdiction', '/ˌdʒʊə.rɪsˈdɪk.ʃən/', 'yurisdiksi', 'The case falls outside the local court jurisdiction.', 'Empat suku kata dengan tekanan di suku ketiga: joo-ris-DIK-shun.'],
    ['rural', '/ˈrʊə.rəl/', 'pedesaan', 'The clinic serves several rural districts.', 'Dua bunyi /r/ dengan vokal /ʊə/: ROO-uhl, bukan "ru-ral".'],
    ['statistics', '/stəˈtɪs.tɪks/', 'statistik', 'The statistics confirm the trend across three years.', 'Awali dengan gugus /st/ dan beri tekanan di suku kedua: stuh-TIS-tiks.'],
    ['unequivocal', '/ˌʌn.ɪˈkwɪv.ə.kəl/', 'tidak ambigu', 'The committee gave an unequivocal answer.', 'Lima suku kata: un-i-KWIV-uh-kul, dengan /kw/ yang jelas.'],
  ],
}

function slugify(word) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

function pcmToWav(pcm, sampleRate, channels, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8
  const buffer = Buffer.alloc(44 + pcm.length)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + pcm.length, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * blockAlign, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(pcm.length, 40)
  pcm.copy(buffer, 44)
  return buffer
}

function toPlayableAudio(inlineData) {
  const mimeType = typeof inlineData?.mimeType === 'string' ? inlineData.mimeType : ''
  const data = typeof inlineData?.data === 'string' ? inlineData.data : ''
  if (!data) throw new Error('TTS returned no audio')
  const bytes = Buffer.from(data, 'base64')
  if (/audio\/(wav|x-wav|wave|mpeg|mp3|ogg)/i.test(mimeType)) return { bytes, extension: mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'wav' }
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1]) || 24_000
  const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1]) || 1
  return { bytes: pcmToWav(bytes, rate, channels), extension: 'wav' }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const TTS_MODELS = [...new Set([
  process.env.AI_TTS_MODEL_ID_1,
  process.env.AI_TTS_MODEL_ID_2,
  process.env.AI_TTS_MODEL_ID_3,
  process.env.AI_TTS_MODEL_ID,
].filter(Boolean))]
const TTS_KEYS = [...new Set([process.env.AI_TTS_API_KEY, process.env.AI_TTS_API_KEY_2].filter(Boolean))]
const TTS_BASE_URL = (process.env.AI_TTS_BASE_URL ?? 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
const TTS_VOICE = process.env.AI_TTS_VOICE_NAME ?? 'Kore'

// The speech endpoint throttles bursts per model and key, so a throttled pair
// cools down while the next pair takes the word. The bank is rendered once, so
// patience here is cheaper than a missing recording in the demo.
const REQUEST_GAP_MS = 1_500
const cooldownUntil = new Map()

function pairId(modelId, apiKey) {
  return `${modelId}:${apiKey.slice(-6)}`
}

async function synthesizeOnce(word, modelId, apiKey) {
  const response = await fetch(`${TTS_BASE_URL}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: word }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    }),
  })
  if (!response.ok) {
    const error = new Error(`TTS rejected "${word}" with status ${response.status}`)
    error.status = response.status
    throw error
  }
  const payload = await response.json()
  const parts = payload?.candidates?.[0]?.content?.parts
  const inlineData = Array.isArray(parts) ? parts.map((part) => part?.inlineData).find(Boolean) : undefined
  return toPlayableAudio(inlineData)
}

async function synthesize(word) {
  if (TTS_MODELS.length === 0 || TTS_KEYS.length === 0) {
    throw new Error('AI_TTS_API_KEY and a TTS model id are required to render the audio bank')
  }
  const pairs = TTS_MODELS.flatMap((modelId) => TTS_KEYS.map((apiKey) => ({ modelId, apiKey })))

  for (let round = 0; round < 10; round += 1) {
    for (const pair of pairs) {
      const id = pairId(pair.modelId, pair.apiKey)
      if (Date.now() < (cooldownUntil.get(id) ?? 0)) continue
      try {
        return await synthesizeOnce(word, pair.modelId, pair.apiKey)
      } catch (error) {
        if (error.status === 429) {
          cooldownUntil.set(id, Date.now() + 30_000)
          continue
        }
        if (error.status >= 500) {
          cooldownUntil.set(id, Date.now() + 15_000)
          continue
        }
        // A rejected key or an unknown model never recovers within this run.
        if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404) {
          console.warn(`disabling ${pair.modelId} with key …${pair.apiKey.slice(-4)}: ${error.message}`)
          cooldownUntil.set(id, Date.now() + 3_600_000)
          continue
        }
        throw error
      }
    }
    const soonest = Math.min(...pairs.map((pair) => cooldownUntil.get(pairId(pair.modelId, pair.apiKey)) ?? 0))
    if (soonest - Date.now() > 300_000) break
    const wait = Math.max(5_000, Math.min(soonest - Date.now(), 60_000))
    console.warn(`every TTS pair is cooling down; waiting ${wait}ms for "${word}"`)
    await sleep(wait)
  }
  throw new Error(`TTS kept rejecting "${word}"`)
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  }),
})
const db = getFirestore(app)
const now = Timestamp.now()

mkdirSync(AUDIO_DIR, { recursive: true })

const publishedIds = new Set()
const missingAudio = []
let rendered = 0
let reused = 0

for (const [level, entries] of Object.entries(BANK)) {
  for (const [index, [word, ipa, meaning, example, tip]] of entries.entries()) {
    const slug = slugify(word)
    const id = `pronunciation-${level}-${slug}`
    publishedIds.add(id)

    const filename = `${slug}.wav`
    const fileUrl = new URL(filename, AUDIO_DIR)
    if (FORCE_AUDIO || !existsSync(fileUrl)) {
      try {
        const audio = await synthesize(word)
        writeFileSync(fileUrl, audio.bytes)
        rendered += 1
        console.log(`rendered ${level}/${word} (${audio.bytes.length} bytes)`)
      } catch (error) {
        missingAudio.push(`${level}/${word}`)
        console.warn(`audio failed for ${level}/${word}: ${error.message}`)
      }
      await sleep(REQUEST_GAP_MS)
    } else {
      reused += 1
    }

    const reference = db.collection('questionBank').doc(id)
    const existing = await reference.get()
    const document = {
      contentType: 'pronunciation',
      skill: 'pronunciation',
      level,
      prompt: `Ucapkan kata "${word}" dengan jelas.`,
      options: [],
      explanation: tip,
      tags: ['pronunciation', level, 'ielts'],
      word,
      meaning,
      example,
      ipa,
      tip,
      audioText: word,
      status: 'published',
      order: index,
      createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
      updatedAt: now,
    }
    if (existsSync(fileUrl)) document.audioUrl = `${AUDIO_PUBLIC_PATH}/${filename}`
    await reference.set(document, { merge: true })
  }
}

// Older pronunciation drafts would otherwise keep the bank above ten per level.
const existingPronunciation = await db.collection('questionBank').where('contentType', '==', 'pronunciation').get()
let archived = 0
for (const doc of existingPronunciation.docs) {
  if (publishedIds.has(doc.id)) continue
  if (doc.data().status === 'draft') continue
  await doc.ref.set({ status: 'draft', updatedAt: now }, { merge: true })
  archived += 1
}

console.log(`published ${publishedIds.size} pronunciation words (${rendered} audio rendered, ${reused} reused, ${archived} archived)`)
if (missingAudio.length > 0) {
  console.warn(`missing audio for ${missingAudio.length} words: ${missingAudio.join(', ')}`)
  console.warn('re-run the script to render the remaining recordings')
}
