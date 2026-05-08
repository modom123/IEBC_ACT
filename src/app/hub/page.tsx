import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MonthlyBarChart, DonutChart } from '@/components/Charts'

const DONUT_COLORS = ['#0F4C81', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a']

const TIER_INFO: Record<string, { label: string; color: string; consultants: number; users: number; price: string }> = {
  silver:   { label: 'Silver',   color: 'bg-gray-100 text-gray-700',          consultants: 0, users: 1,  price: '$9/mo'  },
  gold:     { label: 'Gold',     color: 'bg-amber-50 text-amber-700',          consultants: 3, users: 5,  price: '$22/mo' },
  platinum: { label: 'Platinum', color: 'bg-blue-50 text-[#0F4C81]',           consultants: 5, users: 10, price: '$42/mo' },
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K'
  return fmt(n)
}

export default async function Hub() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/auth/login')
  }
  let supabase: ReturnType<typeof createServerSupabaseClient>
  try {
    supabase = createServerSupabaseClient()
  } catch {
    redirect('/auth/login')
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const userId = session.user.id
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const [
    { data: sub },
    { data: consultants },
    { data: leads },
    { data: tasks },
    { data: profile },
    { data: txAll },
    { data: txMonth },
    { data: txChart },
    { data: invoices },
    { data: recentTx },
    { data: bills },
    { data: taxes },
  ] = await Promise.all([
    supabase.from('subscriptions').select('plan, status, current_period_end').eq('user_id', userId).single(),
    supabase.from('consultant_assignments').select('consultant_id, department').eq('user_id', userId),
    supabase.from('leads').select('id, business_name, heat, status, est_value').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id, title, status, priority, due_date').eq('user_id', userId).neq('status', 'done').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('full_name, role').eq('id', userId).single(),
    supabase.from('transactions').select('type, amount').eq('user_id', userId),
    supabase.from('transactions').select('type, amount').eq('user_id', userId).gte('date', firstOfMonth),
    supabase.from('transactions').select('date, type, amount, category').eq('user_id', userId).gte('date', sixMonthsAgo),
    supabase.from('invoices').select('status, total, amount_paid').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(6),
    supabase.from('bills').select('amount, due_date, status').eq('user_id', userId).eq('status', 'unpaid').order('due_date'),
    supabase.from('tax_obligations').select('amount, due_date, status').eq('user_id', userId).neq('status', 'paid'),
  ])

  // — Accounting metrics —
  const totalIncome      = (txAll || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses    = (txAll || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalUnpaidBills = (bills || []).reduce((s, b) => s + Number(b.amount), 0)
  const netProfit        = totalIncome - totalExpenses
  const grandNet         = netProfit - totalUnpaidBills
  const monthIncome      = (txMonth || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpenses    = (txMonth || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const outstanding      = (invoices || []).filter(i => i.status !== 'paid' && i.status !== 'void').reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0)
  const overdueInvoices  = (invoices || []).filter(i => i.status === 'overdue').length
  const isInternal       = profile?.role === 'admin' || profile?.role === 'iebc_staff'

  // — Charts —
  const monthlyMap: Record<string, { income: number; expenses: number }> = {}
  for (const t of txChart || []) {
    const m = t.date.substring(0, 7)
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0 }
    if (t.type === 'income')  monthlyMap[m].income   += Number(t.amount)
    if (t.type === 'expense') monthlyMap[m].expenses += Number(t.amount)
  }
  const monthlyChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = d.toISOString().substring(0, 7)
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), ...(monthlyMap[key] || { income: 0, expenses: 0 }) }
  })

  const catMap: Record<string, number> = {}
  for (const t of txChart || []) {
    if (t.type === 'expense') {
      const cat = t.category || 'Other'
      catMap[cat] = (catMap[cat] || 0) + Number(t.amount)
    }
  }
  const donutData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i] }))

  // — Operations metrics —
  const tier            = sub?.plan ? TIER_INFO[sub.plan] : null
  const maxConsultants  = tier?.consultants ?? 0
  const overdueTasks    = (tasks || []).filter(t => t.due_date && t.due_date < todayStr).length
  const pipelineValue   = (leads || []).reduce((s, l) => s + Number(l.est_value), 0)
  const hotLeads        = (leads || []).filter(l => l.heat === 'hot').length

  // — Alerts —
  const billsOverdue  = (bills  || []).filter(b => b.due_date < todayStr)
  const taxesOverdue  = (taxes  || []).filter(t => t.due_date < todayStr)
  const hasAlerts     = overdueInvoices > 0 || billsOverdue.length > 0 || taxesOverdue.length > 0

  return (
    <div className="text-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Master Hub'}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isInternal ? (
              <span className="px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wide bg-blue-50 text-[#0F4C81]">
                Platinum · Internal
              </span>
            ) : tier ? (
              <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wide ${tier.color}`}>
                {tier.label} · {tier.price}
              </span>
            ) : (
              <Link href="/accounting/checkout" className="bg-[#C9A02E] hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">
                ★ Upgrade
              </Link>
            )}
          </div>
        </div>

        {/* ── Alerts ── */}
        {hasAlerts && (
          <div className="space-y-2">
            {overdueInvoices > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center">
                <span>⚠️ <strong>{overdueInvoices}</strong> invoice{overdueInvoices > 1 ? 's are' : ' is'} overdue</span>
                <Link href="/accounting/invoices?status=overdue" className="font-semibold hover:underline">Review →</Link>
              </div>
            )}
            {billsOverdue.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center">
                <span>⚠️ <strong>{billsOverdue.length}</strong> bill{billsOverdue.length > 1 ? 's are' : ' is'} past due</span>
                <Link href="/accounting/bills" className="font-semibold hover:underline">Pay Now →</Link>
              </div>
            )}
            {taxesOverdue.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center">
                <span>🚨 <strong>{taxesOverdue.length}</strong> tax obligation{taxesOverdue.length > 1 ? 's are' : ' is'} overdue</span>
                <Link href="/accounting/tax" className="font-semibold hover:underline">File Now →</Link>
              </div>
            )}
          </div>
        )}

        {/* ── Financial KPIs ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Financials</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Revenue This Month',  value: fmtShort(monthIncome),        sub: `${fmtShort(totalIncome)} all-time`,          color: 'text-green-700',  href: '/accounting/transactions' },
              { label: 'Expenses This Month', value: fmtShort(monthExpenses),       sub: `${fmtShort(totalExpenses)} all-time`,        color: 'text-red-600',    href: '/accounting/transactions' },
              { label: 'Accounts Payable',    value: fmtShort(totalUnpaidBills),    sub: totalUnpaidBills > 0 ? 'unpaid bills' : 'All bills paid', color: totalUnpaidBills > 0 ? 'text-orange-500' : 'text-gray-400', href: '/accounting/bills' },
              { label: 'Net Profit',          value: fmtShort(netProfit),           sub: netProfit >= 0 ? 'Before bills' : 'Net loss', color: netProfit >= 0 ? 'text-green-700' : 'text-red-600', href: '/accounting/reports' },
              { label: 'Grand Net',           value: fmtShort(grandNet),            sub: 'After all obligations',                       color: grandNet >= 0 ? 'text-green-700' : 'text-red-600', href: '/accounting/ledger' },
            ].map((c, i) => (
              <Link key={i} href={c.href} className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 hover:border-[#0F4C81] hover:shadow-sm transition">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{c.label}</p>
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">{c.sub}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/hub/tasks', icon: '✅', label: 'Add Task', sub: 'Track your work' },
            { href: '/hub/leads', icon: '🔥', label: 'Add Lead', sub: 'Manage pipeline' },
            { href: '/accounting/invoices/new', icon: '📄', label: 'New Invoice', sub: 'Bill a customer' },
            { href: '/accounting/transactions', icon: '💰', label: 'Log Transaction', sub: 'Record income/expense' },
            { href: '/hub/team', icon: '👥', label: 'Team', sub: 'Manage members' },
            { href: '/hub/formation', icon: '🏛️', label: 'Formation', sub: 'Set up your entity' },
            { href: '/hub/documents', icon: '📁', label: 'Documents', sub: 'Vault & file storage' },
            { href: '/accounting/payroll', icon: '👔', label: 'Payroll', sub: 'Run employee payroll' },
          ].map(({ href, icon, label, sub }) => (
            <Link key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 hover:border-[#0F4C81] hover:shadow-sm transition">
              <span className="text-xl sm:text-2xl shrink-0">{icon}</span>
              <div className="min-w-0"><p className="font-semibold text-xs sm:text-sm truncate">{label}</p><p className="text-xs text-gray-400 truncate hidden sm:block">{sub}</p></div>
            </Link>
          ))}
        </div>

        {/* ── Operations KPIs ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Operations</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Tasks',   value: String((tasks || []).length), color: 'text-[#0F4C81]', href: '/hub/tasks' },
              { label: 'Hot Leads',      value: String(hotLeads),             color: 'text-red-600',   href: '/hub/leads' },
              { label: 'Tasks Overdue',  value: String(overdueTasks),         color: overdueTasks > 0 ? 'text-red-600' : 'text-gray-400', href: '/hub/tasks' },
              { label: 'Pipeline Value', value: fmtShort(pipelineValue),      color: 'text-green-700', href: '/hub/leads' },
            ].map((c, i) => (
              <Link key={i} href={c.href} className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 hover:border-[#0F4C81] hover:shadow-sm transition">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{c.label}</p>
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800">Revenue vs Expenses</h2>
              <Link href="/accounting/reports" className="text-xs text-[#0F4C81] hover:underline">Full report →</Link>
            </div>
            <MonthlyBarChart data={monthlyChartData} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800">Expense Breakdown</h2>
              <span className="text-xs text-gray-400">6 months</span>
            </div>
            {donutData.length > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <DonutChart data={donutData} size={120} />
                <div className="w-full space-y-1.5">
                  {donutData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-gray-600 truncate max-w-[100px]">{d.label}</span>
                      </div>
                      <span className="font-medium text-gray-700">${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-36 text-gray-300 text-sm">No expense data yet</div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { href: '/accounting/invoices/new',  icon: '📄', label: 'New Invoice' },
              { href: '/accounting/transactions',  icon: '💰', label: 'Log Transaction' },
              { href: '/accounting/scanner',       icon: '🤖', label: 'AI Scanner' },
              { href: '/accounting/bills',         icon: '🧾', label: 'Pay a Bill' },
              { href: '/hub/tasks',                icon: '✅', label: 'Add Task' },
              { href: '/hub/leads',                icon: '🔥', label: 'Add Lead' },
              { href: '/accounting/payroll',       icon: '👔', label: 'Payroll' },
              { href: '/accounting/estimates',     icon: '📋', label: 'Estimates' },
              { href: '/accounting/reconcile',     icon: '✔️', label: 'Reconcile' },
              { href: '/accounting/reports',       icon: '📊', label: 'Reports' },
              { href: '/accounting/forecast',      icon: '📈', label: 'Cash Forecast' },
              { href: '/accounting/tax',           icon: '💸', label: 'Tax Center' },
              { href: '/accounting/vendors',       icon: '🏢', label: 'Vendors / 1099' },
              { href: '/accounting/customers',     icon: '👥', label: 'Customers' },
              { href: '/accounting/inventory',     icon: '🗃️', label: 'Inventory' },
              { href: '/accounting/projects',      icon: '🏗️', label: 'Projects' },
              { href: '/accounting/budgets',       icon: '🎯', label: 'Budgets' },
              { href: '/accounting/connect',       icon: '🏦', label: 'Connect Bank' },
              { href: '/hub/team',                 icon: '👥', label: 'Team' },
              { href: '/hub/formation',            icon: '🏛️', label: 'Formation' },
              { href: '/hub/documents',            icon: '📁', label: 'Documents' },
              { href: '/accounting/clients',       icon: '🔗', label: 'Client Portals' },
              { href: '/accounting/purchaseorders',icon: '📦', label: 'Purchase Orders' },
              { href: '/accounting/tracker',       icon: '🚗', label: 'Mileage & Time' },
              { href: '/accounting/recurring',     icon: '🔁', label: 'Recurring' },
              { href: '/accounting/journal',       icon: '📝', label: 'Journal Entries' },
              { href: '/accounting/aged-receivables', icon: '⏱️', label: 'Aged Receivables' },
              { href: '/accounting/rules',         icon: '⚡', label: 'Auto Rules' },
              { href: '/accounting/ledger',         icon: '📒', label: 'General Ledger' },
              { href: '/accounting/coa',           icon: '≡',  label: 'Chart of Accounts' },
              { href: '/accounting/audit',         icon: '🔒', label: 'Audit Trail' },
              { href: '/api/export?type=transactions', icon: '⬇️', label: 'Export CSV' },
              { href: '/hub/consultants',          icon: '🤖', label: 'AI Consultants' },
            ].map(({ href, icon, label }) => (
              <Link key={href} href={href}
                className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2.5 hover:border-[#0F4C81] hover:shadow-sm transition text-sm">
                <span className="text-lg shrink-0">{icon}</span>
                <span className="font-medium text-gray-700 leading-tight text-xs">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Recent Transactions</h2>
              <Link href="/accounting/transactions" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
            </div>
            {recentTx && recentTx.length > 0 ? (
              <div className="overflow-x-auto -mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-xs uppercase">
                      <th className="p-2 sm:p-3 text-left font-medium">Date</th>
                      <th className="p-2 sm:p-3 text-left font-medium">Description</th>
                      <th className="p-2 sm:p-3 text-left font-medium hidden sm:table-cell">Category</th>
                      <th className="p-2 sm:p-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTx.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="p-2 sm:p-3 text-gray-400 text-xs">{t.date}</td>
                        <td className="p-2 sm:p-3 font-medium text-gray-800 truncate max-w-[80px] sm:max-w-[160px]">{t.description}</td>
                        <td className="p-2 sm:p-3 hidden sm:table-cell">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">{t.category || 'Uncategorized'}</span>
                        </td>
                        <td className={`p-2 sm:p-3 text-right font-mono font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm mb-3">No transactions yet</p>
                <Link href="/accounting/transactions" className="btn-primary text-sm">Add First Transaction</Link>
              </div>
            )}
          </div>

          {/* Right column: Invoices + Bills */}
          <div className="space-y-4">
            {/* Invoice summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-gray-800">Invoices</h2>
                <Link href="/accounting/invoices" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
              </div>
              <div className="p-5 space-y-2.5">
                {[
                  { label: 'Draft',   status: 'draft',   color: 'bg-gray-100 text-gray-600' },
                  { label: 'Sent',    status: 'sent',    color: 'bg-blue-100 text-blue-700' },
                  { label: 'Paid',    status: 'paid',    color: 'bg-green-100 text-green-700' },
                  { label: 'Overdue', status: 'overdue', color: 'bg-red-100 text-red-700' },
                ].map(({ label, status, color }) => {
                  const count = (invoices || []).filter(i => i.status === status).length
                  const total = (invoices || []).filter(i => i.status === status).reduce((s, i) => s + Number(i.total), 0)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
                        <span className="text-xs text-gray-400">{count}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{fmtShort(total)}</span>
                    </div>
                  )
                })}
                <Link href="/accounting/invoices/new"
                  className="block text-center w-full mt-3 py-2 rounded-lg bg-[#0F4C81] hover:bg-[#082D4F] text-white text-xs font-bold transition">
                  + New Invoice
                </Link>
              </div>
            </div>

            {/* Unpaid bills */}
            {bills && bills.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="font-bold text-gray-800">Unpaid Bills</h2>
                  <Link href="/accounting/bills" className="text-sm text-[#0F4C81] hover:underline">Manage</Link>
                </div>
                <div className="p-4 space-y-2">
                  {bills.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className={`text-gray-500 text-xs ${b.due_date < todayStr ? 'text-red-500 font-medium' : ''}`}>{b.due_date}</span>
                      <span className="font-semibold text-red-600 text-xs">{fmt(b.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                    <span className="text-gray-700">Total Due</span>
                    <span className="text-red-600">{fmt(bills.reduce((s, b) => s + Number(b.amount), 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom grid: Tasks + Leads + Consultants ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Active Tasks</h2>
              <Link href="/hub/tasks" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
            </div>
            {tasks && tasks.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {tasks.map(t => (
                  <div key={t.id} className="p-4 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      t.priority === 'urgent' ? 'bg-red-500' :
                      t.priority === 'high'   ? 'bg-orange-400' :
                      t.priority === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800">{t.title}</p>
                      {t.due_date && (
                        <p className={`text-xs ${t.due_date < todayStr ? 'text-red-500' : 'text-gray-400'}`}>Due {t.due_date}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm mb-3">No active tasks</p>
                <Link href="/hub/tasks" className="btn-primary text-sm">Add First Task</Link>
              </div>
            )}
          </div>

          {/* Lead Pipeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Lead Pipeline</h2>
              <Link href="/hub/leads" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
            </div>
            {leads && leads.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {leads.map(lead => (
                  <div key={lead.id} className="p-4 flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      lead.heat === 'hot'  ? 'bg-red-100 text-red-600' :
                      lead.heat === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-100 text-blue-600'
                    }`}>{lead.heat}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800">{lead.business_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{lead.status.replace('_', ' ')}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-gray-700 shrink-0">${Number(lead.est_value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm mb-3">No leads yet</p>
                <Link href="/hub/leads" className="btn-primary text-sm">Add First Lead</Link>
              </div>
            )}
          </div>

          {/* Subscription + AI Consultants */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 mb-3">Subscription</h2>
              {isInternal ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="px-3 py-1 rounded-full font-bold text-xs uppercase bg-blue-100 text-[#0F4C81]">Platinum</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">active</span>
                    <span className="text-xs text-gray-500">Internal — No charge</span>
                  </div>
                  <p className="text-xs text-gray-400">Phantom internal access — full platform included for IEBC staff.</p>
                </div>
              ) : sub && tier ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase ${tier.color}`}>{tier.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{sub.status}</span>
                    <span className="text-xs text-gray-500">{tier.price}</span>
                  </div>
                  {sub.current_period_end && (
                    <p className="text-xs text-gray-400">Renews {new Date(sub.current_period_end).toLocaleDateString()}</p>
                  )}
                  <Link href="/accounting/checkout" className="text-xs text-[#0F4C81] hover:underline font-medium">Change plan →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-500 text-sm">No active subscription.</p>
                  <Link href="/accounting/checkout" className="btn-primary text-sm inline-block">Upgrade Now</Link>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">AI Consultants</h2>
                {maxConsultants > 0 && (
                  <span className="text-xs text-gray-400">{consultants?.length ?? 0}/{maxConsultants}</span>
                )}
              </div>
              {maxConsultants === 0 ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Requires Gold or Platinum plan.</p>
                  <Link href="/accounting/checkout" className="text-xs text-[#0F4C81] font-semibold hover:underline">Upgrade to unlock →</Link>
                </div>
              ) : consultants && consultants.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {consultants.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-[#0F4C81] rounded-full text-xs font-medium">{c.department}</span>
                  ))}
                  {maxConsultants > (consultants?.length ?? 0) && (
                    <span className="px-2.5 py-1 border border-dashed border-gray-200 text-gray-400 rounded-full text-xs">
                      +{maxConsultants - (consultants?.length ?? 0)} available
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">{tier?.label} includes {maxConsultants} consultant{maxConsultants > 1 ? 's' : ''}. Contact support to assign.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
