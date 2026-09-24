import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

function loadLocalEnv() {
  try {
    const source = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].replace(/^"|"$/g, '').replace(/\\n/g, '\n')
    }
  } catch {
    // CI supplies Firebase Admin variables directly.
  }
}

loadLocalEnv()
const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  }),
})
const db = getFirestore(app)
const now = Timestamp.now()
const target = 50

const words = [
  ['curious', 'ingin tahu'], ['improve', 'meningkatkan'], ['journey', 'perjalanan'], ['helpful', 'membantu'],
  ['accurate', 'akurat'], ['flexible', 'fleksibel'], ['observe', 'mengamati'], ['persuade', 'membujuk'],
  ['articulate', 'mengungkapkan dengan jelas'], ['coherent', 'koheren'], ['subtle', 'halus'], ['sustain', 'mempertahankan'],
  ['adapt', 'menyesuaikan'], ['benefit', 'manfaat'], ['challenge', 'tantangan'], ['confident', 'percaya diri'],
  ['contrast', 'perbedaan'], ['discover', 'menemukan'], ['efficient', 'efisien'], ['essential', 'penting'],
  ['familiar', 'akrab'], ['frequent', 'sering'], ['generous', 'dermawan'], ['hesitate', 'ragu-ragu'],
  ['identify', 'mengidentifikasi'], ['maintain', 'mempertahankan'], ['notice', 'memperhatikan'], ['opportunity', 'kesempatan'],
  ['patient', 'sabar'], ['practical', 'praktis'], ['relevant', 'relevan'], ['responsible', 'bertanggung jawab'],
  ['significant', 'signifikan'], ['specific', 'spesifik'], ['strategy', 'strategi'], ['sufficient', 'cukup'],
  ['tolerate', 'menoleransi'], ['transfer', 'memindahkan'], ['valuable', 'berharga'], ['accomplish', 'menyelesaikan'],
  ['alternative', 'alternatif'], ['clarify', 'memperjelas'], ['contribute', 'berkontribusi'], ['demonstrate', 'menunjukkan'],
  ['evaluate', 'mengevaluasi'], ['generate', 'menghasilkan'], ['implement', 'menerapkan'], ['justify', 'membenarkan'],
  ['negotiate', 'bernegosiasi'], ['prioritize', 'memprioritaskan'], ['reflect', 'merefleksikan'], ['transform', 'mengubah'],
]

const pronunciationWords = [
  'thought', 'world', 'vegetable', 'schedule', 'comfortable', 'entrepreneur', 'particularly', 'responsibility',
  'architecture', 'availability', 'beautiful', 'colleague', 'development', 'environment', 'February', 'government',
  'knowledge', 'language', 'literature', 'opportunity', 'photography', 'professional', 'recommendation', 'relationship',
  'successful', 'technology', 'university', 'usually', 'weather', 'Wednesday', 'achievement', 'analysis',
  'communication', 'community', 'confidence', 'conversation', 'creativity', 'difference', 'education', 'experience',
  'expression', 'familiar', 'international', 'interesting', 'motivation', 'organization', 'performance', 'presentation',
  'pronunciation', 'understanding',
]

const speakingTopics = [
  'Describe your morning routine.', 'Explain one habit you want to improve.', 'Tell a story about a useful journey.',
  'Describe a person who inspires you.', 'Explain how you prepare for an exam.', 'Talk about your favorite school subject.',
  'Describe a memorable meal.', 'Explain a difficult choice you made.', 'Compare studying alone and with friends.',
  'Describe a place you would like to visit.', 'Explain how technology helps students.', 'Talk about a skill you want to learn.',
  'Describe your ideal classroom.', 'Explain a time you solved a problem.', 'Talk about a book that changed your view.',
  'Describe a community activity.', 'Explain how to stay healthy at school.', 'Talk about a successful project.',
  'Describe your weekend plans.', 'Explain why teamwork matters.', 'Talk about a person you admire.',
  'Describe a useful app.', 'Explain how you manage your time.', 'Talk about a local tradition.',
  'Describe a challenge and its solution.', 'Explain the value of honest feedback.', 'Talk about your future career.',
  'Describe a surprising experience.', 'Explain how to make a good presentation.', 'Talk about learning from mistakes.',
  'Describe an environmentally friendly habit.', 'Explain what makes a good leader.', 'Talk about a goal for this year.',
  'Describe a change in your neighborhood.', 'Explain how music affects your mood.', 'Talk about a team achievement.',
  'Describe a useful conversation.', 'Explain how you choose reliable information.', 'Talk about a cultural celebration.',
  'Describe your ideal study space.', 'Explain how to welcome a new student.', 'Talk about a decision you would change.',
  'Describe a service that helps your community.', 'Explain why clear instructions matter.', 'Talk about a personal strength.',
  'Describe a goal that requires patience.', 'Explain how to resolve a disagreement.', 'Talk about a future invention.',
  'Describe an experience that built confidence.', 'Explain how practice changes performance.',
]

const conversations = [
  'Introduce yourself to a new classmate.', 'Order a meal politely.', 'Ask for directions at an airport.',
  'Return a library book and ask about a new title.', 'Invite a friend to a study group.', 'Ask a teacher for clarification.',
  'Make an appointment at a clinic.', 'Buy a ticket at a train station.', 'Discuss a project deadline with a teammate.',
  'Ask a shop assistant about a product.', 'Welcome an exchange student.', 'Report a missing item at a hotel.',
  'Plan a weekend activity with a friend.', 'Explain a late arrival to a teacher.', 'Give advice to a nervous speaker.',
  'Ask a neighbor about a community event.', 'Discuss screen-time rules with a parent.', 'Request feedback after a presentation.',
  'Solve a booking problem by phone.', 'Explain a food preference at a restaurant.', 'Join a school club.',
  'Ask a colleague to repeat an instruction.', 'Discuss roles in a group assignment.', 'Offer help to a visitor.',
  'Explain how to use a classroom device.', 'Talk with a librarian about research sources.', 'Ask for a refund politely.',
  'Plan transportation for a school trip.', 'Discuss a change to a meeting.', 'Respond to a customer question.',
  'Ask a friend about a new hobby.', 'Explain a simple process to a younger student.', 'Share an opinion in a classroom discussion.',
  'Resolve a misunderstanding with a teammate.', 'Ask a coach about practice times.', 'Discuss a healthy lunch choice.',
  'Make a polite suggestion to a group.', 'Explain a technical problem to support staff.', 'Ask a guide about a museum exhibit.',
  'Discuss study strategies before a test.', 'Introduce a guest speaker.', 'Ask for permission to borrow equipment.',
  'Explain a change in travel plans.', 'Offer directions around school.', 'Talk about plans after graduation.',
  'Ask a teammate to share notes.', 'Discuss how to improve a project.', 'Respond to an invitation.',
  'Ask a teacher about extra practice.', 'Close a conversation professionally.',
]

const tests = [
  'Placement test: present simple and daily routines.', 'Placement test: past events and time expressions.',
  'Placement test: articles and countable nouns.', 'Placement test: comparative adjectives.', 'Placement test: prepositions of place.',
  'Diagnostic test: present continuous.', 'Diagnostic test: future plans.', 'Diagnostic test: first conditional.',
  'Diagnostic test: present perfect.', 'Diagnostic test: passive voice.', 'Diagnostic test: reported speech.',
  'Diagnostic test: modal verbs.', 'Diagnostic test: relative clauses.', 'Diagnostic test: linking words.',
  'Diagnostic test: academic vocabulary.', 'Diagnostic test: reading for detail.', 'Diagnostic test: identifying purpose.',
  'Diagnostic test: recognizing contrast.', 'Diagnostic test: making an inference.', 'Diagnostic test: summarizing a paragraph.',
  'Practice test: classroom conversations.', 'Practice test: asking for clarification.', 'Practice test: giving directions.',
  'Practice test: ordering food.', 'Practice test: making suggestions.', 'Practice test: agreeing and disagreeing.',
  'Practice test: describing a process.', 'Practice test: explaining a reason.', 'Practice test: comparing options.',
  'Practice test: describing a problem.', 'Monthly test: grammar accuracy.', 'Monthly test: vocabulary in context.',
  'Monthly test: reading comprehension.', 'Monthly test: listening comprehension.', 'Monthly test: speaking confidence.',
  'Monthly test: pronunciation awareness.', 'Monthly test: fluency strategies.', 'Monthly test: intonation choices.',
  'Monthly test: interaction strategies.', 'Monthly test: repair strategies.', 'Review test: school life.',
  'Review test: technology and learning.', 'Review test: health and habits.', 'Review test: travel and culture.',
  'Review test: environment and community.', 'Review test: work and careers.', 'Review test: media literacy.',
  'Review test: problem solving.', 'Review test: collaboration.', 'Certification test: integrated English skills.',
]

const grammarItems = [
  ['grammar', 'beginner', 'My parents ___ dinner at six.', ['cook', 'cooks', 'cooking', 'cooked'], 0],
  ['grammar', 'beginner', 'He ___ his homework every afternoon.', ['do', 'does', 'doing', 'did'], 1],
  ['grammar', 'beginner', 'We ___ at home last night.', ['stay', 'stays', 'stayed', 'staying'], 2],
  ['grammar', 'beginner', 'The children ___ playing outside.', ['is', 'am', 'are', 'be'], 2],
  ['grammar', 'beginner', 'I have ___ orange in my bag.', ['a', 'an', 'thee', 'any'], 1],
  ['grammar', 'beginner', 'The book is ___ the desk.', ['on', 'at', 'to', 'by'], 0],
  ['grammar', 'beginner', 'This road is ___ than that road.', ['wide', 'wider', 'widest', 'more wide'], 1],
  ['grammar', 'beginner', 'She ___ speak three languages.', ['can', 'cans', 'coulds', 'is can'], 0],
  ['grammar', 'intermediate', 'They ___ finished the project.', ['has', 'have', 'having', 'is'], 1],
  ['grammar', 'intermediate', 'We will leave when the bus ___.', ['arrive', 'arrives', 'arrived', 'arriving'], 1],
  ['grammar', 'intermediate', 'The letter ___ yesterday.', ['sent', 'was sent', 'is sending', 'has send'], 1],
  ['grammar', 'intermediate', 'She is interested ___ science.', ['on', 'at', 'in', 'to'], 2],
  ['grammar', 'intermediate', 'I have known him ___ five years.', ['since', 'for', 'during', 'from'], 1],
  ['grammar', 'intermediate', 'If it rains, we ___ inside.', ['stay', 'will stay', 'stayed', 'staying'], 1],
  ['grammar', 'intermediate', 'The student ___ won the prize is my friend.', ['which', 'who', 'where', 'when'], 1],
  ['grammar', 'advanced', 'By next year, she ___ graduated.', ['will have', 'has', 'will', 'is'], 0],
  ['grammar', 'advanced', 'The report suggests that costs ___.', ['decrease', 'decreases', 'decreased', 'decreasing'], 0],
  ['grammar', 'advanced', 'Had I known, I ___ earlier.', ['leave', 'would leave', 'would have left', 'left'], 2],
  ['grammar', 'advanced', 'The proposal, ___ was approved yesterday, starts in June.', ['who', 'which', 'where', 'what'], 1],
  ['grammar', 'advanced', 'It is essential that every student ___ prepared.', ['is', 'be', 'being', 'was'], 1],
]

function levelFor(index) {
  return index < 17 ? 'beginner' : index < 34 ? 'intermediate' : 'advanced'
}

function questionDocument(id, data) {
  return { ...data, id, status: 'published', tags: data.tags ?? [data.contentType, data.level], createdAt: now, updatedAt: now }
}

async function existingCount(contentType) {
  const snapshot = await db.collection('questionBank').where('contentType', '==', contentType).get()
  return snapshot.size
}

const documents = []
const counts = {}
for (const type of ['question', 'vocabulary', 'listening', 'pronunciation', 'speaking', 'conversation', 'test']) {
  counts[type] = await existingCount(type)
}

for (let index = counts.question; index < target; index += 1) {
  const [skill, level, prompt, options, correctOption] = grammarItems[index % grammarItems.length]
  documents.push(questionDocument(`question-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'question', skill, level, prompt, options, correctOption, explanation: `The correct answer is “${options[correctOption]}”.` }))
}
for (let index = counts.vocabulary; index < target; index += 1) {
  const [word, meaning] = words[index % words.length]
  documents.push(questionDocument(`vocabulary-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'vocabulary', skill: 'vocabulary', level: levelFor(index), word, meaning, example: `The word “${word}” is useful in everyday English.`, ipa: `/${word}/`, tip: `Say “${word}” clearly, then use it in a sentence.`, prompt: `Review the word ${word}.`, options: ['mastered'], correctOption: 0, explanation: meaning }))
}
for (let index = counts.listening; index < target; index += 1) {
  const topic = conversations[index % conversations.length]
  documents.push(questionDocument(`listening-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'listening', skill: 'listening', level: levelFor(index), prompt: `Listen to a conversation about: ${topic}`, options: ['The speakers discuss this situation.', 'The speakers discuss a different situation.', 'The speakers do not speak.', 'The speakers change the topic.'], correctOption: 0, explanation: 'The audio introduces the situation described in the prompt.', audioText: `In this conversation, the speakers ${topic.toLowerCase()}.`, tags: ['listening', levelFor(index)] }))
}
for (let index = counts.pronunciation; index < target; index += 1) {
  const word = pronunciationWords[index % pronunciationWords.length]
  documents.push(questionDocument(`pronunciation-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'pronunciation', skill: 'pronunciation', level: levelFor(index), word, ipa: `/${word}/`, tip: `Say ${word} slowly first, then at a natural speaking pace.`, prompt: `Practice pronouncing ${word}.`, options: ['recorded'], correctOption: 0, explanation: 'This practice records metadata only until a pronunciation provider is configured.' }))
}
for (let index = counts.speaking; index < target; index += 1) {
  const prompt = speakingTopics[index % speakingTopics.length]
  documents.push(questionDocument(`speaking-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'speaking', skill: 'speaking', level: levelFor(index), word: prompt.slice(0, 40), prompt, options: [], explanation: '', tags: ['speaking', levelFor(index)] }))
}
for (let index = counts.conversation; index < target; index += 1) {
  const prompt = conversations[index % conversations.length]
  documents.push(questionDocument(`conversation-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'conversation', skill: 'speaking', level: levelFor(index), word: prompt.slice(0, 40), prompt: `Practice this conversation: ${prompt}`, options: [], explanation: '', tags: ['conversation', levelFor(index)] }))
}
for (let index = counts.test; index < target; index += 1) {
  const prompt = tests[index % tests.length]
  documents.push(questionDocument(`test-expanded-${String(index + 1).padStart(3, '0')}`, { contentType: 'test', skill: 'grammar', level: levelFor(index), word: prompt.slice(0, 40), prompt, options: ['The first answer', 'The second answer', 'The third answer', 'The fourth answer'], correctOption: 0, explanation: 'The first answer is correct for this authored test item.', tags: ['test', levelFor(index)] }))
}

const batch = db.batch()
for (const document of documents) {
  const { id, ...data } = document
  batch.create(db.collection('questionBank').doc(id), data)
}

if (documents.length > 0) await batch.commit()
console.log(JSON.stringify({ before: counts, added: documents.length, target }, null, 2))
