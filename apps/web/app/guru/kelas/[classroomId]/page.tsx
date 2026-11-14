'use client'

import { classroomLevelLabel } from '@tuturai/domain'
import { classBandColor } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { ClassroomBody, useClassroom } from '@/components/guru/classroom-context'
import { useTeacherName } from '@/components/guru/use-classroom-overview'
import { StreamPanel } from '@/components/guru/stream-panel'

export default function ClassroomStreamPage() {
  const { classroomId } = useClassroom()
  const teacherName = useTeacherName()

  return (
    <ClassroomBody>
      {(snapshot) => {
        const { classroom, members, assignments, materials } = snapshot
        const band = classBandColor(classroom.id)
        const levelLabel = classroomLevelLabel(classroom.level)

        const stats = [
          { label: 'Siswa', value: members.length },
          { label: 'Penugasan', value: assignments.length },
          { label: 'Materi', value: materials.length },
        ]

        return (
          <div className="space-y-5">
            <section
              aria-label={`Ringkasan ${classroom.name}`}
              className="relative overflow-hidden rounded-xl px-6 py-6 sm:px-8"
              style={{ backgroundColor: band }}
            >
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-balance font-heading text-2xl font-bold tracking-tight text-white sm:text-[28px]">
                      {classroom.name}
                    </h1>
                    {levelLabel && (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                        {levelLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-white/80">
                    {classroom.school ?? 'TuturAI Classroom'} · {teacherName}
                  </p>
                </div>

                <dl className="flex items-stretch">
                  {stats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={cn('min-w-16', index > 0 && 'border-l border-white/20 pl-5')}
                    >
                      <dd className="font-mono text-xl font-semibold tabular-nums leading-none text-white">
                        {stat.value}
                      </dd>
                      <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65">
                        {stat.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <StreamPanel
              classroom={classroom}
              assignments={assignments}
              band={band}
              composeHref={`/guru/kelas/${classroomId}/classwork?compose=assignment`}
              classworkHref={`/guru/kelas/${classroomId}/classwork`}
            />
          </div>
        )
      }}
    </ClassroomBody>
  )
}
