import { READING_BANK_ADVANCED } from './reading-bank-advanced.mjs'
import { READING_BANK_BEGINNER } from './reading-bank-beginner.mjs'
import { READING_BANK_INTERMEDIATE } from './reading-bank-intermediate.mjs'

/**
 * The complete reading bank: 20 passages, five questions each, 100 questions.
 *
 * Every passage carries its own level, so an exam can draw two passages from a
 * single level without ever mixing beginner and advanced material.
 */
export const READING_BANK = [
  ...READING_BANK_BEGINNER,
  ...READING_BANK_INTERMEDIATE,
  ...READING_BANK_ADVANCED,
]
