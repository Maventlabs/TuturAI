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
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
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
