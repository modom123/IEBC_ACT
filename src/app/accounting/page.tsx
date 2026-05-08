import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MonthlyBarChart, DonutChart } from '@/components/Charts'

const DONUT_COLORS = ['#0F4C81','#2563eb','#7c3aed','#db2777','#ea580c','#16a34a']

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n)

export default async function Accounting() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/auth/login')
  let supabase: ReturnType<typeof createServerSupabaseClient>
  try { supabase = createServerSupabaseClient() } catch { redirect('/auth/login') }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const userId = session.user.id
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  const [
    { data: profile },
    { data: sub },
    { data: txAll },
    { data: txMonth },
    { data: txChart },
    { data: invoices },
    { data: recentTx },
    { data: bills },
    { data: taxes },
    { data: payrollRuns },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).single(),
    supabase.from('subscriptions').select('plan,status').eq('user_id', userId).maybeSingle(),
    supabase.from('transactions').select('type,amount').eq('user_id', userId),
    supabase.from('transactions').select('type,amount').eq('user_id', userId).gte('date', firstOfMonth),
    supabase.from('transactions').select('date,type,amount,category').eq('user_id', userId).gte('date', sixMonthsAgo),
    supabase.from('invoices').select('status,total,amount_paid').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(10),
    supabase.from('bills').select('amount,due_date,status,vendor').eq('user_id', userId).eq('status', 'unpaid').order('due_date'),
    supabase.from('tax_obligations').select('amount,due_date,status,tax_type').eq('user_id', userId).neq('status', 'paid').order('due_date').limit(5),
    supabase.from('payroll_runs').select('total_gross,pay_period_end,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
  ])

  const isInternal = profile?.role === 'admin' || profile?.role === 'iebc_staff'
  const plan = isInternal ? 'platinum' : (sub?.plan ?? 'silver')
  const planRank = plan === 'platinum' ? 3 : plan === 'gold' ? 2 : 1

  // ── KPIs ──────────────────────────────────────────────────────────────
  const totalIncome   = (txAll || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = (txAll || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const netProfit     = totalIncome - totalExpenses
  const totalUnpaidBills = (bills || []).reduce((s, b) => s + Number(b.amount), 0)
  const grandNet      = netProfit - totalUnpaidBills
  const monthIncome   = (txMonth || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpenses = (txMonth || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const outstanding   = (invoices || []).filter(i => i.status !== 'paid' && i.status !== 'void').reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0)
  const overdueCount  = (invoices || []).filter(i => i.status === 'overdue').length
  const billsOverdue  = (bills || []).filter(b => b.due_date < today)
  const taxesOverdue  = (taxes || []).filter(t => t.due_date < today)
  const ytdPayroll    = (payrollRuns || []).reduce((s, r) => s + Number(r.total_gross || 0), 0)

  // ── Chart data ────────────────────────────────────────────────────────
  const monthlyMap: Record<string, { income: number; expenses: number }> = {}
  for (const t of txChart || []) {
    const m = t.date.substring(0, 7)
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0 }
    if (t.type === 'income') monthlyMap[m].income += Number(t.amount)
    if (t.type === 'expense') monthlyMap[m].expenses += Number(t.amount)
  }
  const monthlyChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = d.toISOString().substring(0, 7)
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), ...(monthlyMap[key] || { income: 0, expenses: 0 }) }
  })

  const catMap: Record<string, number> = {}
  for (const t of txChart || []) {
    if (t.type === 'expense') { const cat = t.category || 'Other'; catMap[cat] = (catMap[cat] || 0) + Number(t.amount) }
  }
  const donutData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i] }))

  // ── Shared sub-components ─────────────────────────────────────────────
  const RecentTransactions = ({ limit = 8 }: { limit?: number }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Recent Transactions</h2>
        <Link href="/accounting/transactions" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
      </div>
      {recentTx && recentTx.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-400 text-xs uppercase">
              <th className="p-2 sm:p-3 text-left font-semibold">Date</th>
              <th className="p-2 sm:p-3 text-left font-semibold">Description</th>
              <th className="p-2 sm:p-3 text-left hidden sm:table-cell font-semibold">Category</th>
              <th className="p-2 sm:p-3 text-right font-semibold">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {recentTx.slice(0, limit).map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-2 sm:p-3 text-gray-400 text-xs">{t.date}</td>
                  <td className="p-2 sm:p-3 font-medium truncate max-w-[100px] sm:max-w-none text-gray-800">{t.description}</td>
                  <td className="p-2 sm:p-3 hidden sm:table-cell"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">{t.category || 'Uncategorized'}</span></td>
                  <td className={`p-2 sm:p-3 text-right font-mono font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-10 text-center">
          <p className="font-semibold text-gray-600 mb-1">No transactions yet</p>
          <p className="text-sm text-gray-400 mb-4">Add your first transaction to get started.</p>
          <Link href="/accounting/transactions" className="btn-primary text-sm">Add Transaction</Link>
        </div>
      )}
    </div>
  )

  const InvoicePanel = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Invoices</h2>
        <Link href="/accounting/invoices" className="text-sm text-[#0F4C81] hover:underline">View all</Link>
      </div>
      <div className="p-4 space-y-2.5">
        {([
          { label: 'Draft',   status: 'draft',   color: 'bg-gray-100 text-gray-600' },
          { label: 'Sent',    status: 'sent',    color: 'bg-blue-100 text-blue-700' },
          { label: 'Paid',    status: 'paid',    color: 'bg-green-100 text-green-700' },
          { label: 'Overdue', status: 'overdue', color: 'bg-red-100 text-red-700' },
        ] as const).map(({ label, status, color }) => {
          const count = (invoices || []).filter(i => i.status === status).length
          const total = (invoices || []).filter(i => i.status === status).reduce((s, i) => s + Number(i.total), 0)
          return (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
                <span className="text-xs text-gray-400">{count}</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">{fmt(total)}</span>
            </div>
          )
        })}
        <Link href="/accounting/invoices/new" className="block text-center btn-primary text-sm mt-2">+ New Invoice</Link>
      </div>
    </div>
  )

  const BillsPanel = () => bills && bills.length > 0 ? (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Unpaid Bills</h2>
        <Link href="/accounting/bills" className="text-sm text-[#0F4C81] hover:underline">Manage</Link>
      </div>
      <div className="p-4 space-y-2">
        {bills.slice(0, 5).map((b, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <div>
              <p className="font-medium text-gray-700 truncate max-w-[130px]">{b.vendor || 'Unknown'}</p>
              <p className={`text-xs ${b.due_date < today ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{b.due_date < today ? '⚠ Overdue' : `Due ${b.due_date}`}</p>
            </div>
            <span className="font-semibold text-red-600 shrink-0">{fmt(Number(b.amount))}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
          <span className="text-gray-600">Total Due</span>
          <span className="text-red-600">{fmt(totalUnpaidBills)}</span>
        </div>
      </div>
    </div>
  ) : null

  const ChartsRow = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800">Revenue vs Expenses</h2>
          <span className="text-xs text-gray-400">Last 6 months</span>
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
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600 truncate max-w-[110px]">{d.label}</span>
                  </div>
                  <span className="font-medium text-gray-700">${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">📊</span>
            <p className="text-sm text-gray-400">No expense data yet</p>
          </div>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // SILVER DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (planRank === 1) return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-5 text-slate-900">

      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-400">Silver Plan · {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/accounting/checkout" className="text-xs bg-[#C8902A] hover:bg-[#b07820] text-white px-3 py-1.5 rounded-lg font-semibold transition">
          ★ Upgrade to Gold
        </Link>
      </div>

      {/* Invoice overdue alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>⚠️ <strong>{overdueCount}</strong> invoice{overdueCount > 1 ? 's are' : ' is'} overdue</span>
          <Link href="/accounting/invoices" className="font-semibold hover:underline">Review →</Link>
        </div>
      )}
      {billsOverdue.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center">
          <span>⚠️ <strong>{billsOverdue.length}</strong> bill{billsOverdue.length > 1 ? 's are' : ' is'} past due</span>
          <Link href="/accounting/bills" className="font-semibold hover:underline">Pay Now →</Link>
        </div>
      )}

      {/* 3 KPI cards — this month focus */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Revenue This Month',  value: fmt(monthIncome),   sub: `${fmt(totalIncome)} all time`,   color: 'text-green-700',  bar: monthIncome,   barColor: 'bg-green-400' },
          { label: 'Expenses This Month', value: fmt(monthExpenses), sub: `${fmt(totalExpenses)} all time`, color: 'text-red-600',    bar: monthExpenses, barColor: 'bg-red-400' },
          { label: 'Outstanding Invoices',value: fmt(outstanding),   sub: overdueCount > 0 ? `${overdueCount} overdue` : 'All current', color: outstanding > 0 ? 'text-amber-600' : 'text-green-700', bar: outstanding, barColor: 'bg-amber-400' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/accounting/transactions', icon: '💰', label: 'Add Transaction' },
            { href: '/accounting/invoices/new', icon: '📄', label: 'New Invoice' },
            { href: '/accounting/scanner',      icon: '✦',  label: 'AI Scanner' },
            { href: '/accounting/connect',      icon: '🏦', label: 'Bank & Cards' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2.5 hover:border-[#0F4C81] hover:shadow-sm transition text-sm">
              <span className="text-lg">{icon}</span>
              <span className="font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Transactions + Invoice panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RecentTransactions limit={5} /></div>
        <InvoicePanel />
      </div>

      {/* Upgrade banner */}
      <div className="bg-gradient-to-r from-[#0F4C81] to-[#1a6cb8] rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg">Unlock Gold — $22/mo</p>
            <p className="text-blue-200 text-sm mt-1">Revenue charts · Bank reconciliation · Tax center · Recurring transactions · Budgets & more</p>
          </div>
          <Link href="/accounting/checkout" className="shrink-0 bg-[#C8902A] hover:bg-[#b07820] text-white px-5 py-2.5 rounded-lg font-semibold transition text-sm whitespace-nowrap">
            Upgrade Now →
          </Link>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // GOLD DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (planRank === 2) return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5 text-slate-900">

      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-400">Gold Plan · {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/accounting/checkout" className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold transition">
          ★ Upgrade to Platinum
        </Link>
      </div>

      {/* Alerts */}
      {(overdueCount > 0 || billsOverdue.length > 0) && (
        <div className="space-y-2">
          {overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center">
              <span>⚠️ <strong>{overdueCount}</strong> invoice{overdueCount > 1 ? 's are' : ' is'} overdue</span>
              <Link href="/accounting/invoices" className="font-semibold hover:underline">Review →</Link>
            </div>
          )}
          {billsOverdue.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center">
              <span>⚠️ <strong>{billsOverdue.length}</strong> bill{billsOverdue.length > 1 ? 's are' : ' is'} past due</span>
              <Link href="/accounting/bills" className="font-semibold hover:underline">Pay Now →</Link>
            </div>
          )}
        </div>
      )}

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue',    value: fmt(totalIncome),      sub: `${fmtK(monthIncome)} this month`,   color: 'text-green-700', icon: '↑', iconCls: 'text-green-500 bg-green-50' },
          { label: 'Total Expenses',   value: fmt(totalExpenses),    sub: `${fmtK(monthExpenses)} this month`, color: 'text-red-600',   icon: '↓', iconCls: 'text-red-400 bg-red-50' },
          { label: 'Net Profit',       value: fmt(netProfit),        sub: netProfit >= 0 ? 'Profitable' : 'Net loss', color: netProfit >= 0 ? 'text-green-700' : 'text-red-600', icon: '=', iconCls: netProfit >= 0 ? 'text-green-500 bg-green-50' : 'text-red-400 bg-red-50' },
          { label: 'Outstanding',      value: fmt(outstanding),      sub: overdueCount > 0 ? `${overdueCount} overdue` : 'All current', color: outstanding > 0 ? 'text-amber-600' : 'text-gray-500', icon: '▤', iconCls: 'text-amber-500 bg-amber-50' },
          { label: 'Accounts Payable', value: fmt(totalUnpaidBills), sub: totalUnpaidBills > 0 ? `${bills?.length} unpaid bills` : 'All paid', color: totalUnpaidBills > 0 ? 'text-orange-600' : 'text-green-700', icon: '⊠', iconCls: 'text-orange-400 bg-orange-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{card.label}</p>
              <span className={`text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${card.iconCls}`}>{card.icon}</span>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <ChartsRow />

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { href: '/accounting/transactions', icon: '💰', label: 'Transaction' },
            { href: '/accounting/invoices/new', icon: '📄', label: 'New Invoice' },
            { href: '/accounting/bills',        icon: '🧾', label: 'Pay Bill' },
            { href: '/accounting/scanner',      icon: '✦',  label: 'AI Scanner' },
            { href: '/accounting/vendors',      icon: '🏢', label: 'Vendors' },
            { href: '/accounting/tax',          icon: '💸', label: 'Tax Center' },
            { href: '/accounting/reconcile',    icon: '⇌',  label: 'Reconcile' },
            { href: '/accounting/reports',      icon: '📊', label: 'Reports' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-[#0F4C81] hover:shadow-sm transition text-center">
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Transactions + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RecentTransactions limit={8} /></div>
        <div className="space-y-4">
          <InvoicePanel />
          <BillsPanel />
        </div>
      </div>

      {/* Upgrade banner */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg">Unlock Platinum — $42/mo</p>
            <p className="text-purple-200 text-sm mt-1">Payroll management · Full ledger & journal · Tax center & 1099s · Inventory · Purchase orders · Audit trail</p>
          </div>
          <Link href="/accounting/checkout" className="shrink-0 bg-white text-purple-700 hover:bg-purple-50 px-5 py-2.5 rounded-lg font-bold transition text-sm whitespace-nowrap">
            Upgrade Now →
          </Link>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // PLATINUM / INTERNAL DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5 text-slate-900">

      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-400">
            {isInternal ? 'Platinum · Internal' : 'Platinum Plan'} · {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${isInternal ? 'bg-[#0F4C81] text-white' : 'bg-purple-600 text-white'}`}>
            {isInternal ? '⚡ Internal Access' : '★ Platinum'}
          </span>
        </div>
      </div>

      {/* Alerts row */}
      {(overdueCount > 0 || billsOverdue.length > 0 || taxesOverdue.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {overdueCount > 0 && (
            <Link href="/accounting/invoices" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center hover:bg-red-100 transition">
              <span>⚠️ <strong>{overdueCount}</strong> overdue invoice{overdueCount > 1 ? 's' : ''}</span>
              <span className="font-semibold">Fix →</span>
            </Link>
          )}
          {billsOverdue.length > 0 && (
            <Link href="/accounting/bills" className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center hover:bg-orange-100 transition">
              <span>⚠️ <strong>{billsOverdue.length}</strong> overdue bill{billsOverdue.length > 1 ? 's' : ''}</span>
              <span className="font-semibold">Pay →</span>
            </Link>
          )}
          {taxesOverdue.length > 0 && (
            <Link href="/accounting/tax" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between items-center hover:bg-red-100 transition">
              <span>🚨 <strong>{taxesOverdue.length}</strong> overdue tax obligation{taxesOverdue.length > 1 ? 's' : ''}</span>
              <span className="font-semibold">File →</span>
            </Link>
          )}
        </div>
      )}

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Revenue',    value: fmtK(totalIncome),      sub: `${fmtK(monthIncome)} this month`,   color: 'text-green-700', icon: '↑', iconCls: 'text-green-500 bg-green-50' },
          { label: 'Total Expenses',   value: fmtK(totalExpenses),    sub: `${fmtK(monthExpenses)} this month`, color: 'text-red-600',   icon: '↓', iconCls: 'text-red-400 bg-red-50' },
          { label: 'Accounts Payable', value: fmtK(totalUnpaidBills), sub: `${bills?.length ?? 0} bills unpaid`,color: totalUnpaidBills > 0 ? 'text-orange-600' : 'text-gray-500', icon: '⊠', iconCls: 'text-orange-400 bg-orange-50' },
          { label: 'Net Profit',       value: fmtK(netProfit),        sub: netProfit >= 0 ? 'Before obligations' : 'Net loss', color: netProfit >= 0 ? 'text-green-700' : 'text-red-600', icon: '=', iconCls: netProfit >= 0 ? 'text-green-500 bg-green-50' : 'text-red-400 bg-red-50' },
          { label: 'Grand Net',        value: fmtK(grandNet),         sub: 'After all obligations', color: grandNet >= 0 ? 'text-green-700' : 'text-red-600', icon: '★', iconCls: grandNet >= 0 ? 'text-green-500 bg-green-50' : 'text-red-400 bg-red-50' },
          { label: 'Payroll YTD',      value: fmtK(ytdPayroll),       sub: `${payrollRuns?.length ?? 0} runs this year`, color: 'text-blue-700', icon: '◫', iconCls: 'text-blue-500 bg-blue-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold uppercase tracking-wide leading-tight">{card.label}</p>
              <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${card.iconCls}`}>{card.icon}</span>
            </div>
            <p className={`text-lg sm:text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <ChartsRow />

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {[
            { href: '/accounting/transactions', icon: '💰', label: 'Transaction' },
            { href: '/accounting/invoices/new', icon: '📄', label: 'Invoice' },
            { href: '/accounting/bills',        icon: '🧾', label: 'Pay Bill' },
            { href: '/accounting/scanner',      icon: '✦',  label: 'AI Scan' },
            { href: '/accounting/payroll',      icon: '👔', label: 'Payroll' },
            { href: '/accounting/vendors',      icon: '🏢', label: 'Vendors' },
            { href: '/accounting/tax',          icon: '💸', label: 'Tax' },
            { href: '/accounting/journal',      icon: '⊟', label: 'Journal' },
            { href: '/accounting/reports',      icon: '📊', label: 'Reports' },
            { href: '/accounting/coa',          icon: '≡',  label: 'Chart of Accts' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-2.5 flex flex-col items-center gap-1 hover:border-[#0F4C81] hover:shadow-sm transition text-center">
              <span className="text-lg">{icon}</span>
              <span className="text-[10px] font-medium text-gray-600 leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RecentTransactions limit={10} /></div>
        <div className="space-y-4">
          <InvoicePanel />
          <BillsPanel />
          {taxes && taxes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-gray-800">Tax Obligations</h2>
                <Link href="/accounting/tax" className="text-sm text-[#0F4C81] hover:underline">Manage</Link>
              </div>
              <div className="p-4 space-y-2">
                {taxes.slice(0, 4).map((t, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-medium text-gray-700 capitalize">{(t.tax_type || 'Tax').replace(/_/g, ' ')}</p>
                      <p className={`text-xs ${t.due_date < today ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{t.due_date < today ? '⚠ Overdue' : `Due ${t.due_date}`}</p>
                    </div>
                    <span className="font-semibold text-gray-700 shrink-0">{fmt(Number(t.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {payrollRuns && payrollRuns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-gray-800">Recent Payroll</h2>
                <Link href="/accounting/payroll" className="text-sm text-[#0F4C81] hover:underline">Manage</Link>
              </div>
              <div className="p-4 space-y-2">
                {payrollRuns.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.pay_period_end || r.created_at?.split('T')[0]}</span>
                    <span className="font-semibold text-gray-700">{fmt(Number(r.total_gross))}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                  <span className="text-gray-500">YTD Total</span>
                  <span className="text-[#0F4C81]">{fmt(ytdPayroll)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
