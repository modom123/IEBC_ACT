'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import AccountingShell from '@/components/AccountingShell'

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

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: 'Receipt', invoice: 'Invoice', bill: 'Bill', contract: 'Contract',
  legal: 'Legal Document', id_card: 'ID / License', bank_statement: 'Bank Statement',
  tax_form: 'Tax Form', payroll: 'Payroll', purchase_order: 'Purchase Order',
  estimate: 'Estimate', insurance: 'Insurance', other: 'Document',
}
const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-red-100 text-red-700',
}
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf'

export default function ScannerPage() {
  const [dragging,  setDragging]  = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [result,    setResult]    = useState<ScanResult | null>(null)
  const [error,     setError]     = useState('')
  const [fileName,  setFileName]  = useState('')
  const [posted,    setPosted]    = useState<string | null>(null)
  const [usage,     setUsage]     = useState<{ used: number; limit: number | null; plan: string; isInternal: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/accounting/scanner')
      .then(r => r.json())
      .then(d => { if (!d.error) setUsage(d) })
      .catch(() => {})
  }, [result])

  const scan = useCallback(async (file: File) => {
    setResult(null); setError(''); setPosted(null); setFileName(file.name)
    setScanning(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/accounting/scanner', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.status === 429 && data.limit_reached) {
        setError(data.error)
        return
      }
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

  async function postAsTransaction() {
    if (!result) return
    const res = await fetch('/api/accounting/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: result.date || new Date().toISOString().split('T')[0],
        description: result.description || result.vendor || 'Scanned document',
        vendor: result.vendor || '',
        amount: result.amount || 0,
        type: result.type === 'income' ? 'income' : 'expense',
        category: result.category || 'Miscellaneous',
        notes: `Scanned from ${fileName}. ${result.raw_text_summary || ''}`,
      }),
    })
    if (res.ok) setPosted('transaction')
  }

  async function postAsBill() {
    if (!result) return
    const res = await fetch('/api/accounting/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor: result.vendor || 'Unknown Vendor',
        description: result.description || 'Scanned bill',
        amount: result.amount || 0,
        due_date: result.due_date || result.date || new Date().toISOString().split('T')[0],
        category: result.category || 'Miscellaneous',
        reference_number: result.invoice_number || '',
        notes: `Scanned from ${fileName}`,
      }),
    })
    if (res.ok) setPosted('bill')
  }

  function reset() {
    setResult(null); setError(''); setFileName(''); setPosted(null)
  }

  return (
    <AccountingShell>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">✦ AI Document Scanner</h1>
            <p className="text-sm text-gray-400 mt-0.5">Upload any document — receipts, invoices, contracts, IDs, PDFs — and AI extracts all relevant data</p>
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

        {/* Upload Zone */}
        {!result && !scanning && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragging ? 'border-[#0F4C81] bg-blue-50' : 'border-gray-200 hover:border-[#0F4C81] hover:bg-gray-50'
            }`}>
            <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={onFileChange} />
            <div className="w-20 h-20 bg-gradient-to-br from-[#0F4C81] to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
              <span className="text-4xl">✦</span>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Drop your document here</p>
            <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
              {['JPG / PNG', 'WebP', 'HEIC', 'PDF'].map(t => (
                <span key={t} className="px-2 py-1 bg-gray-100 rounded">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Images up to 10MB · PDFs up to 20MB</p>
          </div>
        )}

        {/* Scanning State */}
        {scanning && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-pulse">
              <span className="text-4xl">✦</span>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-2">Analyzing document…</p>
            <p className="text-gray-400 text-sm">{fileName}</p>
            <div className="flex justify-center gap-1 mt-4">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 bg-[#0F4C81] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <p className="text-red-700 font-medium mb-3">{error}</p>
            <button onClick={reset} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">Try Again</button>
          </div>
        )}

        {/* Results */}
        {result && !scanning && (
          <div className="space-y-4">
            {/* Result Header */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl">
                    {result.is_financial ? '💰' : result.document_type === 'id_card' ? '🪪' : result.document_type === 'contract' || result.document_type === 'legal' ? '⚖️' : '📄'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-gray-800">{DOC_TYPE_LABELS[result.document_type] || 'Document'}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONFIDENCE_COLORS[result.confidence] || 'bg-gray-100 text-gray-600'}`}>
                        {result.confidence} confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{fileName}</p>
                  </div>
                </div>
                <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  ↩ Scan Another
                </button>
              </div>
              {result.raw_text_summary && (
                <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">{result.raw_text_summary}</p>
              )}
            </div>

            {/* Financial Fields */}
            {result.is_financial && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4">Financial Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Vendor', value: result.vendor },
                    { label: 'Total Amount', value: result.amount != null ? fmt(result.amount) : null, highlight: true },
                    { label: 'Subtotal', value: result.subtotal != null ? fmt(result.subtotal) : null },
                    { label: 'Tax', value: result.tax_amount != null ? fmt(result.tax_amount) : null },
                    { label: 'Date', value: result.date },
                    { label: 'Due Date', value: result.due_date },
                    { label: 'Reference #', value: result.invoice_number },
                    { label: 'Category', value: result.category },
                    { label: 'Type', value: result.type !== 'N/A' ? result.type : null },
                    { label: 'Description', value: result.description },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className={`rounded-lg p-3 ${f.highlight ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{f.label}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${f.highlight ? 'text-green-700 text-lg' : 'text-gray-800'}`}>{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Line Items */}
                {result.line_items.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Line Items</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-400 uppercase">
                            <th className="px-3 py-2 text-left font-medium">Description</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                            <th className="px-3 py-2 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {result.line_items.map((li, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">{li.description}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{li.qty}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmt(li.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(li.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Post Actions */}
                {posted ? (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                    ✓ Posted as {posted === 'transaction' ? 'transaction' : 'bill'} successfully.
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={postAsTransaction}
                      className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition">
                      + Post as Transaction
                    </button>
                    <button onClick={postAsBill}
                      className="px-4 py-2 bg-white border border-gray-200 hover:border-[#0F4C81] text-[#0F4C81] text-sm font-semibold rounded-lg transition">
                      + Post as Bill
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Identity / Legal Fields */}
            {!result.is_financial && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4">Extracted Information</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Full Name', value: result.full_name },
                    { label: 'Document Title', value: result.document_title },
                    { label: 'ID / License #', value: result.id_number },
                    { label: 'Case / Ref #', value: result.case_or_reference_number },
                    { label: 'Address', value: result.address },
                    { label: 'Date of Birth', value: result.date_of_birth },
                    { label: 'Expiration', value: result.expiration_date },
                    { label: 'Issuing Authority', value: result.issuing_authority },
                    { label: 'Date', value: result.date },
                    { label: 'Notary', value: result.notary },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>

                {result.parties.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Parties Involved</p>
                    <div className="flex flex-wrap gap-2">
                      {result.parties.map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-[#0F4C81] rounded-full text-sm font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.key_dates.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Key Dates</p>
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
            )}
          </div>
        )}

        {/* Supported Docs Info */}
        {!result && !scanning && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🧾', title: 'Receipts & Invoices', desc: 'Auto-extracts vendor, amount, date, line items' },
              { icon: '📋', title: 'Bills & Statements', desc: 'Due dates, totals, reference numbers' },
              { icon: '⚖️', title: 'Contracts & Legal', desc: 'Parties, dates, notary, case numbers' },
              { icon: '🪪', title: 'IDs & Licenses', desc: 'Name, ID number, DOB, expiration' },
            ].map(c => (
              <div key={c.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="font-semibold text-gray-800 text-sm">{c.title}</p>
                <p className="text-xs text-gray-400 mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountingShell>
  )
}
