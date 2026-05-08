'use client'
import { useEffect, useState, useCallback } from 'react'

type InventoryItem = {
  id: string
  sku: string
  name: string
  description: string
  category: string
  unit: string
  cost_price: number
  sale_price: number
  qty_on_hand: number
  reorder_point: number
  reorder_qty: number
  is_active: boolean
}

type AdjustState = {
  itemId: string
  qty: number
  note: string
  saving: boolean
}

type AddForm = {
  name: string
  sku: string
  category: string
  unit: string
  cost_price: string
  sale_price: string
  qty_on_hand: string
  reorder_point: string
  reorder_qty: string
}

const CATEGORIES = ['Supplies', 'Equipment', 'Products', 'Raw Materials', 'Other']

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const margin = (cost: number, sale: number) =>
  sale > 0 ? (((sale - cost) / sale) * 100).toFixed(1) : '—'

const generateSku = () =>
  'SKU-' + Math.random().toString(36).toUpperCase().slice(2, 8)

const emptyForm = (): AddForm => ({
  name: '',
  sku: '',
  category: 'Products',
  unit: 'ea',
  cost_price: '',
  sale_price: '',
  qty_on_hand: '0',
  reorder_point: '5',
  reorder_qty: '10',
})

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showActive, setShowActive] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyForm())
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [adjust, setAdjust] = useState<AdjustState | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/inventory')
      const data = await res.json()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activeItems = items.filter(i => i.is_active)
  const totalStockValue = items.reduce((s, i) => s + i.qty_on_hand * i.cost_price, 0)
  const lowStockItems = items.filter(i => i.is_active && i.qty_on_hand <= i.reorder_point)
  const uniqueCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)))

  const filtered = items.filter(i => {
    if (showActive && !i.is_active) return false
    if (categoryFilter !== 'All' && i.category !== categoryFilter) return false
    const q = search.toLowerCase()
    return (
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    )
  })

  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError('Name is required'); return }
    setAddSaving(true)
    setAddError('')
    const payload = {
      ...addForm,
      sku: addForm.sku.trim() || generateSku(),
      cost_price: parseFloat(addForm.cost_price) || 0,
      sale_price: parseFloat(addForm.sale_price) || 0,
      qty_on_hand: parseInt(addForm.qty_on_hand) || 0,
      reorder_point: parseInt(addForm.reorder_point) || 0,
      reorder_qty: parseInt(addForm.reorder_qty) || 0,
    }
    try {
      const res = await fetch('/api/accounting/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to add item')
      setShowAddForm(false)
      setAddForm(emptyForm())
      await load()
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add item')
    }
    setAddSaving(false)
  }

  const handleAdjust = async () => {
    if (!adjust) return
    setAdjust(prev => prev ? { ...prev, saving: true } : null)
    try {
      const res = await fetch('/api/accounting/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: adjust.itemId,
          qty_on_hand: adjust.qty,
          adjust_note: adjust.note,
        }),
      })
      if (!res.ok) throw new Error('Failed to adjust stock')
      setAdjust(null)
      await load()
    } catch {
      setAdjust(prev => prev ? { ...prev, saving: false } : null)
    }
  }

  const handleDeactivate = async (id: string) => {
    setDeactivating(id)
    try {
      await fetch('/api/accounting/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false }),
      })
      await load()
    } catch { /* ignore */ }
    setDeactivating(null)
  }

  const openAdjust = (item: InventoryItem) => {
    setAdjust({ itemId: item.id, qty: item.qty_on_hand, note: '', saving: false })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage stock levels, pricing, and reorder alerts</p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setAddError('') }}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors"
          >
            + Add Item
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Items', value: activeItems.length.toString(), sub: 'Active items' },
            { label: 'Total Stock Value', value: fmt(totalStockValue), sub: 'At cost price' },
            { label: 'Low Stock Alerts', value: lowStockItems.length.toString(), sub: 'At or below reorder point', alert: lowStockItems.length > 0 },
            { label: 'Categories', value: uniqueCategories.length.toString(), sub: 'Unique categories' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.alert ? 'text-red-600' : 'text-gray-900'}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Low Stock Alert — {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} need restocking</p>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => (
                <span key={item.id} className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                  {item.name} — {item.qty_on_hand} / {item.reorder_point} {item.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Add New Item</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Name *', key: 'name', type: 'text', placeholder: 'Item name' },
                { label: 'SKU (auto if blank)', key: 'sku', type: 'text', placeholder: 'Leave blank to auto-generate' },
                { label: 'Unit', key: 'unit', type: 'text', placeholder: 'ea, kg, box…' },
                { label: 'Cost Price', key: 'cost_price', type: 'number', placeholder: '0.00' },
                { label: 'Sale Price', key: 'sale_price', type: 'number', placeholder: '0.00' },
                { label: 'Qty on Hand', key: 'qty_on_hand', type: 'number', placeholder: '0' },
                { label: 'Reorder Point', key: 'reorder_point', type: 'number', placeholder: '5' },
                { label: 'Reorder Qty', key: 'reorder_qty', type: 'number', placeholder: '10' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={addForm[field.key as keyof AddForm]}
                    placeholder={field.placeholder}
                    onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {addError && <p className="text-red-500 text-xs mt-3">{addError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                disabled={addSaving}
                className="bg-[#0F4C81] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-60 transition-colors"
              >
                {addSaving ? 'Saving…' : 'Save Item'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm(emptyForm()); setAddError('') }}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search by name, SKU or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
            />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
            >
              <option>All</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setShowActive(true)}
                className={`px-3 py-2 transition-colors ${showActive ? 'bg-[#0F4C81] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Active
              </button>
              <button
                onClick={() => setShowActive(false)}
                className={`px-3 py-2 transition-colors ${!showActive ? 'bg-[#0F4C81] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No items found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['SKU', 'Name', 'Category', 'Qty on Hand', 'Reorder Pt', 'Cost', 'Sale', 'Margin %', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(item => {
                    const isLow = item.is_active && item.qty_on_hand <= item.reorder_point
                    const isAdjusting = adjust?.itemId === item.id
                    return (
                      <>
                        <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center bg-blue-50 text-[#0F4C81] text-xs font-medium px-2 py-0.5 rounded-md">{item.category}</span>
                          </td>
                          <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                            {item.qty_on_hand} {item.unit}
                            {isLow && <span className="ml-1 text-xs font-normal text-red-400">▼ low</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.reorder_point}</td>
                          <td className="px-4 py-3 text-gray-700">{fmt(item.cost_price)}</td>
                          <td className="px-4 py-3 text-gray-700">{fmt(item.sale_price)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${parseFloat(margin(item.cost_price, item.sale_price)) < 10 ? 'text-red-500' : 'text-green-600'}`}>
                              {margin(item.cost_price, item.sale_price)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => isAdjusting ? setAdjust(null) : openAdjust(item)}
                                className="text-xs text-[#0F4C81] hover:underline font-medium"
                              >
                                {isAdjusting ? 'Cancel' : 'Adjust Stock'}
                              </button>
                              {item.is_active && (
                                <button
                                  onClick={() => handleDeactivate(item.id)}
                                  disabled={deactivating === item.id}
                                  className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                >
                                  {deactivating === item.id ? '…' : 'Deactivate'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isAdjusting && (
                          <tr key={`adj-${item.id}`} className="bg-blue-50">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-medium text-gray-600">Adjust stock for {item.name}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setAdjust(prev => prev ? { ...prev, qty: Math.max(0, prev.qty - 1) } : null)}
                                    className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-sm font-bold"
                                  >−</button>
                                  <input
                                    type="number"
                                    value={adjust.qty}
                                    onChange={e => setAdjust(prev => prev ? { ...prev, qty: parseInt(e.target.value) || 0 } : null)}
                                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
                                  />
                                  <button
                                    onClick={() => setAdjust(prev => prev ? { ...prev, qty: prev.qty + 1 } : null)}
                                    className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-sm font-bold"
                                  >+</button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Adjustment note…"
                                  value={adjust.note}
                                  onChange={e => setAdjust(prev => prev ? { ...prev, note: e.target.value } : null)}
                                  className="border border-gray-200 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
                                />
                                <button
                                  onClick={handleAdjust}
                                  disabled={adjust.saving}
                                  className="bg-[#0F4C81] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0d3d6b] disabled:opacity-60 transition-colors"
                                >
                                  {adjust.saving ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
