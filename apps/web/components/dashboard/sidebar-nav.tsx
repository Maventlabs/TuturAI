'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SidebarNavProps {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ items, collapsed, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/siswa' &&
            item.href !== '/guru' &&
            pathname.startsWith(item.href))
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-sidebar-accent font-semibold text-sidebar-foreground'
                : 'font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary"
              />
            )}
            <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'h-5 px-1.5 text-[10px] font-semibold',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-success/15 text-success',
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
