import { describe, expect, it } from 'vitest'
import { adaptiveCategories, adaptiveLevels, adaptiveModules, getAdaptiveLevelForScore, getAdaptiveModule } from './adaptive-modules'

describe('adaptive learning modules', () => {
  it('provides one authored module for every category and ability-level pairing', () => {
    expect(adaptiveModules).toHaveLength(16)
    expect(adaptiveCategories).toHaveLength(4)
    expect(adaptiveLevels).toHaveLength(4)
    expect(new Set(adaptiveModules.map((module) => module.id)).size).toBe(16)
    for (const category of adaptiveCategories) {
      for (const level of adaptiveLevels) {
        expect(getAdaptiveModule(`${category.id}-${level.id}`)).toMatchObject({
          categoryId: category.id,
          levelId: level.id,
        })
      }
    }
  })

  it('includes actionable analysis, recommendations, activities, and evidence', () => {
    for (const learningModule of adaptiveModules) {
      expect(learningModule.analysis.length).toBeGreaterThan(80)
      expect(learningModule.objectives.length).toBeGreaterThanOrEqual(3)
      expect(learningModule.recommendations.length).toBeGreaterThanOrEqual(3)
      expect(learningModule.activities).toHaveLength(3)
      expect(learningModule.activities.every((activity) => activity.instruction && activity.evidence)).toBe(true)
      expect(learningModule.nextStep.length).toBeGreaterThan(20)
    }
  })

  it('maps the requested four ability bands without presenting them as CEFR', () => {
    expect(getAdaptiveLevelForScore(null)).toBeNull()
    expect(getAdaptiveLevelForScore(0)).toBe('support')
    expect(getAdaptiveLevelForScore(39)).toBe('support')
    expect(getAdaptiveLevelForScore(40)).toBe('emerging')
    expect(getAdaptiveLevelForScore(60)).toBe('capable')
    expect(getAdaptiveLevelForScore(80)).toBe('proficient')
    expect(getAdaptiveLevelForScore(100)).toBe('proficient')
    expect(getAdaptiveLevelForScore(Number.NaN)).toBeNull()
  })

  it('does not map unknown module ids to fabricated content', () => {
    expect(getAdaptiveModule('unknown-module')).toBeNull()
  })
})
