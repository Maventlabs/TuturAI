import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Mic,
  MessageSquare,
  AudioLines,
  BookText,
  Headphones,
  ListChecks,
  Route,
  FlaskConical,
  TrendingUp,
  Trophy,
  Award,
  User,
  Users,
  GraduationCap,
  ClipboardCheck,
  Inbox,
  BarChart3,
  Cpu,
  Settings,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
}

export const studentNav: NavItem[] = [
  { label: 'Dashboard', href: '/siswa', icon: LayoutDashboard },
  { label: 'Penugasan', href: '/siswa/penugasan', icon: ClipboardCheck },
  { label: 'Challenge Speaking', href: '/siswa/challenge-speaking', icon: Users },
  { label: 'Speaking Practice', href: '/siswa/speaking', icon: Mic },
  { label: 'Latihan Bicara AI', href: '/siswa/latihan-bicara-ai', icon: Headphones, badge: 'AI' },
  { label: 'Pronunciation Lab', href: '/siswa/pronunciation', icon: AudioLines },
  { label: 'Vocabulary', href: '/siswa/vocabulary', icon: BookText },
  { label: 'Listening', href: '/siswa/listening', icon: Headphones },
  { label: 'Quiz', href: '/siswa/quiz', icon: ListChecks },
  { label: 'Adaptive Path', href: '/siswa/adaptive', icon: Route },
  { label: 'Tes Pedagogis', href: '/siswa/tes', icon: FlaskConical },
  { label: 'Progress', href: '/siswa/progress', icon: TrendingUp },
  { label: 'Leaderboard', href: '/siswa/leaderboard', icon: Trophy },
  { label: 'Pencapaian', href: '/siswa/achievements', icon: Award },
  { label: 'Profil', href: '/siswa/profil', icon: User },
]

export const teacherNav: NavItem[] = [
  { label: 'Dashboard', href: '/guru', icon: LayoutDashboard },
  { label: 'Kelas', href: '/guru/kelas', icon: GraduationCap },
  { label: 'Submission', href: '/guru/penilaian', icon: Inbox },
  { label: 'Siswa', href: '/guru/siswa', icon: Users },
  { label: 'Analitik', href: '/guru/analitik', icon: BarChart3 },
  { label: 'Leaderboard', href: '/guru/leaderboard', icon: Trophy },
  { label: 'Monitor Perangkat', href: '/guru/perangkat', icon: Cpu },
  { label: 'Pengaturan', href: '/guru/pengaturan', icon: Settings },
]
