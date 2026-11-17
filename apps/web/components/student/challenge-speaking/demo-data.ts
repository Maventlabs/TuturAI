import type { MatchMode, Mission, Participant } from './types'

/**
 * Pass A ships the interface only. These missions and partners exist so the
 * lobby, mission card, and room states can be reviewed before the real-time
 * matchmaking service is wired in Pass B. Every surface that renders them is
 * labelled as a preview.
 */
export const DEMO_MISSIONS: Mission[] = [
  {
    type: 'Role-play',
    title: 'Borrowing a Book at the Library',
    topic: 'You need a book for a school project, but the only copy is already borrowed.',
    objective: 'Ask for help politely, explain your project, and agree on a solution with the librarian.',
    instructions: [
      'You are the student. Greet the librarian and explain what you need.',
      'Describe your project in two sentences.',
      'Ask what you can do if the book is unavailable.',
      'Thank the librarian and confirm the next step.',
    ],
    talkingPoints: [
      'Excuse me, could you help me find…',
      'I need it for a project about…',
      'Is there another copy available?',
      'When will it be returned?',
    ],
  },
  {
    type: 'Diskusi',
    title: 'Smartphones in the Classroom',
    topic: 'Should students be allowed to use smartphones during lessons?',
    objective: "Share your opinion with two reasons and respond to your partner's view.",
    instructions: [
      'State your opinion in one clear sentence.',
      'Give two reasons that support it.',
      'Ask your partner what they think.',
      'Respond politely to one point you disagree with.',
    ],
    talkingPoints: [
      'In my opinion…',
      'One reason is…',
      'I see your point, but…',
      'What do you think about…',
    ],
  },
  {
    type: 'Debat',
    title: 'Homework Should Be Optional',
    topic: 'Debate whether homework should be optional for senior high students.',
    objective: 'Defend one side with evidence and answer one argument from your partner.',
    instructions: [
      'Choose a side: agree or disagree.',
      'Present your first argument.',
      'Repeat your partner’s main point in your own words.',
      'Answer it with one counter-argument.',
    ],
    talkingPoints: [
      'I strongly believe…',
      'The main reason is…',
      'However, we should consider…',
      'That may be true, but…',
    ],
  },
  {
    type: 'Bercerita',
    title: 'The Day Everything Went Wrong',
    topic: 'Tell a short story about a day when several things went wrong.',
    objective: 'Tell a clear story with a beginning, a problem, and an ending.',
    instructions: [
      'Start with when and where it happened.',
      'Describe the first problem.',
      'Explain how you felt at that moment.',
      'End with how it was solved.',
    ],
    talkingPoints: ['It all started when…', 'Suddenly…', 'I felt really…', 'In the end…'],
  },
  {
    type: 'Pemecahan masalah',
    title: 'The Lost Field Trip',
    topic: 'Your group is separated from the class during a field trip and your phone battery is dead.',
    objective: 'Agree on a safe plan in three steps.',
    instructions: [
      'Describe the situation in one sentence.',
      'Suggest two possible actions.',
      'Agree on the safest option together.',
      'Summarise the plan before you finish.',
    ],
    talkingPoints: ['We should probably…', 'What if we…', 'That sounds safer because…', 'So our plan is…'],
  },
  {
    type: 'Tanya jawab',
    title: 'Getting to Know You',
    topic: 'Ask and answer questions about hobbies, school, and weekend plans.',
    objective: 'Ask at least four questions and answer in full sentences.',
    instructions: [
      'Start with a simple question about hobbies.',
      'Answer your partner’s question in a full sentence.',
      'Ask one follow-up question.',
      'Find one thing you both enjoy.',
    ],
    talkingPoints: ['What do you usually do…?', 'How often do you…?', 'Why do you enjoy…?', 'We both like…'],
  },
]

export function pickDemoMission(seed: number): Mission {
  return DEMO_MISSIONS[Math.abs(seed) % DEMO_MISSIONS.length]
}

const DEMO_NAMES = ['Rani Kusuma', 'Bagas Pratama', 'Salsabila Rahma']

export function demoPartners(level: number, mode: MatchMode): Participant[] {
  const count = mode === 'group' ? 2 : 1
  return DEMO_NAMES.slice(0, count).map((name, index) => ({
    uid: `demo-partner-${index}`,
    name,
    level: Math.max(1, level + (index === 0 ? 1 : -1)),
    isDemo: true,
  }))
}
