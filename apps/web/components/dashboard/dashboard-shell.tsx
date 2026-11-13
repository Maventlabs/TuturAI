'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, PanelLeftClose, PanelLeft, Search, Bell, LogOut } from 'lucide-react'
import { studentAccountNav, studentNav, teacherNav } from '@/lib/navigation'
import { Logo } from '@/components/logo'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { StudentDock } from '@/components/dashboard/student-dock'
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
import { RailReadout, RailValue } from '@/components/dashboard/rail-readout'

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

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Desktop sidebar — teachers only. Students navigate from the dock. */}
      {role === 'teacher' && (
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
              href="/guru"
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
      )}

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          role === 'teacher' && (collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'),
        )}
      >
        {/* Topbar — a ruled instrument rail: every zone is a cell divided by a
            hairline, so state reads as a gauge instead of a row of pills. */}
        <header className="sticky top-0 z-20 border-b border-rule bg-card/90 backdrop-blur-xl">
          <div className="flex h-16 items-stretch">
            {/* Menu sheet — the only way to reach the full student route list,
                so it stays available at every width for students. */}
            <div className={cn('flex items-center pl-3', role === 'teacher' && 'lg:hidden')}>
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Buka menu"
                      className="flex size-9 items-center justify-center rounded-sm border border-rule text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                  }
                >
                  <Menu className="size-4" />
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
            </div>

            {/* Search — a recessed command field, not a floating pill */}
            <form onSubmit={handleSearch} className="flex min-w-0 flex-1 items-center px-3 sm:px-4">
              <div className="relative w-full max-w-[280px] md:max-w-[380px] lg:max-w-[300px] xl:max-w-[400px]">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Cari di aplikasi"
                  className="peer h-9 w-full rounded-sm border border-rule bg-background pl-8 pr-11 text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
                />
                {/* The hint is a real element so the narrow mobile field can show a
                    short label instead of clipping a long placeholder mid-word. */}
                {search.length === 0 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground/80 peer-focus:hidden"
                  >
                    <span className="sm:hidden">Cari…</span>
                    <span className="hidden sm:inline">
                      {role === 'student' ? 'Cari materi atau kuis' : 'Cari siswa atau kelas'}
                    </span>
                  </span>
                )}
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center rounded-[3px] border border-rule bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground transition-opacity peer-focus:opacity-0 lg:flex"
                >
                  /
                </kbd>
              </div>
            </form>

            {/* Right rail */}
            <div className="flex items-stretch">
              {studentStats && (
                <div className="hidden items-stretch xl:flex">
                  <RailReadout label="Level">
                    <RailValue>{String(studentStats.level)}</RailValue>
                  </RailReadout>
                  <span className="my-3 w-px bg-rule" aria-hidden="true" />
                  <RailReadout label="XP">
                    <RailValue>{studentStats.xp.toLocaleString('id-ID')}</RailValue>
                  </RailReadout>
                  <span className="my-3 w-px bg-rule" aria-hidden="true" />
                  <RailReadout label="Streak">
                    <RailValue unit="hari">{String(studentStats.streak)}</RailValue>
                  </RailReadout>
                </div>
              )}

              <span className="w-px bg-rule" aria-hidden="true" />
              <SystemStatus showDevice={role === 'teacher'} />
              <span className="w-px bg-rule" aria-hidden="true" />

              <div className="flex items-center gap-1.5 px-2 sm:px-2.5">
                <button
                  type="button"
                  aria-label="Notifikasi"
                  onClick={() => router.push(role === 'teacher' ? '/guru/penilaian' : '/siswa/penugasan')}
                  className="flex size-8 items-center justify-center rounded-sm border border-rule text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Bell className="size-4" />
                </button>
                <ThemeToggle />
              </div>

              <span className="w-px bg-rule" aria-hidden="true" />

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Menu profil"
                  className="flex items-center gap-2.5 pl-2.5 pr-3 outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 sm:pl-3 sm:pr-4"
                >
                  <Avatar className="size-8 rounded-sm border border-rule">
                    <AvatarFallback className="rounded-sm bg-foreground font-mono text-[11px] font-medium text-background">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 flex-col items-start gap-1 2xl:flex">
                    <span className="max-w-[160px] truncate text-[12px] font-semibold leading-none text-foreground">
                      {user.name}
                    </span>
                    <span className="max-w-[160px] truncate font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-muted-foreground">
                      {user.meta}
                    </span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <p className="text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                        {user.meta}
                      </p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {role === 'student' ? (
                    <DropdownMenuGroup>
                      {studentAccountNav.map((item) => {
                        const Icon = item.icon

                        return (
                          <DropdownMenuItem key={item.href} className="cursor-pointer p-0">
                            <Link
                              href={item.href}
                              className="flex w-full items-center gap-2 px-1.5 py-1"
                            >
                              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuGroup>
                  ) : (
                    <DropdownMenuGroup>
                      <DropdownMenuItem className="cursor-pointer p-0">
                        <Link
                          href="/guru/pengaturan"
                          className="flex w-full items-center px-1.5 py-1"
                        >
                          Profil &amp; Pengaturan
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" variant="destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Keluar
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className={cn(
            'flex-1 px-4 py-6 sm:px-6 lg:px-8',
            role === 'student' ? 'pb-28' : 'pb-6 lg:pb-8',
          )}
        >
          {logoutError && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{logoutError}</p>}
          {children}
        </main>
      </div>

      {role === 'student' && <StudentDock />}
    </div>
  )
}
