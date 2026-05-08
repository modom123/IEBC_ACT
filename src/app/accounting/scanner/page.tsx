'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import AccountingShell from '@/components/AccountingShell'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories'

type ScanResult = {
  document_type: string
  confidence: string
  raw_text_summary: string | null
  is_financial: boolean
  vendor: string | null
  amount: number | null
  subtotal: number | null
  tax_amount: number | null
  date: string | null
  due_date: string | null
  invoice_number: string | null
  category: string | null
  type: string | null
  description: string | null
  line_items: Array<{ description: string; qty: number; unit_price: number; amount: number }>
  full_name: string | null
  id_number: string | null
  address: string | null
  date_of_birth: string | null
  expiration_date: string | null
  issuing_authority: string | null
  document_title: string | null
  parties: string[]
  key_dates: Array<{ label: string; date: string }>
  notary: string | null
  case_or_reference_number: string | null
}

type PostMode = 'transaction' | 'bill'

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: 'Receipt', invoice: 'Invoice', bill: 'Bill', contract: 'Contract',
  legal: 'Legal Document', id_card: 'ID / License', bank_statement: 'Bank Statement',
  tax_form: 'Tax Form', payroll: 'Payroll', purchase_order: 'Purchase Order',
  estimate: 'Estimate', insurance: 'Insurance', other: 'Document',
}
const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-red-100 text-red-700',
}
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf'
const today = () => new Date().toISOString().split('T')[0]

function normalizeCategory(raw: string | null, type: string): string {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
  if (!raw) return type === 'income' ? 'Other Income' : 'Miscellaneous'
  const match = all.find(c => c.toLowerCase().includes(raw.toLowerCase().split(' ')[0]) || raw.toLowerCase().includes(c.toLowerCase().split(' ')[0]))
  return match || (type === 'income' ? 'Other Income' : 'Miscellaneous')
}

export default function ScannerPage() {
  const [dragging, setDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [result,   setResult]   = useState<ScanResult | null>(null)
  const [error,    setError]    = useState('')
  const [fileName, setFileName] = useState('')
  const [posted,   setPosted]   = useState(false)
  const [posting,  setPosting]  = useState(false)
  const [postMode, setPostMode] = useState<PostMode>('transaction')
  const [usage,    setUsage]    = useState<{ used: number; limit: number | null; plan: string; isInternal: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Editable approval form fields
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    date: today(),
    due_date: today(),
    vendor: '',
    description: '',
    amount: '',
    category: 'Miscellaneous',
    notes: '',
    reference: '',
  })

  useEffect(() => {
    fetch('/api/accounting/scanner')
      .then(r => r.json())
      .then(d => { if (!d.error) setUsage(d) })
      .catch(() => {})
  }, [posted])

  // When a scan result comes back, pre-fill the form
  useEffect(() => {
    if (!result) return
    const isBillType = result.document_type === 'bill' || result.document_type === 'purchase_order'
    const txType = result.type === 'income' ? 'income' : 'expense'
    setPostMode(isBillType ? 'bill' : 'transaction')
    setForm({
      type:        txType,
      date:        result.date || today(),
      due_date:    result.due_date || result.date || today(),
      vendor:      result.vendor || '',
      description: result.description || result.vendor || DOC_TYPE_LABELS[result.document_type] || 'Scanned document',
      amount:      result.amount != null ? String(result.amount) : '',
      category:    normalizeCategory(result.category, txType),
      notes:       result.raw_text_summary || '',
      reference:   result.invoice_number || '',
    })
  }, [result])

  const scan = useCallback(async (file: File) => {
    setResult(null); setError(''); setPosted(false); setFileName(file.name)
    setScanning(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/accounting/scanner', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.status === 429 && data.limit_reached) { setError(data.error); return }
      if (!res.ok || data.error) { setError(data.error || 'Scan failed. Please try again.'); return }
      setResult(data)
    } finally { setScanning(false) }
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) scan(file)
    e.target.value = ''
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) scan(file)
  }
  function reset() {
    setResult(null); setError(''); setFileName(''); setPosted(false)
  }

  async function approve() {
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount is required.'); return }
    setPosting(true); setError('')
    try {
      let res: Response
      if (postMode === 'transaction') {
        res = await fetch('/api/accounting/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date:        form.date,
            description: form.description,
            vendor:      form.vendor,
            amount:      parseFloat(form.amount),
            type:        form.type,
            category:    form.category,
            notes:       form.notes,
          }),
        })
      } else {
        res = await fetch('/api/accounting/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor:           form.vendor || 'Unknown Vendor',
            description:      form.description,
            amount:           parseFloat(form.amount),
            due_date:         form.due_date,
            category:         form.category,
            reference_number: form.reference,
            notes:            form.notes,
          }),
        })
      }
      if (res.ok) {
        setPosted(true)
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to post. Please try again.')
      }
    } finally { setPosting(false) }
  }

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <AccountingShell>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">✦ AI Document Scanner</h1>
            <p className="text-sm text-gray-400 mt-0.5">Scan any document — AI extracts the data, you approve and post</p>
          </div>
          {usage && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm min-w-[180px]">
              {usage.isInternal || usage.limit === null ? (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Scans</p>
                  <p className="text-sm font-bold text-green-700 mt-0.5">Unlimited</p>
                  <p className="text-xs text-gray-400">{usage.used} used this month</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Scans this month</p>
                    <span className="text-xs font-bold text-[#0F4C81] capitalize">{usage.plan}</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1.5">
                    <span className={`text-xl font-bold ${usage.used >= usage.limit ? 'text-red-600' : 'text-gray-800'}`}>{usage.used}</span>
                    <span className="text-xs text-gray-400">/ {usage.limit}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${usage.used >= usage.limit ? 'bg-red-500' : usage.used / usage.limit > 0.8 ? 'bg-orange-400' : 'bg-[#0F4C81]'}`}
                      style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} />
                  </div>
                  {usage.used >= usage.limit && (
                    <a href="/accounting/checkout" className="block mt-2 text-xs text-[#0F4C81] font-semibold hover:underline">Upgrade for more →</a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── STEP 1: Upload Zone ── */}
        {!result && !scanning && !posted && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all select-none ${
                dragging ? 'border-[#0F4C81] bg-blue-50 scale-[1.01]' : 'border-gray-200 hover:border-[#0F4C81] hover:bg-gray-50'
              }`}>
              <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={onFileChange} />
              <div className="w-20 h-20 bg-gradient-to-br from-[#0F4C81] to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                <span className="text-white text-4xl leading-none">✦</span>
              </div>
              <p className="text-lg font-bold text-gray-800 mb-1">Drop your document here</p>
              <p className="text-gray-400 text-sm mb-5">or click to browse</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                {['JPG / PNG', 'WebP', 'HEIC', 'PDF'].map(t => (
                  <span key={t} className="px-2.5 py-1 bg-gray-100 rounded-lg">{t}</span>
                ))}
              </div>
              <p className="text-xs text-gray-300 mt-3">Images up to 10 MB · PDFs up to 20 MB</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: '🧾', title: 'Receipts', desc: 'Vendor, amount, date, line items' },
                { icon: '📋', title: 'Bills & Invoices', desc: 'Due date, totals, reference #' },
                { icon: '⚖️', title: 'Contracts', desc: 'Parties, key dates, notary' },
                { icon: '🪪', title: 'IDs & Licenses', desc: 'Name, ID number, DOB' },
              ].map(c => (
                <div key={c.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <p className="font-semibold text-gray-800 text-sm">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 2: Scanning Animation ── */}
        {scanning && (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl animate-pulse">✦</span>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Analyzing document…</p>
            <p className="text-gray-400 text-sm mb-5">{fileName}</p>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-[#0F4C81] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !scanning && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-red-700 font-medium text-sm mb-3">{error}</p>
            <button onClick={() => { setError(''); if (!result) reset() }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">
              {result ? 'Dismiss' : 'Try Again'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Approval Form (financial docs) ── */}
        {result && !scanning && !posted && result.is_financial && (
          <div className="space-y-4">
            {/* Scan summary strip */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                {result.document_type === 'receipt' ? '🧾' : result.document_type === 'bill' ? '📋' : '💰'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{DOC_TYPE_LABELS[result.document_type] || 'Document'} detected</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONFIDENCE_COLORS[result.confidence]}`}>
                    {result.confidence} confidence
                  </span>
                </div>
                {result.raw_text_summary && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{result.raw_text_summary}</p>
                )}
              </div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition shrink-0">
                ↩ Rescan
              </button>
            </div>

            {/* Approval form */}
            <div className="bg-white rounded-xl border border-[#0F4C81] shadow-sm overflow-hidden">
              <div className="bg-[#0F4C81] px-5 py-3 flex items-center gap-2">
                <span className="text-white text-sm font-bold">Review & Approve</span>
                <span className="text-blue-300 text-xs">— edit any field before posting</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Post mode toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Post as</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPostMode('transaction')}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${postMode === 'transaction' ? 'bg-[#0F4C81] text-white border-[#0F4C81]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0F4C81]'}`}>
                      Transaction
                    </button>
                    <button type="button" onClick={() => setPostMode('bill')}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${postMode === 'bill' ? 'bg-[#0F4C81] text-white border-[#0F4C81]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0F4C81]'}`}>
                      Bill / Payable
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Type — only for transactions */}
                  {postMode === 'transaction' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <div className="flex gap-2">
                        {(['income', 'expense'] as const).map(t => (
                          <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t, category: t === 'income' ? 'Other Income' : 'Miscellaneous' }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border capitalize transition ${form.type === t ? t === 'income' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {postMode === 'bill' ? 'Bill Date' : 'Date'}
                    </label>
                    <input type="date" value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>

                  {/* Due date — bills only */}
                  {postMode === 'bill' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                      <input type="date" value={form.due_date}
                        onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                    </div>
                  )}

                  {/* Vendor */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Payee</label>
                    <input value={form.vendor}
                      onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                      placeholder="Who was this paid to?"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" step="0.01" min="0" value={form.amount}
                        onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] font-mono" />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <input value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="What was this for?"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>

                  {/* Reference — bills only */}
                  {postMode === 'bill' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Invoice / Ref #</label>
                      <input value={form.reference}
                        onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                        placeholder="Optional"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="text-gray-300 font-normal">(AI summary — editable)</span></label>
                    <textarea value={form.notes} rows={2}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] resize-none" />
                  </div>
                </div>

                {/* Line items — read-only reference */}
                {result.line_items.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Line Items (reference)</p>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase border-b border-gray-200">
                            <th className="px-3 py-2 text-left font-medium">Item</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Unit</th>
                            <th className="px-3 py-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.line_items.map((li, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-600">{li.description}</td>
                              <td className="px-3 py-2 text-right text-gray-400">{li.qty}</td>
                              <td className="px-3 py-2 text-right text-gray-400">${li.unit_price.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-700">${li.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {error && <p className="text-red-600 text-sm">{error}</p>}

                {/* Approve button */}
                <div className="flex gap-3 pt-1">
                  <button onClick={approve} disabled={posting}
                    className="flex-1 py-3 bg-[#0F4C81] hover:bg-[#082D4F] text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm">
                    {posting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Posting…
                      </>
                    ) : (
                      <>✓ Approve &amp; Post {postMode === 'transaction' ? 'Transaction' : 'Bill'}</>
                    )}
                  </button>
                  <button onClick={reset}
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 (non-financial): Extracted Info ── */}
        {result && !scanning && !posted && !result.is_financial && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                {result.document_type === 'id_card' ? '🪪' : result.document_type === 'contract' || result.document_type === 'legal' ? '⚖️' : '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{DOC_TYPE_LABELS[result.document_type] || 'Document'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONFIDENCE_COLORS[result.confidence]}`}>
                    {result.confidence} confidence
                  </span>
                </div>
                {result.raw_text_summary && <p className="text-xs text-gray-400 mt-0.5">{result.raw_text_summary}</p>}
              </div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition shrink-0">
                ↩ Rescan
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 mb-4">Extracted Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Full Name',       value: result.full_name },
                  { label: 'Document Title',  value: result.document_title },
                  { label: 'ID / License #',  value: result.id_number },
                  { label: 'Case / Ref #',    value: result.case_or_reference_number },
                  { label: 'Address',         value: result.address },
                  { label: 'Date of Birth',   value: result.date_of_birth },
                  { label: 'Expiration',      value: result.expiration_date },
                  { label: 'Issuing Auth.',   value: result.issuing_authority },
                  { label: 'Date',            value: result.date },
                  { label: 'Notary',          value: result.notary },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
              {result.parties.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Parties</p>
                  <div className="flex flex-wrap gap-2">
                    {result.parties.map((p, i) => <span key={i} className="px-3 py-1 bg-blue-50 text-[#0F4C81] rounded-full text-sm font-medium">{p}</span>)}
                  </div>
                </div>
              )}
              {result.key_dates.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Key Dates</p>
                  <div className="flex flex-wrap gap-2">
                    {result.key_dates.map((kd, i) => (
                      <div key={i} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs">
                        <span className="text-gray-500">{kd.label}: </span>
                        <span className="font-semibold text-gray-700">{kd.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Success ── */}
        {posted && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Posted Successfully</h2>
            <p className="text-gray-400 text-sm mb-8">
              {postMode === 'transaction'
                ? 'Transaction added to your books.'
                : 'Bill added to your payables.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={reset}
                className="px-6 py-2.5 bg-[#0F4C81] hover:bg-[#082D4F] text-white font-semibold rounded-xl transition text-sm">
                ✦ Scan Another Document
              </button>
              <a href={postMode === 'transaction' ? '/accounting/transactions' : '/accounting/bills'}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm">
                View {postMode === 'transaction' ? 'Transactions' : 'Bills'} →
              </a>
            </div>
          </div>
        )}
      </div>
    </AccountingShell>
  )
}
