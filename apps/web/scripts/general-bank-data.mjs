import { GENERAL_BANK_ADVANCED } from './general-bank-advanced.mjs'
import { GENERAL_BANK_BEGINNER } from './general-bank-beginner.mjs'
import { GENERAL_BANK_INTERMEDIATE } from './general-bank-intermediate.mjs'

/**
 * The complete general question bank: 100 items, split across the three levels.
 *
 * Each item carries a category so the quiz can report which kind of knowledge
 * it tested, and a level so an exam only ever draws from the level the student
 * selected.
 */
export const GENERAL_BANK = [
  ...GENERAL_BANK_BEGINNER,
  ...GENERAL_BANK_INTERMEDIATE,
  ...GENERAL_BANK_ADVANCED,
]
