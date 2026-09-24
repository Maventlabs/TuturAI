export type TeacherLeaderboardInput = {
  studentId: string
  name: string
  classId: string
  className: string
  xp: number
  speakingScore: number | null
}

export function buildTeacherLeaderboard(rows: TeacherLeaderboardInput[]) {
  const sorted = [...rows].sort((left, right) => right.xp - left.xp || left.name.localeCompare(right.name))
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
}
