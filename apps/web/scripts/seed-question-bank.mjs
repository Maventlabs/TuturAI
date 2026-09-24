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
    // CI can provide the Firebase admin variables directly.
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

const questions = [
  ['grammar', 'beginner', 'She ___ breakfast at seven every morning.', ['eat', 'eats', 'eating', 'eaten'], 1, 'Use the third-person singular form, “eats”.'],
  ['grammar', 'beginner', 'They ___ to the library after class.', ['goes', 'going', 'go', 'gone'], 2, 'The subject “they” takes the base verb “go”.'],
  ['grammar', 'beginner', 'I ___ a new notebook yesterday.', ['buy', 'bought', 'buys', 'buying'], 1, '“Yesterday” signals the simple past: “bought”.'],
  ['grammar', 'beginner', 'There ___ two books on the table.', ['is', 'are', 'be', 'was'], 1, 'Use “are” with the plural noun “books”.'],
  ['grammar', 'beginner', 'We ___ watching a film right now.', ['am', 'is', 'are', 'be'], 2, 'The subject “we” takes “are” in the present continuous.'],
  ['grammar', 'beginner', 'Choose the correct article: ___ apple.', ['a', 'an', 'thee', 'no article'], 1, 'Use “an” before a vowel sound.'],
  ['grammar', 'beginner', 'My sister is ___ than me.', ['tall', 'taller', 'tallest', 'more tall'], 1, 'Use the comparative form “taller” for two people.'],
  ['grammar', 'beginner', 'Please put the bag ___ the chair.', ['in', 'on', 'at', 'to'], 1, '“On” describes a position above and touching a surface.'],
  ['grammar', 'intermediate', 'If I have time, I ___ you tonight.', ['call', 'will call', 'called', 'calling'], 1, 'The first conditional uses “will” in the result clause.'],
  ['grammar', 'intermediate', 'She has lived here ___ 2021.', ['for', 'since', 'during', 'at'], 1, 'Use “since” with a starting point in time.'],
  ['grammar', 'intermediate', 'The homework ___ by the students yesterday.', ['completed', 'was completed', 'is completing', 'has complete'], 1, 'This is a passive sentence in the simple past.'],
  ['grammar', 'intermediate', 'I wish I ___ more confident when speaking.', ['am', 'were', 'will be', 'have been'], 1, '“I wish I were” describes an unreal present situation.'],
  ['vocabulary', 'beginner', 'What is the closest meaning of “rapid”?', ['slow', 'quick', 'quiet', 'heavy'], 1, '“Rapid” means very fast or quick.'],
  ['vocabulary', 'beginner', 'What is the opposite of “ancient”?', ['old', 'modern', 'historic', 'rare'], 1, '“Modern” is the opposite of “ancient”.'],
  ['vocabulary', 'beginner', 'A person who designs buildings is an ___.', ['artist', 'architect', 'athlete', 'accountant'], 1, 'An architect designs buildings.'],
  ['vocabulary', 'beginner', 'Which word means “to begin”?', ['finish', 'start', 'forget', 'borrow'], 1, '“Start” means to begin.'],
  ['vocabulary', 'beginner', 'If a room is “spacious”, it is ___.', ['very small', 'full of noise', 'large and comfortable', 'far away'], 2, 'A spacious room has plenty of space.'],
  ['vocabulary', 'intermediate', 'The word “reliable” describes something that is ___.', ['easy to break', 'consistently dependable', 'very expensive', 'hard to see'], 1, 'Reliable things can be trusted to work well.'],
  ['vocabulary', 'intermediate', 'To “postpone” a meeting means to ___.', ['cancel it forever', 'move it to a later time', 'start it early', 'record it'], 1, 'Postpone means delay until later.'],
  ['vocabulary', 'intermediate', 'A “concise” explanation is ___.', ['short and clear', 'long and confusing', 'very emotional', 'written in code'], 0, 'Concise writing communicates clearly with few words.'],
  ['vocabulary', 'advanced', 'If evidence is “compelling”, it is ___.', ['persuasive', 'missing', 'ordinary', 'unrelated'], 0, 'Compelling evidence is persuasive and convincing.'],
  ['vocabulary', 'advanced', 'To “mitigate” a problem means to ___.', ['make it worse', 'reduce its severity', 'hide it permanently', 'repeat it'], 1, 'Mitigate means make something less severe.'],
  ['reading', 'beginner', 'Mia takes an umbrella because the sky is dark. Why does she take it?', ['She is going swimming.', 'She expects rain.', 'She lost her bag.', 'She is going to sleep.'], 1, 'The dark sky suggests that Mia expects rain.'],
  ['reading', 'beginner', 'Rafi missed the bus, so he walked to school. How did Rafi get to school?', ['By bus', 'By train', 'On foot', 'By bicycle'], 2, 'Walking means going on foot.'],
  ['reading', 'beginner', 'The museum opens at nine and closes at four. When can visitors enter?', ['At eight', 'At nine', 'At five', 'At six'], 1, 'Visitors can enter from the opening time, nine o’clock.'],
  ['reading', 'intermediate', 'The club planted trees near the river to reduce soil erosion. What was the purpose?', ['To create a parking lot', 'To reduce soil erosion', 'To make the river deeper', 'To attract fish'], 1, 'The sentence directly states the purpose.'],
  ['reading', 'intermediate', 'Although the laptop was inexpensive, it performed well. What contrast is expressed?', ['The laptop was expensive and slow.', 'The laptop was cheap but worked well.', 'The laptop was broken.', 'The laptop was unavailable.'], 1, '“Although” introduces the contrast between price and performance.'],
  ['reading', 'intermediate', 'Nadia reviewed her notes before the presentation, so she felt prepared. Why did she feel prepared?', ['She skipped the presentation.', 'She reviewed her notes.', 'She arrived late.', 'She forgot the topic.'], 1, 'Reviewing notes helped Nadia prepare.'],
  ['reading', 'advanced', 'The library extended its opening hours during exams to accommodate students. What does “accommodate” mean here?', ['To support their needs', 'To remove their books', 'To grade their tests', 'To close early'], 0, 'Accommodate means provide what someone needs.'],
  ['reading', 'advanced', 'The report recommends gradual changes rather than an immediate overhaul. What approach does it support?', ['A complete change at once', 'Small changes over time', 'No change at all', 'A change without planning'], 1, 'Gradual changes happen in stages over time.'],
]

const batch = db.batch()
const now = Timestamp.now()
for (let index = 0; index < questions.length; index += 1) {
  const [skill, level, prompt, options, correctOption, explanation] = questions[index]
  const id = `${skill}-${level}-${String(index + 1).padStart(3, '0')}`
  const reference = db.collection('questionBank').doc(id)
  batch.set(reference, {
    contentType: 'question',
    skill,
    level,
    prompt,
    options,
    correctOption,
    explanation,
    tags: [skill, level],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
}

const cards = [
  ['vocabulary', 'beginner', 'curious', 'ingin tahu', 'She was curious about the new library.', '/ˈkjʊr.i.əs/', 'Keep the first syllable clear.'],
  ['vocabulary', 'beginner', 'improve', 'meningkatkan', 'Daily practice can improve your fluency.', '/ɪmˈpruːv/', 'Stress the second syllable.'],
  ['vocabulary', 'beginner', 'journey', 'perjalanan', 'The journey took three hours.', '/ˈdʒɜːr.ni/', 'The “jour” sound is like “jer”.'],
  ['vocabulary', 'beginner', 'helpful', 'membantu', 'Her feedback was helpful.', '/ˈhelp.fəl/', 'Make the final syllable short.'],
  ['vocabulary', 'intermediate', 'accurate', 'akurat', 'The transcript is accurate.', '/ˈæk.jər.ət/', 'Do not drop the middle syllable.'],
  ['vocabulary', 'intermediate', 'flexible', 'fleksibel', 'A flexible plan is easier to adapt.', '/ˈflek.sə.bəl/', 'Stress the first syllable.'],
  ['vocabulary', 'intermediate', 'observe', 'mengamati', 'Students observe the experiment carefully.', '/əbˈzɜːrv/', 'Stress the second syllable.'],
  ['vocabulary', 'intermediate', 'persuade', 'membujuk', 'She tried to persuade her friend.', '/pərˈsweɪd/', 'The ending sounds like “swade”.'],
  ['vocabulary', 'advanced', 'articulate', 'mengungkapkan dengan jelas', 'He can articulate complex ideas clearly.', '/ɑːrˈtɪk.jə.leɪt/', 'Keep each syllable distinct.'],
  ['vocabulary', 'advanced', 'coherent', 'koheren', 'Her argument was coherent and convincing.', '/koʊˈhɪr.ənt/', 'Stress the second syllable.'],
  ['vocabulary', 'advanced', 'subtle', 'halus', 'There was a subtle change in tone.', '/ˈsʌt.əl/', 'The “b” is silent.'],
  ['vocabulary', 'advanced', 'sustain', 'mempertahankan', 'The team must sustain its progress.', '/səˈsteɪn/', 'Stress the second syllable.'],
]
for (let index = 0; index < cards.length; index += 1) {
  const [skill, level, word, meaning, example, ipa, tip] = cards[index]
  const reference = db.collection('questionBank').doc(`vocabulary-card-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'vocabulary', skill, level, word, meaning, example, ipa, tip, tags: [skill, level], status: 'published', createdAt: now, updatedAt: now, options: ['mastered'], correctOption: 0, prompt: `Review the word ${word}.`, explanation: meaning })
}

const listening = [
  ['A student asks for directions to the science lab.', ['Find the science lab', 'Buy a ticket', 'Order lunch', 'Call a taxi'], 0, 'The speaker is asking for directions.', 'Could you tell me how to get to the science lab?'],
  ['A teacher announces a change to tomorrow’s class.', ['The class is cancelled', 'The room has changed', 'The test is finished', 'The school is closed'], 1, 'The announcement says the room has changed.', 'Tomorrow’s class will be in room 204 instead.'],
  ['Two friends discuss a weekend activity.', ['They will visit a museum', 'They will study at home', 'They will play tennis', 'They will travel abroad'], 2, 'They decide to play tennis.', 'The weather is perfect for tennis this weekend.'],
  ['A customer reports a missing item in a delivery.', ['A missing notebook', 'A broken phone', 'A late train', 'A wrong address'], 0, 'The customer says the notebook is missing.', 'The package arrived, but the blue notebook was not inside.'],
  ['A manager explains why a meeting is delayed.', ['The projector is broken', 'The manager is sick', 'The client is early', 'The office moved'], 0, 'The delay is caused by a projector problem.', 'We need ten more minutes because the projector is not working.'],
  ['A speaker describes a new study habit.', ['Reviewing before bed', 'Skipping homework', 'Reading only headlines', 'Studying once a month'], 0, 'The speaker reviews material before bed.', 'I review my vocabulary for fifteen minutes before I sleep.'],
  ['A guide explains the purpose of a community garden.', ['To sell cars', 'To grow food together', 'To build apartments', 'To teach swimming'], 1, 'The garden allows neighbors to grow food together.', 'Everyone in the neighborhood can grow vegetables here.'],
  ['A colleague summarizes the result of a project.', ['It missed every goal', 'It finished early', 'It was cancelled', 'It has not started'], 1, 'The project finished before the deadline.', 'We completed the project two days ahead of schedule.'],
]
for (let index = 0; index < listening.length; index += 1) {
  const [prompt, options, correctOption, explanation, audioText] = listening[index]
  const reference = db.collection('questionBank').doc(`listening-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'listening', skill: 'listening', level: index < 4 ? 'beginner' : 'intermediate', prompt, options, correctOption, explanation, audioText, tags: ['listening'], status: 'published', createdAt: now, updatedAt: now })
}

const pronunciation = [
  ['thought', '/θɔːt/', 'Let the air pass gently between your teeth.', 'The “th” is unvoiced.'],
  ['world', '/wɜːrld/', 'Keep the final consonants connected, not separated.', 'The “rld” cluster needs a smooth finish.'],
  ['vegetable', '/ˈvedʒ.tə.bəl/', 'Use three clear syllables in careful speech.', 'The middle syllable is short.'],
  ['schedule', '/ˈskedʒ.uːl/', 'Start with a clear “sk” sound.', 'Both common English pronunciations are acceptable.'],
  ['comfortable', '/ˈkʌm.fər.tə.bəl/', 'Keep the first syllable strong and the rest light.', 'Avoid stressing every syllable.'],
  ['entrepreneur', '/ˌɑːn.trə.prəˈnɜːr/', 'Place the strongest stress near the end.', 'The final stressed vowel should be clear.'],
  ['particularly', '/pərˈtɪk.jə.lər.li/', 'Break the word into four light parts.', 'Keep the “t” and “k” distinct.'],
  ['responsibility', '/rɪˌspɑːn.səˈbɪl.ə.ti/', 'Stress “bil” and keep the ending moving.', 'Do not over-stress the first syllable.'],
]
for (let index = 0; index < pronunciation.length; index += 1) {
  const [word, ipa, tip, explanation] = pronunciation[index]
  const reference = db.collection('questionBank').doc(`pronunciation-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'pronunciation', skill: 'pronunciation', level: index < 4 ? 'intermediate' : 'advanced', word, ipa, tip, prompt: `Practice pronouncing ${word}.`, options: ['recorded'], correctOption: 0, explanation, tags: ['pronunciation'], status: 'published', createdAt: now, updatedAt: now })
}

const speaking = [
  ['Daily routines', 'Describe your morning routine and explain one habit you want to improve.', 'beginner'],
  ['Travel plans', 'Tell the tutor about a trip you would like to take and how you would prepare.', 'beginner'],
  ['A memorable meal', 'Describe a memorable meal, including the place, people, and food.', 'intermediate'],
  ['Learning goals', 'Explain your English learning goals and the strategy you will use to reach them.', 'intermediate'],
  ['Technology and society', 'Discuss one benefit and one risk of using AI in education.', 'advanced'],
  ['A difficult decision', 'Describe a difficult decision and compare the options you considered.', 'advanced'],
]
for (let index = 0; index < speaking.length; index += 1) {
  const [word, prompt, level] = speaking[index]
  const reference = db.collection('questionBank').doc(`speaking-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'speaking', skill: 'speaking', level, word, prompt, options: [], explanation: '', tags: ['speaking', level], status: 'published', createdAt: now, updatedAt: now })
}

const conversations = [
  ['Job interview', 'Tell the tutor why you want to work for a company and mention one strength.', 'intermediate'],
  ['Ordering food', 'Order a meal politely and ask one question about the ingredients.', 'beginner'],
  ['At the airport', 'Explain your travel plans to an airport employee and ask for directions.', 'beginner'],
  ['Making friends', 'Introduce yourself and ask a new friend about their hobbies.', 'beginner'],
  ['A difficult decision', 'Explain a difficult decision and compare the options you considered.', 'advanced'],
  ['A classroom discussion', 'Give your opinion about using technology in the classroom and support it with a reason.', 'intermediate'],
]
for (let index = 0; index < conversations.length; index += 1) {
  const [word, prompt, level] = conversations[index]
  const reference = db.collection('questionBank').doc(`conversation-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'conversation', skill: 'speaking', level, word, prompt, options: [], explanation: '', tags: ['conversation', level], status: 'published', createdAt: now, updatedAt: now })
}

const tests = [
  ['Placement test', 'Answer a short mixed-skills assessment to establish your current CEFR starting point.', 'beginner'],
  ['Diagnostic skills test', 'Complete questions across pronunciation, grammar, vocabulary, fluency, confidence, and intonation.', 'intermediate'],
  ['Monthly summative test', 'Review your learning with a structured monthly assessment.', 'intermediate'],
  ['TuturAI certification', 'Complete the certification assessment after reaching the required level.', 'advanced'],
]
for (let index = 0; index < tests.length; index += 1) {
  const [word, prompt, level] = tests[index]
  const reference = db.collection('questionBank').doc(`test-${String(index + 1).padStart(3, '0')}`)
  batch.set(reference, { contentType: 'test', skill: 'grammar', level, word, prompt, options: ['The first answer', 'The second answer', 'The third answer', 'The fourth answer'], correctOption: 0, explanation: 'The first answer is correct for this authored test item.', tags: ['test', level], status: 'published', createdAt: now, updatedAt: now })
}

try {
  await batch.commit()
  console.log(`Seeded ${questions.length + cards.length + listening.length + pronunciation.length + speaking.length + conversations.length + tests.length} question bank items.`)
} catch (error) {
  if (error?.code === 6) {
    console.error('Question bank already contains one or more seed IDs; no documents were changed.')
  }
  throw error
}
