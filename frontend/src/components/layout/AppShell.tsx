import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  Factory,
  Package,
  PackageMinus,
  History,
  BarChart3,
  Settings as SettingsIcon,
  Utensils,
  Menu as MenuIcon,
  X,
  Moon,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/useThemeStore'
import { useSettings } from '@/hooks/useData'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
  { to: '/sales', label: 'Sales', icon: ReceiptText },
  { to: '/menu', label: 'Menu', icon: Utensils },
  { to: '/production', label: 'Production', icon: Factory },
  { to: '/resources', label: 'Resources', icon: Package },
  { to: '/waste', label: 'Deductions & Meals', icon: PackageMinus },
  { to: '/transactions', label: 'Transactions', icon: History },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()
  const isDark = theme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title="Toggle theme"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: settings } = useSettings()
  const logoUrl = settings?.logo_path ? (
    settings.logo_path.startsWith('http')
      ? settings.logo_path
      : `/storage/${settings.logo_path.replace(/^\/+/, '').replace(/^storage\//, '')}`
  ) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="size-9 rounded-lg border bg-white p-0.5 object-contain shadow-sm"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            {settings?.restaurant_name?.charAt(0) ?? 'E'}
          </div>
        )}
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">
            {settings?.restaurant_name ?? 'EL CASA'}
          </div>
          <div className="text-[11px] text-sidebar-muted">Operations OS</div>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-sidebar-foreground'
                  : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
              )
            }
          >
            <item.icon className="size-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[11px] text-sidebar-muted">v1.0.0 · ROMS</div>
    </div>
  )
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const current = navItems.find(
    (item) => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              className="absolute top-4 right-3 text-sidebar-muted"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="size-5" />
            </Button>
            <h1 className="text-base font-semibold sm:text-lg">
              {current?.label ?? 'ROMS'}
            </h1>
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
