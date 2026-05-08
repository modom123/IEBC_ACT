'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type User = { name?: string | null; email?: string | null; role?: string | null; plan?: string | null }

const PLAN_RANK: Record<string, number> = { silver: 1, gold: 2, platinum: 3 }
const PLAN_UPGRADE: Record<number, string> = { 2: 'Gold', 3: 'Platinum' }

type NavItem = {
  href: string; icon: string; label: string
  exact?: boolean; minPlan?: number; soon?: boolean
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Dashboard',
    items: [
      { href: '/accounting', icon: '◈', label: 'Overview', exact: true, minPlan: 1 },
    ],
  },
  {
    title: 'Revenue',
    items: [
      { href: '/accounting/invoices',         icon: '▤', label: 'Invoices',            minPlan: 1 },
      { href: '/accounting/estimates',        icon: '◫', label: 'Estimates',           minPlan: 1, soon: true },
      { href: '/accounting/customers',        icon: '◯', label: 'Customers',           minPlan: 1 },
      { href: '/accounting/aged-receivables', icon: '⊡', label: 'Aged Receivables',    minPlan: 2, soon: true },
    ],
  },
  {
    title: 'Expenses',
    items: [
      { href: '/accounting/transactions',   icon: '⇄', label: 'Transactions',     minPlan: 1 },
      { href: '/accounting/bills',          icon: '▥', label: 'Bills & Payables', minPlan: 1 },
      { href: '/accounting/vendors',        icon: '⬡', label: 'Vendors & 1099',   minPlan: 2 },
      { href: '/accounting/purchaseorders', icon: '⊕', label: 'Purchase Orders',  minPlan: 3, soon: true },
    ],
  },
  {
    title: 'Banking & Books',
    items: [
      { href: '/accounting/reconcile', icon: '⇌', label: 'Reconciliation',    minPlan: 2 },
      { href: '/accounting/connect',   icon: '⬡', label: 'Bank Connect',      minPlan: 2 },
      { href: '/accounting/ledger',    icon: '⊞', label: 'General Ledger',    minPlan: 3 },
      { href: '/accounting/coa',       icon: '≡', label: 'Chart of Accounts', minPlan: 3 },
      { href: '/accounting/journal',   icon: '⊟', label: 'Journal Entries',   minPlan: 3 },
    ],
  },
  {
    title: 'Payroll',
    items: [
      { href: '/accounting/payroll', icon: '◫', label: 'Payroll', minPlan: 3 },
    ],
  },
  {
    title: 'Tax & Compliance',
    items: [
      { href: '/accounting/tax',   icon: '💸', label: 'Tax Center',       minPlan: 2 },
      { href: '/accounting/rules', icon: '⊛', label: 'Automation Rules', minPlan: 2, soon: true },
      { href: '/accounting/audit', icon: '⊙', label: 'Audit Trail',      minPlan: 3, soon: true },
    ],
  },
  {
    title: 'Reports & Tools',
    items: [
      { href: '/accounting/scanner',   icon: '✦', label: 'AI Scanner',         minPlan: 1 },
      { href: '/accounting/reports',   icon: '▦', label: 'Reports',            minPlan: 1 },
      { href: '/accounting/budgets',   icon: '◎', label: 'Budgets',            minPlan: 2, soon: true },
      { href: '/accounting/forecast',  icon: '⬆', label: 'Cash Flow Forecast', minPlan: 2, soon: true },
      { href: '/accounting/recurring', icon: '↺', label: 'Recurring',          minPlan: 2 },
      { href: '/accounting/inventory', icon: '▣', label: 'Inventory',          minPlan: 3, soon: true },
      { href: '/accounting/projects',  icon: '◧', label: 'Projects',           minPlan: 2 },
      { href: '/accounting/tracker',   icon: '▷', label: 'Mileage & Time',     minPlan: 2 },
    ],
  },
]

export default function AccountingShell({ user, children }: { user?: User; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const isInternal = user?.role === 'admin' || user?.role === 'iebc_staff'
  const planRank = isInternal ? 3 : (PLAN_RANK[user?.plan ?? 'silver'] ?? 1)
  const planLabel = isInternal
    ? 'Platinum · Internal'
    : (user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Silver')

  function active(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U'

  const allItems = NAV.flatMap(s => s.items)
  const activeItem = allItems.filter(i => active(i.href, i.exact)).pop()
  const activeSection = NAV.find(s => s.items.some(i => i.href === activeItem?.href))

  const Sidebar = () => (
    <aside className="w-56 flex flex-col bg-white border-r border-gray-200 h-full">
      <Link href="/hub"
        className="flex items-center gap-2 px-4 py-2 bg-[#0a3060] hover:bg-[#082248] transition-colors shrink-0 group">
        <span className="text-blue-300 group-hover:text-white text-sm leading-none">←</span>
        <span className="text-blue-200 group-hover:text-white text-[11px] font-semibold tracking-wide uppercase">Phantom</span>
      </Link>

      <div className="h-12 bg-[#0F4C81] flex items-center px-4 gap-2.5 shrink-0">
        <div className="w-7 h-7 bg-[#C8902A] rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-black text-[10px] tracking-tight">IEBC</span>
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm">Efficient</p>
          <p className="text-blue-300 text-[10px]">Accounting & Finance</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-3 px-2">
        {NAV.map(({ title, items }) => (
          <div key={title}>
            <p className="px-2 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em]">{title}</p>
            <div className="space-y-px">
              {items.map(({ href, icon, label, exact, minPlan = 1, soon }) => {
                const isLocked = planRank < minPlan
                const isActive = !isLocked && active(href, exact)

                if (isLocked) {
                  return (
                    <Link key={label} href="/accounting/checkout"
                      className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-gray-300 hover:bg-gray-50 border-l-[3px] border-transparent transition-all">
                      <span className="text-[15px] leading-none w-4 text-center shrink-0 opacity-40">{icon}</span>
                      <span className="truncate flex-1 opacity-50">{label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 shrink-0">
                        {PLAN_UPGRADE[minPlan]}
                      </span>
                    </Link>
                  )
                }

                return (
                  <Link key={label} href={href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-100 ${
                      isActive
                        ? 'bg-blue-50 text-[#0F4C81] font-semibold border-l-[3px] border-[#0F4C81]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent'
                    }`}>
                    <span className={`text-[15px] leading-none w-4 text-center shrink-0 ${isActive ? 'text-[#0F4C81]' : 'text-gray-400'}`}>{icon}</span>
                    <span className="truncate flex-1">{label}</span>
                    {soon && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-400 shrink-0">Soon</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-gray-100 p-2 space-y-1">
        {!isInternal && planRank < 3 && (
          <Link href="/accounting/checkout"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition text-[12px] font-semibold text-amber-700 border border-amber-200">
            <span>★</span>
            <span>Upgrade to {planRank < 2 ? 'Gold' : 'Platinum'}</span>
          </Link>
        )}
        <Link href="/settings" onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all ${
            pathname.startsWith('/settings') ? 'bg-blue-50 text-[#0F4C81] font-semibold border-l-[3px] border-[#0F4C81]' : 'text-gray-600 hover:bg-gray-50 border-l-[3px] border-transparent'
          }`}>
          <span className="text-[15px] text-gray-400 w-4 text-center">⚙</span>
          <span>Settings</span>
        </Link>
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-7 h-7 rounded-full bg-[#0F4C81] flex items-center justify-center text-white text-[11px] font-bold shrink-0">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 truncate">{user?.name ?? 'My Account'}</p>
            <p className="text-[10px] text-gray-400 capitalize truncate">{planLabel}</p>
          </div>
          <span className="w-2 h-2 bg-green-400 rounded-full shrink-0 border-2 border-white" />
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="button"
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}

      <div className="hidden lg:flex shrink-0"><Sidebar /></div>
      <div className={`fixed inset-y-0 left-0 z-40 lg:hidden flex transition-transform duration-200 will-change-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation"
            className="lg:hidden p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <Link href="/hub" className="lg:hidden flex items-center gap-1.5 text-xs font-semibold text-[#0F4C81] hover:text-[#082D4F] transition">
            ← Phantom
          </Link>
          <div className="flex-1 hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            {activeSection && <span>{activeSection.title}</span>}
            {activeSection && <span>/</span>}
            {activeItem && <span className="font-semibold text-gray-600">{activeItem.label}</span>}
          </div>
          <div className="flex-1" />
          <Link href="/accounting/scanner"
            className="hidden sm:flex items-center gap-1.5 text-[13px] text-[#0F4C81] hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium transition border border-blue-100">
            ✦ AI Scanner
          </Link>
          {isInternal ? (
            <span className="text-[11px] sm:text-[13px] bg-[#0F4C81] text-white px-2 sm:px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap">
              Platinum · Internal
            </span>
          ) : planRank === 3 ? (
            <span className="text-[11px] sm:text-[13px] bg-purple-600 text-white px-2 sm:px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap">
              Platinum
            </span>
          ) : (
            <Link href="/accounting/checkout"
              className="text-[11px] sm:text-[13px] bg-[#C8902A] hover:bg-[#b07820] text-white px-2 sm:px-3 py-1.5 rounded-lg font-semibold transition shadow-sm whitespace-nowrap min-h-[36px] inline-flex items-center">
              ★ Upgrade
            </Link>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
