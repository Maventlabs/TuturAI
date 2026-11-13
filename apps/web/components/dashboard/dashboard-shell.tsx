'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Search,
  Bell,
  LogOut,
  Flame,
  Star,
} from 'lucide-react'
import { studentNav, teacherNav } from '@/lib/navigation'
import { Logo } from '@/components/logo'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { cn } from '@/lib/utils'
import { SystemStatus } from '@/components/dashboard/system-status'

interface DashboardUser {
  name: string
  email: string
  initials: string
  meta: string
}

interface StudentStats {
  level: number
  xp: number
  streak: number
}

interface DashboardShellProps {
  role: 'student' | 'teacher'
  user: DashboardUser
  studentStats?: StudentStats
  children: React.ReactNode
}

export function DashboardShell({
  role,
  user,
  studentStats,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const nav = role === 'student' ? studentNav : teacherNav
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  async function handleLogout() {
    setLogoutError(null)
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('SESSION_LOGOUT_FAILED')
    } catch {
      setLogoutError('Keluar tidak berhasil. Periksa koneksi internet, lalu coba lagi.')
      return
    }

    try {
      await signOut(getFirebaseAuth())
    } catch {
      // The server session is already cleared; continue to the login page.
    }
    router.push('/auth/login')
    router.refresh()
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    if (!query) return
    router.push(role === 'student' ? `/siswa/quiz?search=${encodeURIComponent(query)}` : `/guru/siswa?search=${encodeURIComponent(query)}`)
  }

  // Bottom nav for students on mobile (first 5 items)
  const bottomItems = role === 'student' ? nav.slice(0, 5) : []

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-sidebar-border',
            collapsed ? 'justify-center px-0' : 'justify-between gap-2 px-4',
          )}
        >
          {!collapsed && (
            <Link
              href={role === 'student' ? '/siswa' : '/guru'}
              className="min-w-0 rounded-md outline-none ring-ring focus-visible:ring-2"
            >
              <Logo />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav items={nav} collapsed={collapsed} />
        </div>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-64',
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-full lg:hidden"
                  aria-label="Buka menu"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <div className="flex h-16 items-center border-b border-sidebar-border px-5">
                <Logo />
              </div>
              <div className="py-4">
                <SidebarNav items={nav} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden w-full max-w-sm sm:block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="Cari..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Cari di aplikasi"
              className="peer h-9 w-full rounded-full border border-transparent bg-secondary/70 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border focus:bg-card focus:ring-2 focus:ring-ring/25 [&::-webkit-search-cancel-button]:appearance-none"
            />
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-muted-foreground transition-opacity peer-focus:opacity-0 lg:block"
            >
              /
            </kbd>
          </form>

          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
            {/* Student gamification chips */}
            {studentStats && (
              <div className="mr-1 hidden items-center gap-1.5 md:flex">
                <span className="flex h-9 items-center gap-1.5 rounded-full bg-brand/15 px-3 text-xs font-semibold text-brand-foreground">
                  <Star className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  Lv <span className="font-mono tabular-nums">{studentStats.level}</span>
                </span>
                <span className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{studentStats.xp.toLocaleString('id-ID')}</span> XP
                </span>
                <span className="flex h-9 items-center gap-1.5 rounded-full bg-destructive/10 px-3 text-xs font-semibold text-foreground">
                  <Flame className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{studentStats.streak}</span>
                </span>
              </div>
            )}

            <SystemStatus showDevice={role === 'teacher'} />

            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Notifikasi"
              className="relative rounded-full text-muted-foreground"
              onClick={() => router.push(role === 'teacher' ? '/guru/penilaian' : '/siswa/penugasan')}
            >
              <Bell className="h-5 w-5" />
            </Button>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Menu profil"
                className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2"
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="text-sm font-semibold text-foreground">
                      {user.name}
                    </p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {user.meta}
                    </p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer p-0">
                    <Link
                      href={role === 'student' ? '/siswa/profil' : '/guru/pengaturan'}
                      className="flex w-full items-center px-1.5 py-1"
                    >
                      Profil &amp; Pengaturan
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer"
                    variant="destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {logoutError && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{logoutError}</p>}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav (students) */}
      {bottomItems.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/95 px-2 py-1.5 backdrop-blur-md lg:hidden">
          {bottomItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/siswa' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">
                  {item.label.split(' ')[0]}
                </span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
