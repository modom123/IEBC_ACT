'use client'
import { useEffect, useState } from 'react'

type LineItem = {
  description: string
  qty: number
  unit: string
  unit_price: number
  total: number
}

type PO = {
  id: string
  po_number: string
  vendor_name: string
  order_date: string
  expected_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'received' | 'partial' | 'cancelled'
  notes: string
  items: LineItem[]
}

type FormLineItem = {
  description: string
  qty: string
  unit: string
  unit_price: string
}

const EMPTY_LINE: FormLineItem = { description: '', qty: '1', unit: 'ea', unit_price: '' }

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  received:  'bg-green-100 text-green-700',
  partial:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
}

const ALL_STATUSES = ['All', 'Draft', 'Sent', 'Received', 'Partial', 'Cancelled']

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent placeholder:text-gray-400 transition-all min-h-[44px]'
const selectCls = inputCls + ' bg-white'

function calcLine(l: FormLineItem) {
  return (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0)
}

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    tax_rate: '0',
    notes: '',
  })
  const [lines, setLines] = useState<FormLineItem[]>([{ ...EMPTY_LINE }])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/purchaseorders')
      const data = await res.json()
      setPos(data.pos ?? data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const subtotal = lines.reduce((s, l) => s + calcLine(l), 0)
  const taxAmt = subtotal * (parseFloat(form.tax_rate) || 0) / 100
  const grandTotal = subtotal + taxAmt

  function setLine(i: number, field: keyof FormLineItem, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function addLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE }])
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }

  function resetForm() {
    setForm({ vendor_name: '', order_date: new Date().toISOString().split('T')[0], expected_date: '', tax_rate: '0', notes: '' })
    setLines([{ ...EMPTY_LINE }])
    setShowForm(false)
  }

  async function handleCreate() {
    if (!form.vendor_name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        tax_rate: parseFloat(form.tax_rate) || 0,
        subtotal,
        tax_amount: taxAmt,
        total: grandTotal,
        status: 'draft',
        items: lines.map(l => ({
          description: l.description,
          qty: parseFloat(l.qty) || 0,
          unit: l.unit,
          unit_price: parseFloat(l.unit_price) || 0,
          total: calcLine(l),
        })),
      }
      await fetch('/api/accounting/purchaseorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      resetForm()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch('/api/accounting/purchaseorders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await load()
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = filterStatus === 'All'
    ? pos
    : pos.filter(p => p.status === filterStatus.toLowerCase())

  const totalValue = pos.reduce((s, p) => s + Number(p.total), 0)
  const draftCount = pos.filter(p => p.status === 'draft').length
  const pendingCount = pos.filter(p => p.status === 'sent' || p.status === 'partial').length

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F4C81]">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendor purchase orders and track fulfillment</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#0F4C81] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3f6d] transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          New PO
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total POs', value: pos.length, type: 'count' },
          { label: 'Draft', value: draftCount, type: 'count' },
          { label: 'Pending', value: pendingCount, type: 'count' },
          { label: 'Total Value', value: totalValue, type: 'money' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#0F4C81] mt-1">
              {kpi.type === 'money' ? fmt(kpi.value as number) : kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm w-fit">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-[#0F4C81] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">New Purchase Order</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                placeholder="Vendor name"
                value={form.vendor_name}
                onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Order Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className={inputCls}
                value={form.order_date}
                onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected Date</label>
              <input
                type="date"
                className={inputCls}
                value={form.expected_date}
                onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax Rate %</label>
              <input
                type="number"
                min={0}
                step={0.1}
                className={inputCls}
                value={form.tax_rate}
                onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                className={inputCls}
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Line Items</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Description</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs w-20">Qty</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs w-20">Unit</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs w-28">Unit Price</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs w-24">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2">
                        <input
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent"
                          placeholder="Item description"
                          value={line.description}
                          onChange={e => setLine(i, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent"
                          value={line.qty}
                          onChange={e => setLine(i, 'qty', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent"
                          placeholder="ea"
                          value={line.unit}
                          onChange={e => setLine(i, 'unit', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent"
                          placeholder="0.00"
                          value={line.unit_price}
                          onChange={e => setLine(i, 'unit_price', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">
                        {fmt(calcLine(line))}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeLine(i)}
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                          disabled={lines.length === 1}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-3">
                      <button
                        onClick={addLine}
                        className="text-[#0F4C81] text-sm font-medium hover:underline"
                      >
                        + Add line
                      </button>
                    </td>
                    <td colSpan={2} className="px-3 py-3">
                      <div className="text-right space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Subtotal</span>
                          <span>{fmt(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Tax ({form.tax_rate}%)</span>
                          <span>{fmt(taxAmt)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-200 pt-1 mt-1">
                          <span>Total</span>
                          <span>{fmt(grandTotal)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !form.vendor_name.trim()}
              className="bg-[#0F4C81] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3f6d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating…' : 'Create PO'}
            </button>
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-24 shrink-0" />
                <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No purchase orders found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Order Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Expected</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(po => (
                <>
                  <tr
                    key={po.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                  >
                    <td className="px-4 py-3.5 font-medium text-[#0F4C81]">{po.po_number}</td>
                    <td className="px-4 py-3.5 text-gray-700">{po.vendor_name}</td>
                    <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell">{fmtDate(po.order_date)}</td>
                    <td className="px-4 py-3.5 text-gray-500 hidden lg:table-cell">{fmtDate(po.expected_date)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-800">{fmt(po.total)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[po.status]}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {po.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(po.id, 'sent')}
                            disabled={updatingId === po.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors disabled:opacity-50"
                          >
                            Mark Sent
                          </button>
                        )}
                        {po.status === 'sent' && (
                          <>
                            <button
                              onClick={() => updateStatus(po.id, 'received')}
                              disabled={updatingId === po.id}
                              className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-50"
                            >
                              Mark Received
                            </button>
                            <button
                              onClick={() => updateStatus(po.id, 'partial')}
                              disabled={updatingId === po.id}
                              className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors disabled:opacity-50"
                            >
                              Mark Partial
                            </button>
                          </>
                        )}
                        {po.status === 'partial' && (
                          <button
                            onClick={() => updateStatus(po.id, 'received')}
                            disabled={updatingId === po.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-50"
                          >
                            Mark Received
                          </button>
rac        )}
                        {(po.status === 'draft' || po.status === 'sent' || po.status === 'partial') && (
                          <button
                            onClick={() => updateStatus(po.id, 'cancelled')}
                            disabled={updatingId === po.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === po.id && (
                    <tr key={`${po.id}-expanded`} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-3">
                          {po.notes && (
                            <p className="text-xs text-gray-500 italic">{po.notes}</p>
                          )}
                          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">Qty</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Unit</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Price</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {(po.items ?? []).map((item, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 text-gray-700">{item.description}</td>
                                  <td className="px-3 py-2 text-right text-gray-700">{item.qty}</td>
                                  <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                                  <td className="px-3 py-2 text-right text-gray-700">{fmt(item.unit_price)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td colSpan={3} />
                                <td className="px-3 py-2 text-right text-gray-500">Subtotal</td>
                                <td className="px-3 py-2 text-right text-gray-700">{fmt(po.subtotal)}</td>
                              </tr>
                              <tr>
                                <td colSpan={3} />
                                <td className="px-3 py-2 text-right text-gray-500">Tax ({po.tax_rate}%)</td>
                                <td className="px-3 py-2 text-right text-gray-700">{fmt(po.tax_amount)}</td>
                              </tr>
                              <tr>
                                <td colSpan={3} />
                                <td className="px-3 py-2 text-right font-bold text-gray-800">Total</td>
                                <td className="px-3 py-2 text-right font-bold text-gray-800">{fmt(po.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
