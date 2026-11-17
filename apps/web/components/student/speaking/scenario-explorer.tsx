'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { SpeakingPracticeMode, SpeakingScenarioBrief } from '@tuturai/domain'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { cn } from '@/lib/utils'

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export function ScenarioExplorer({
  scenarios,
  mode,
  loading,
  onSelect,
}: {
  scenarios: SpeakingScenarioBrief[]
  mode: SpeakingPracticeMode
  loading: boolean
  onSelect: (scenario: SpeakingScenarioBrief) => void
}) {
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const scenario of scenarios) seen.add(scenario.category)
    return ['all', ...Array.from(seen).sort()]
  }, [scenarios])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return scenarios.filter((scenario) => {
      if (category !== 'all' && scenario.category !== category) return false
      if (!needle) return true
      return (
        scenario.title.toLowerCase().includes(needle)
        || scenario.question.toLowerCase().includes(needle)
        || scenario.category.toLowerCase().includes(needle)
      )
    })
  }, [scenarios, category, query])

  return (
    <Panel>
      <PanelHeader
        label="Choose a scenario"
        right={<MonoLabel>{loading ? 'Loading' : `${visible.length} of ${scenarios.length}`}</MonoLabel>}
      />

      <div className="flex flex-col gap-3 border-b border-rule p-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
          role="group"
          aria-label="Filter by category"
        >
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                category === item
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-rule text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {item === 'all' ? 'All' : item}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-64">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="scenario-search" className="sr-only">
            Search scenarios
          </label>
          <input
            id="scenario-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search scenarios"
            className="h-8 w-full rounded-sm border border-rule bg-background pl-8 pr-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-card p-4">
              <div className="h-2 w-16 animate-pulse rounded-sm bg-secondary" />
              <div className="mt-3 h-3.5 w-3/4 animate-pulse rounded-sm bg-secondary" />
              <div className="mt-2 h-2.5 w-full animate-pulse rounded-sm bg-secondary" />
              <div className="mt-1.5 h-2.5 w-2/3 animate-pulse rounded-sm bg-secondary" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="font-heading text-[14px] font-bold text-foreground">No scenario matches that filter</p>
          <p className="mx-auto mt-1.5 max-w-[42ch] text-[12px] leading-relaxed text-muted-foreground">
            Clear the search or pick another category to see the full catalog.
          </p>
        </div>
      ) : (
        <ul className="grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((scenario, index) => (
            <li key={scenario.id} className="bg-card">
              <button
                type="button"
                onClick={() => onSelect(scenario)}
                className="group flex h-full w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <MonoLabel className="text-primary-deep">
                    {String(index + 1).padStart(2, '0')} · {scenario.category}
                  </MonoLabel>
                  <MonoLabel>{DIFFICULTY_LABEL[scenario.difficulty] ?? scenario.difficulty}</MonoLabel>
                </div>
                <p className="font-heading text-[14px] font-bold leading-snug text-foreground">{scenario.title}</p>
                <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{scenario.question}</p>
                <span className="mt-auto flex items-center gap-1 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary-deep">
                  {mode === 'guided' ? 'Open with hints' : 'Open scenario'}
                  <ArrowUpRight aria-hidden="true" className="size-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
