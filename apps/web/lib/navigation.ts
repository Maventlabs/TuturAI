import type { LucideIcon } from 'lucide-react'
import {
  Home,
  LayoutDashboard,
  Mic,
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

/**
 * The full student route list, reachable from the menu sheet. The five dock
 * destinations lead this list; the practice modes below them are also surfaced
 * on the home launcher and the Learning hub.
 */
export const studentNav: NavItem[] = [
  { label: 'Beranda', href: '/siswa', icon: Home },
  { label: 'Learning', href: '/siswa/belajar', icon: Route },
  { label: 'Matchmaking', href: '/siswa/challenge-speaking', icon: Users },
  { label: 'AI Tutor', href: '/siswa/latihan-bicara-ai', icon: Headphones },
  { label: 'Classroom', href: '/siswa/penugasan', icon: ClipboardCheck },
  { label: 'Speaking Practice', href: '/siswa/speaking', icon: Mic },
  { label: 'Pronunciation Lab', href: '/siswa/pronunciation', icon: AudioLines },
  { label: 'Vocabulary', href: '/siswa/vocabulary', icon: BookText },
  { label: 'Listening', href: '/siswa/listening', icon: Headphones },
  { label: 'Quiz', href: '/siswa/quiz', icon: ListChecks },
  { label: 'Adaptive Path', href: '/siswa/adaptive', icon: Route },
  { label: 'Tes Pedagogis', href: '/siswa/tes', icon: FlaskConical },
]

/**
 * The five destinations the student dock carries, ordered left to right.
 * Beranda sits in the middle so the dock reads as a symmetric instrument with
 * a fixed anchor; the four practice surfaces fan out around it.
 */
export const studentDockNav: NavItem[] = [
  { label: 'Learning', href: '/siswa/belajar', icon: Route },
  { label: 'Matchmaking', href: '/siswa/challenge-speaking', icon: Users },
  { label: 'Beranda', href: '/siswa', icon: Home },
  { label: 'AI Tutor', href: '/siswa/latihan-bicara-ai', icon: Headphones },
  { label: 'Classroom', href: '/siswa/penugasan', icon: ClipboardCheck },
]

/**
 * Account-level student routes. These live in the profile menu rather than the
 * dock, so the dock stays about doing the work and the menu stays about you.
 */
export const studentAccountNav: NavItem[] = [
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
