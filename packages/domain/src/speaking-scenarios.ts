/**
 * Speaking Practice content contract.
 *
 * The catalog is static, versioned content — not user data — so it lives in the
 * domain package instead of Firestore. Every scenario carries the three context
 * paragraphs the practice flow renders (situation, context, objective) plus the
 * single speaking task. Guided hints are separate fields so Free Practice can
 * withhold them without a second copy of the content.
 */

export type SpeakingPracticeMode = 'guided' | 'free'
export type SpeakingSessionType = 'quick' | 'full'
export type SpeakingDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface SpeakingScenario {
  id: string
  title: string
  category: string
  difficulty: SpeakingDifficulty
  /** Paragraph 1 — the situation the learner is placed in. */
  situation: string
  /** Paragraph 2 — background that makes the situation easier to reason about. */
  context: string
  /** Paragraph 3 — what the answer is expected to do. */
  objective: string
  /** The single speaking task shown after the three paragraphs. */
  question: string
  /** Guided Practice only. */
  talkingPoints: readonly string[]
  /** Guided Practice only. */
  usefulExpressions: readonly string[]
  /** Guided Practice only. */
  vocabulary: readonly string[]
}

export interface SpeakingPracticeModeDefinition {
  id: SpeakingPracticeMode
  label: string
  description: string
  benefits: readonly string[]
  /** Whether the preparation screen may show talking points and expressions. */
  showsGuidedHints: boolean
}

export interface SpeakingSessionTypeDefinition {
  id: SpeakingSessionType
  label: string
  description: string
  minSeconds: number
  maxSeconds: number
  /** Shown on the preparation screen as the speaking target. */
  instruction: string
}

export const SPEAKING_PRACTICE_MODES: Readonly<Record<SpeakingPracticeMode, SpeakingPracticeModeDefinition>> = {
  guided: {
    id: 'guided',
    label: 'Guided Practice',
    description:
      'Build your confidence with structured prompts, helpful expressions, and guided speaking instructions.',
    benefits: ['Talking points to organise your ideas', 'Useful expressions you can reuse', 'Vocabulary suggestions'],
    showsGuidedHints: true,
  },
  free: {
    id: 'free',
    label: 'Free Practice',
    description:
      'Challenge yourself with independent speaking scenarios and express your ideas naturally.',
    benefits: ['No hints or sample structure', 'Tests independent idea development', 'Closer to a real conversation'],
    showsGuidedHints: false,
  },
}

export const SPEAKING_SESSION_TYPES: Readonly<Record<SpeakingSessionType, SpeakingSessionTypeDefinition>> = {
  quick: {
    id: 'quick',
    label: 'Quick Practice',
    description: 'A short speaking exercise with fast feedback. Good for a daily habit.',
    minSeconds: 10,
    maxSeconds: 20,
    instruction: 'Answer in one or two complete sentences. Keep it short and clear.',
  },
  full: {
    id: 'full',
    label: 'Full Assessment',
    description: 'A longer response that gives the assessment more evidence to work with.',
    minSeconds: 45,
    maxSeconds: 90,
    instruction: 'Develop your answer: give reasons, add an example, and close with a short conclusion.',
  },
}

export const SPEAKING_SCENARIOS: readonly SpeakingScenario[] = [
  {
    id: 'daily-routines',
    title: 'Daily Routines',
    category: 'Daily Life',
    difficulty: 'beginner',
    situation:
      'Imagine a friend from another country asks you what a normal weekday looks like for you. They want to understand how students in your city spend their day.',
    context:
      'Your friend has never visited Indonesia, so they do not know when school starts, how you travel there, or what you usually do in the evening.',
    objective:
      'Describe your weekday routine in order, from the moment you wake up until you go to bed, and mention the parts you enjoy most.',
    question: 'Tell us about your typical weekday. What do you do from morning to night, and which part do you enjoy the most?',
    talkingPoints: ['What time do you wake up and what do you do first?', 'How do you get to school or work?', 'What do you usually do in the evening?'],
    usefulExpressions: ['I usually start my day by...', 'After that, I...', 'In the evening, I normally...', 'The part I enjoy most is...'],
    vocabulary: ['routine', 'commute', 'schedule', 'chores'],
  },
  {
    id: 'travel-plans',
    title: 'Travel Plans',
    category: 'Travel',
    difficulty: 'beginner',
    situation:
      'Imagine that you have an opportunity to travel to another country during your next holiday. You have been thinking about visiting a place that offers interesting cultural experiences and beautiful scenery.',
    context:
      'You have a limited travel budget and need to decide where to go. You also need to consider transportation, accommodation, and the activities you would like to experience during your trip.',
    objective: 'Think about your ideal destination, why you would choose it, and how you would prepare for the journey.',
    question: 'Tell us where you would like to travel, explain why you chose that destination, and describe how you would prepare for the trip.',
    talkingPoints: ['Where would you like to go?', 'Why is that destination interesting to you?', 'What would you prepare before travelling?'],
    usefulExpressions: ['I would love to visit...', 'One of the main reasons is...', 'Before travelling, I would...', 'I have always been interested in...'],
    vocabulary: ['destination', 'itinerary', 'accommodation', 'budget'],
  },
  {
    id: 'memorable-meal',
    title: 'A Memorable Meal',
    category: 'Food & Culture',
    difficulty: 'beginner',
    situation:
      'Think about a meal you still remember clearly. It might be a family dinner, a street food snack, or something you ate while travelling.',
    context:
      'Food is often connected to people and places, so the memory of a meal usually includes who was there and why the moment mattered.',
    objective: 'Describe the meal, explain who you shared it with, and say why it stayed in your memory.',
    question: 'Describe a meal you will never forget. What did you eat, who were you with, and why was it special?',
    talkingPoints: ['What was the meal and where did you eat it?', 'Who was with you?', 'Why do you still remember it?'],
    usefulExpressions: ['I will never forget...', 'It was served with...', 'What made it special was...', 'Whenever I think about it, I...'],
    vocabulary: ['flavour', 'ingredient', 'homemade', 'gathering'],
  },
  {
    id: 'learning-goals',
    title: 'Learning Goals',
    category: 'Learning',
    difficulty: 'beginner',
    situation:
      'Your teacher asks the class to explain one skill they want to improve this semester and how they plan to practise it.',
    context:
      'Improving a skill takes regular practice, so your teacher wants to hear a realistic plan rather than a general wish.',
    objective: 'Name one skill you want to improve, explain why it matters to you, and describe the practice routine you will follow.',
    question: 'What is one skill you want to improve this semester, and how will you practise it every week?',
    talkingPoints: ['Which skill do you want to improve?', 'Why is this skill important for you?', 'How often will you practise?'],
    usefulExpressions: ['This semester I want to improve...', 'It matters to me because...', 'I plan to practise by...', 'I will track my progress by...'],
    vocabulary: ['improve', 'consistent', 'progress', 'feedback'],
  },
  {
    id: 'technology-society',
    title: 'Technology and Society',
    category: 'Technology',
    difficulty: 'advanced',
    situation:
      'A local newspaper is collecting student opinions about how smartphones have changed the way teenagers communicate.',
    context:
      'Some people argue that constant connection makes friendships stronger, while others believe it makes face-to-face conversation shallower. Both sides cite personal experience.',
    objective:
      'Take a position, support it with reasoning and an example, and acknowledge one counter-argument before concluding.',
    question: 'Has smartphone use improved or weakened the way your generation communicates? Defend your view with reasons and examples.',
    talkingPoints: ['What is your overall position?', 'Which evidence or experience supports it?', 'What is the strongest argument against your view?'],
    usefulExpressions: ['I would argue that...', 'The evidence I see around me suggests...', 'Admittedly, some people claim that...', 'On balance, I believe...'],
    vocabulary: ['constant connectivity', 'face-to-face', 'attention span', 'social pressure'],
  },
  {
    id: 'difficult-decision',
    title: 'A Difficult Decision',
    category: 'Personal Growth',
    difficulty: 'intermediate',
    situation:
      'Think about a decision you had to make that was genuinely difficult, such as choosing a school, ending a commitment, or moving to a new place.',
    context:
      'Difficult decisions usually involve a trade-off: choosing one option means giving something else up, and the result is rarely obvious at the time.',
    objective: 'Explain the decision, the options you weighed, and what you learned from making it.',
    question: 'Describe a difficult decision you made. What options did you consider, and what did you learn from the choice?',
    talkingPoints: ['What was the decision?', 'What were the options and the trade-offs?', 'What did you learn afterwards?'],
    usefulExpressions: ['I was torn between...', 'On one hand... on the other hand...', 'In the end, I decided to...', 'Looking back, I realise...'],
    vocabulary: ['trade-off', 'consequence', 'priority', 'regret'],
  },
  {
    id: 'hobbies-interests',
    title: 'Hobbies and Interests',
    category: 'Lifestyle',
    difficulty: 'beginner',
    situation:
      'You are meeting a new classmate and want to explain what you like to do outside school so you can find something in common.',
    context:
      'People often enjoy a hobby for different reasons: relaxation, competition, creativity, or time with friends.',
    objective: 'Describe your main hobby, explain how you started it, and say what it gives you.',
    question: 'What do you enjoy doing in your free time, how did you start, and why does it matter to you?',
    talkingPoints: ['What is your hobby?', 'How and when did you start?', 'What do you get from it?'],
    usefulExpressions: ['I am really into...', 'I got into it when...', 'It helps me to...', 'I would recommend it because...'],
    vocabulary: ['hobby', 'unwind', 'skill', 'spare time'],
  },
  {
    id: 'education-learning',
    title: 'Education and Learning',
    category: 'Education',
    difficulty: 'intermediate',
    situation:
      'Your school is reviewing how it teaches, and students have been invited to give feedback about the way lessons are delivered.',
    context:
      'Some students learn best from discussion and group work, while others prefer reading, note-taking, or practising alone. Teachers cannot always accommodate every preference.',
    objective: 'Explain which learning approach works best for you, give an example, and suggest one change your school could make.',
    question: 'How do you learn best, and what one change would you suggest to make lessons more effective for students like you?',
    talkingPoints: ['Which learning approach suits you?', 'Can you give a concrete example?', 'What change would you suggest?'],
    usefulExpressions: ['I learn most effectively when...', 'For example, in my... class...', 'One change I would suggest is...', 'This would help because...'],
    vocabulary: ['approach', 'discussion', 'independent study', 'engagement'],
  },
  {
    id: 'future-career',
    title: 'Future Career',
    category: 'Work',
    difficulty: 'intermediate',
    situation:
      'You are preparing for a school career day where each student explains the job they hope to do after graduation.',
    context:
      'Career plans often change, so the goal is to explain your current direction and the steps that would make it realistic.',
    objective: 'Describe the career you are aiming for, explain what attracts you to it, and outline the preparation it requires.',
    question: 'What career are you aiming for, why does it interest you, and what will you need to do to prepare for it?',
    talkingPoints: ['Which career interests you?', 'What attracts you to that field?', 'What preparation does it require?'],
    usefulExpressions: ['I am aiming to become...', 'What attracts me most is...', 'To prepare, I will need to...', 'In the long term, I hope to...'],
    vocabulary: ['career path', 'qualification', 'internship', 'specialise'],
  },
  {
    id: 'environmental-problems',
    title: 'Environmental Problems',
    category: 'Environment',
    difficulty: 'advanced',
    situation:
      'A student committee is drafting a proposal for one environmental policy the school should adopt next year.',
    context:
      'The school has a limited budget and cannot fund every idea. Proposals that ask students to change daily habits are cheaper but harder to enforce.',
    objective: 'Propose one policy, justify it with reasoning, and address the practical difficulty of making it work.',
    question: 'Which single environmental policy should your school adopt, and how would you make it realistic rather than symbolic?',
    talkingPoints: ['What policy do you propose?', 'Why is it the most effective option?', 'How would you handle resistance or cost?'],
    usefulExpressions: ['I would propose that...', 'The main reason is...', 'A likely objection is...', 'To make it work, the school would need to...'],
    vocabulary: ['sustainable', 'enforce', 'incentive', 'waste reduction'],
  },
  {
    id: 'important-experience',
    title: 'An Important Experience',
    category: 'Personal Growth',
    difficulty: 'intermediate',
    situation:
      'Think about an experience that changed how you see yourself, such as a competition, a failure, a journey, or a responsibility you had to take on.',
    context:
      'Important experiences are not always pleasant. Sometimes the most useful lesson comes from something that did not go as planned.',
    objective: 'Narrate the experience clearly, explain what changed in your thinking, and connect it to how you act now.',
    question: 'Describe an experience that changed you. What happened, and how are you different because of it?',
    talkingPoints: ['What happened, in order?', 'How did you feel at the time?', 'What changed in the way you act now?'],
    usefulExpressions: ['It started when...', 'At that moment I felt...', 'What I did not expect was...', 'Since then, I have...'],
    vocabulary: ['turning point', 'setback', 'perspective', 'resilience'],
  },
  {
    id: 'family-relationships',
    title: 'Family and Relationships',
    category: 'Relationships',
    difficulty: 'beginner',
    situation:
      'A new friend asks you to describe the people you live with and the role each person plays in your daily life.',
    context:
      'Families look different from one another, so the question is about your own household rather than an ideal family.',
    objective: 'Introduce the people in your household, describe one thing you do together, and explain what you appreciate about them.',
    question: 'Who do you live with, what do you usually do together, and what do you appreciate most about them?',
    talkingPoints: ['Who is in your household?', 'What do you do together?', 'What do you appreciate about them?'],
    usefulExpressions: ['I live with...', 'We usually...', 'What I appreciate most is...', 'We get along well because...'],
    vocabulary: ['household', 'supportive', 'responsibility', 'close-knit'],
  },
  {
    id: 'health-lifestyle',
    title: 'Health and Lifestyle',
    category: 'Health',
    difficulty: 'intermediate',
    situation:
      'Your class is discussing how students can stay healthy during a busy exam period when time and sleep are limited.',
    context:
      'Advice that works for adults is not always realistic for students, so the discussion focuses on small changes that fit a school schedule.',
    objective: 'Describe one habit you want to change, explain the obstacle, and propose a realistic way to keep it up.',
    question: 'What health habit would you like to improve, what makes it difficult, and how would you make it stick?',
    talkingPoints: ['Which habit do you want to improve?', 'What makes it hard to maintain?', 'What realistic change would help?'],
    usefulExpressions: ['I would like to improve...', 'The main obstacle is...', 'A realistic change would be...', 'I would keep it up by...'],
    vocabulary: ['habit', 'sleep schedule', 'balanced', 'consistency'],
  },
  {
    id: 'social-media',
    title: 'Social Media',
    category: 'Technology',
    difficulty: 'advanced',
    situation:
      'A school magazine is publishing a debate about whether students should be allowed to use social media during breaks.',
    context:
      'Supporters point to communication and community; critics point to distraction, comparison, and lost conversation time.',
    objective: 'State a clear position, support it with reasoning, and propose a workable rule rather than a simple ban or permission.',
    question: 'Should students be allowed to use social media during school breaks? Give your position and a rule you would support.',
    talkingPoints: ['What is your position?', 'What reasoning supports it?', 'What rule would balance both sides?'],
    usefulExpressions: ['My position is that...', 'The strongest reason is...', 'A workable compromise would be...', 'This would only work if...'],
    vocabulary: ['distraction', 'comparison', 'moderation', 'digital wellbeing'],
  },
  {
    id: 'city-life',
    title: 'City Life',
    category: 'Society',
    difficulty: 'intermediate',
    situation:
      'You are writing a short spoken reflection for a class project about whether you would prefer to live in a big city or a smaller town.',
    context:
      'Cities offer opportunity and convenience but often cost more and feel crowded. Smaller towns are quieter but may offer fewer options.',
    objective: 'Compare the two options, explain your preference, and describe the trade-off you are accepting.',
    question: 'Would you rather live in a big city or a smaller town? Compare them and explain your choice.',
    talkingPoints: ['What are the advantages of each?', 'Which do you prefer?', 'What trade-off are you accepting?'],
    usefulExpressions: ['Compared with...', 'The advantage of living in... is...', 'I would rather...', 'The trade-off is that...'],
    vocabulary: ['crowded', 'opportunity', 'cost of living', 'community'],
  },
  {
    id: 'personal-achievements',
    title: 'Personal Achievements',
    category: 'Personal Growth',
    difficulty: 'beginner',
    situation:
      'Your teacher asks each student to share one achievement they are proud of, big or small.',
    context:
      'An achievement does not have to be a prize. It can be finishing something difficult, helping someone, or improving steadily.',
    objective: 'Describe the achievement, explain the effort it required, and say why it matters to you.',
    question: 'What is one achievement you are proud of, and what did it take to reach it?',
    talkingPoints: ['What did you achieve?', 'What effort did it require?', 'Why does it matter to you?'],
    usefulExpressions: ['I am proud that I...', 'It took me... to...', 'The hardest part was...', 'It matters to me because...'],
    vocabulary: ['achievement', 'effort', 'determination', 'milestone'],
  },
  {
    id: 'cultural-differences',
    title: 'Cultural Differences',
    category: 'Culture',
    difficulty: 'advanced',
    situation:
      'An exchange student asks you to explain one custom from your culture that visitors often misunderstand.',
    context:
      'Customs around greeting, eating, and showing respect differ widely, and a behaviour that feels polite in one culture can seem strange in another.',
    objective: 'Explain the custom, describe how it is usually interpreted by outsiders, and clarify what it actually means.',
    question: 'Which custom from your culture is often misunderstood, and how would you explain its real meaning to a visitor?',
    talkingPoints: ['Which custom will you explain?', 'How do outsiders usually read it?', 'What does it actually mean?'],
    usefulExpressions: ['One custom that often surprises visitors is...', 'From the outside, it may look like...', 'In fact, it signals...', 'Once you understand the context, it makes sense because...'],
    vocabulary: ['custom', 'misinterpret', 'respect', 'context'],
  },
  {
    id: 'useful-invention',
    title: 'A Useful Invention',
    category: 'Technology',
    difficulty: 'intermediate',
    situation:
      'A class discussion asks students to name the invention that has most improved ordinary daily life.',
    context:
      'Some inventions are dramatic, while others are so ordinary that people rarely notice them. Usefulness is not the same as fame.',
    objective: 'Name one invention, explain its practical impact, and compare it with a more famous alternative.',
    question: 'Which invention has most improved everyday life, and why would you rank it above a more famous one?',
    talkingPoints: ['Which invention do you choose?', 'What practical difference does it make?', 'Why rank it above a famous alternative?'],
    usefulExpressions: ['I would choose...', 'Its real impact is...', 'Compared with..., it is...', 'Without it, everyday life would...'],
    vocabulary: ['invention', 'impact', 'everyday', 'essential'],
  },
  {
    id: 'teamwork-collaboration',
    title: 'Teamwork and Collaboration',
    category: 'Work',
    difficulty: 'beginner',
    situation:
      'You are describing a group project you worked on to a teacher who wants to know how the team organised itself.',
    context:
      'Group work goes well when tasks are divided clearly, but problems appear when one person does most of the work or nobody agrees on a deadline.',
    objective: 'Describe the project, explain how the team divided the work, and say what you would do differently next time.',
    question: 'Describe a group project you worked on. How did you divide the work, and what would you change next time?',
    talkingPoints: ['What was the project?', 'How did you divide the tasks?', 'What would you change next time?'],
    usefulExpressions: ['We worked on...', 'We divided the tasks so that...', 'One difficulty was...', 'Next time, I would...'],
    vocabulary: ['deadline', 'contribution', 'coordinate', 'reliable'],
  },
  {
    id: 'future-plans',
    title: 'Future Plans',
    category: 'Future',
    difficulty: 'advanced',
    situation:
      'You are recording a short statement for a scholarship application about what you intend to do in the next five years.',
    context:
      'Reviewers hear many general ambitions, so a convincing statement connects a specific goal to concrete steps and a realistic obstacle.',
    objective: 'State a specific five-year goal, explain the steps you will take, and identify one risk that could delay it.',
    question: 'What do you intend to achieve in the next five years, what steps will you take, and what could get in the way?',
    talkingPoints: ['What is your specific goal?', 'Which steps will you take first?', 'What risk could delay it?'],
    usefulExpressions: ['Within the next five years, I intend to...', 'My first step will be to...', 'A risk I anticipate is...', 'I would respond by...'],
    vocabulary: ['intend', 'milestone', 'anticipate', 'contingency'],
  },
]

const SCENARIO_INDEX = new Map(SPEAKING_SCENARIOS.map((scenario) => [scenario.id, scenario]))

export function getSpeakingScenario(id: string): SpeakingScenario | null {
  return SCENARIO_INDEX.get(id) ?? null
}

export function isSpeakingPracticeMode(value: unknown): value is SpeakingPracticeMode {
  return value === 'guided' || value === 'free'
}

export function isSpeakingSessionType(value: unknown): value is SpeakingSessionType {
  return value === 'quick' || value === 'full'
}

export function isSpeakingDifficulty(value: unknown): value is SpeakingDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
}

export interface SpeakingScenarioBrief {
  id: string
  title: string
  category: string
  difficulty: SpeakingDifficulty
  situation: string
  context: string
  objective: string
  question: string
  /** Empty in Free Practice: hints are never sent to a mode that must not show them. */
  talkingPoints: readonly string[]
  usefulExpressions: readonly string[]
  vocabulary: readonly string[]
}

/**
 * Mode-aware projection of a scenario. Free Practice receives empty hint arrays
 * so guided material cannot leak through the network payload.
 */
export function speakingScenarioBrief(scenario: SpeakingScenario, mode: SpeakingPracticeMode): SpeakingScenarioBrief {
  const guided = SPEAKING_PRACTICE_MODES[mode].showsGuidedHints
  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    difficulty: scenario.difficulty,
    situation: scenario.situation,
    context: scenario.context,
    objective: scenario.objective,
    question: scenario.question,
    talkingPoints: guided ? scenario.talkingPoints : [],
    usefulExpressions: guided ? scenario.usefulExpressions : [],
    vocabulary: guided ? scenario.vocabulary : [],
  }
}

export function speakingScenariosByDifficulty(difficulty: SpeakingDifficulty): readonly SpeakingScenario[] {
  return SPEAKING_SCENARIOS.filter((scenario) => scenario.difficulty === difficulty)
}
