import { useState, useEffect } from 'react'
import api from '../services/api'
import BackButton from '../components/BackButton'
import {
  DollarSign, Calendar, CheckCircle,
  RefreshCw, Users, Trash2, X, AlertCircle
} from 'lucide-react'

// ── CONSTANTS ──────────────────────────────────────────────────────
const HOURLY_RATE = 13
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_STYLE = {
  PENDING: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Pending' },
  PAID:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Paid'    },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function rm(n) {
  return `RM ${Number(n || 0).toFixed(2)}`
}

// ── PAYSLIP MODAL ─────────────────────────────────────────────────
function PayslipModal({ payroll, onClose }) {
  if (!payroll) return null
  const emp = payroll.employee || {}

  // Derive base pay (gross minus overtime)
  const basePay = fmt2(payroll.grossSalary - payroll.overtimePay)

  const rows = [
    { label: `Basic Pay (${payroll.attendedDays ?? '—'} days × ${HOURLY_RATE * 6} hrs rate)`, value: basePay, positive: true },
    { label: `Overtime Pay (${payroll.overtimeHours}h × RM${HOURLY_RATE} × 1.5)`, value: payroll.overtimePay, positive: true },
    { label: 'Gross Salary', value: payroll.grossSalary, positive: true, bold: true },
    { label: 'EPF (Employee 11%)', value: -payroll.epfDeduction, positive: false },
    { label: 'SOCSO (Employee 0.5%)', value: -payroll.socsoDeduction, positive: false },
    ...(payroll.advanceDeduction > 0
      ? [{ label: 'Salary Advance Deduction', value: -payroll.advanceDeduction, positive: false }]
      : []),
    { label: 'Net Salary', value: payroll.netSalary, positive: true, bold: true, accent: true },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Pay Slip</p>
              <h2 className="text-xl font-bold">{emp.name || 'Employee'}</h2>
              <p className="text-slate-300 text-sm mt-0.5">{emp.position} · {emp.department?.name}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Period</p>
              <p className="font-semibold">{MONTHS[payroll.month - 1]} {payroll.year}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Employee ID</p>
              <p className="font-semibold">{emp.employeeId || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Rate</p>
              <p className="font-semibold">RM {HOURLY_RATE}/hr</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Status</p>
              <StatusBadge status={payroll.status} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Days Worked',   value: payroll.attendedDays ?? '—' },
              { label: 'Total Hours',   value: `${payroll.totalHoursWorked ?? '—'}h` },
              { label: 'Overtime Hrs',  value: `${payroll.overtimeHours}h` },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">{item.label}</p>
                <p className="text-lg font-bold text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex justify-between items-center px-4 py-2.5 text-sm
                  ${row.accent ? 'bg-emerald-50' : row.bold ? 'bg-slate-50' : 'bg-white'}`}
              >
                <span className={`${row.bold ? 'font-bold' : 'font-medium'} ${row.accent ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {row.label}
                </span>
                <span className={`font-bold tabular-nums
                  ${row.accent ? 'text-emerald-700 text-base'
                    : row.positive ? 'text-slate-800' : 'text-red-500'}`}>
                  {row.value < 0 ? `− RM ${Math.abs(row.value).toFixed(2)}` : rm(row.value)}
                </span>
              </div>
            ))}
          </div>

          {payroll.paidAt && (
            <p className="text-xs text-slate-400 text-center mt-4">
              Paid on {new Date(payroll.paidAt).toLocaleDateString('en-MY', { dateStyle: 'long' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function fmt2(n) {
  return parseFloat(Number(n || 0).toFixed(2))
}

// ── PAYROLL TABLE ROW ─────────────────────────────────────────────
function PayrollRow({ record, onMarkPaid, onDelete, onView, isAdmin }) {
  const emp = record.employee || {}

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
            {(emp.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{emp.name}</p>
            <p className="text-xs text-slate-400">{emp.employeeId} · {emp.department?.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{emp.position || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
        {record.attendedDays ?? '—'} days
      </td>
      <td className="px-4 py-3 text-sm font-mono text-slate-700 tabular-nums">{rm(record.grossSalary)}</td>
      <td className="px-4 py-3 text-sm font-mono text-red-500 tabular-nums">
        − {rm(record.epfDeduction + record.socsoDeduction + (record.advanceDeduction || 0))}
      </td>
      <td className="px-4 py-3 text-sm font-bold font-mono text-emerald-700 tabular-nums">
        {rm(record.netSalary)}
      </td>
      <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onView(record)}
            className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            View
          </button>
          {isAdmin && record.status !== 'PAID' && (
            <button
              onClick={() => onMarkPaid(record.id)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              Mark Paid
            </button>
          )}
          {isAdmin && record.status !== 'PAID' && (
            <button
              onClick={() => onDelete(record.id)}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete payroll"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── ADMIN / SUPERVISOR VIEW ────────────────────────────────────────
export function PayrollAdmin({ role = 'ADMIN' }) {
  const isAdmin = role === 'ADMIN'
  const now = new Date()

  const [payrolls,    setPayrolls]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [viewPayroll, setViewPayroll] = useState(null)
  const [error,       setError]       = useState('')

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [filterYear,  setFilterYear]  = useState(now.getFullYear())
  const [genMonth,    setGenMonth]    = useState(now.getMonth() + 1)
  const [genYear,     setGenYear]     = useState(now.getFullYear())
  const [showGenForm, setShowGenForm] = useState(false)
  const [genResult,   setGenResult]   = useState(null)

  useEffect(() => { fetchPayrolls() }, [filterMonth, filterYear])

  async function fetchPayrolls() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/payroll?month=${filterMonth}&year=${filterYear}`)
      setPayrolls(data.payrolls || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payroll records')
      setPayrolls([])
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!window.confirm(
      `Generate payroll for ${MONTHS[genMonth - 1]} ${genYear}?\n\nThis will process all active employees.`
    )) return

    setGenerating(true)
    setGenResult(null)
    setError('')
    try {
      const { data } = await api.post('/payroll/generate', { month: genMonth, year: genYear })
      setGenResult(data)
      // Switch filter view to the generated month
      setFilterMonth(genMonth)
      setFilterYear(genYear)
      await fetchPayrolls()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate payroll')
    } finally {
      setGenerating(false)
    }
  }

  async function handleMarkPaid(id) {
    if (!window.confirm('Mark this payroll as paid? This action cannot be undone.')) return
    try {
      await api.put(`/payroll/${id}/pay`)
      fetchPayrolls()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark as paid')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payroll record? Salary advance links will be released.')) return
    try {
      await api.delete(`/payroll/${id}`)
      fetchPayrolls()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete payroll')
    }
  }

  // Summary stats
  const totalNet     = payrolls.reduce((s, p) => s + p.netSalary, 0)
  const totalGross   = payrolls.reduce((s, p) => s + p.grossSalary, 0)
  const paidCount    = payrolls.filter((p) => p.status === 'PAID').length
  const pendingCount = payrolls.filter((p) => p.status !== 'PAID').length

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <BackButton />

      {viewPayroll && (
        <PayslipModal payroll={viewPayroll} onClose={() => setViewPayroll(null)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Rate: <span className="font-semibold text-slate-700">RM {HOURLY_RATE}/hr</span>
            {' · '}6 billable hrs/day · EPF 11% · SOCSO 0.5%
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowGenForm(!showGenForm); setGenResult(null) }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Payroll
          </button>
        )}
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Generate Form */}
      {showGenForm && isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">
            Generate Monthly Payroll
          </h3>
          <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Month</label>
              <select
                value={genMonth}
                onChange={(e) => setGenMonth(parseInt(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Year</label>
              <select
                value={genYear}
                onChange={(e) => setGenYear(parseInt(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                : <><CheckCircle className="w-4 h-4" /> Generate</>}
            </button>
            <button
              type="button"
              onClick={() => { setShowGenForm(false); setGenResult(null) }}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-2"
            >
              Cancel
            </button>
          </form>

          {genResult && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm font-bold text-emerald-800 mb-1">
                ✅ Processed {genResult.processed} employee{genResult.processed !== 1 ? 's' : ''}
                {genResult.skipped > 0 && ` · ${genResult.skipped} skipped`}
              </p>
              {genResult.errors?.length > 0 && (
                <ul className="text-xs text-amber-700 space-y-0.5 mt-2">
                  {genResult.errors.map((e, i) => (
                    <li key={i}>⚠ {e.employee}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <Calendar className="w-4 h-4 text-slate-400" />
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(parseInt(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={fetchPayrolls}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <span className="text-xs text-slate-400 ml-auto">
          {payrolls.length} record{payrolls.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats */}
      {payrolls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { icon: <Users className="w-4 h-4" />,       label: 'Employees',         value: payrolls.length,  color: 'text-slate-700' },
            { icon: <DollarSign className="w-4 h-4" />,  label: 'Total Gross',        value: rm(totalGross),   color: 'text-slate-700' },
            { icon: <DollarSign className="w-4 h-4" />,  label: 'Total Net Payable',  value: rm(totalNet),     color: 'text-emerald-700' },
            { icon: <CheckCircle className="w-4 h-4" />, label: 'Paid / Pending',     value: `${paidCount} / ${pendingCount}`, color: 'text-slate-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                {s.icon}
                <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : payrolls.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-500">No payroll records</p>
            <p className="text-sm mt-1">
              {isAdmin
                ? 'Use "Generate Payroll" above to process this period.'
                : 'No payroll has been generated for this period yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Position', 'Days', 'Gross', 'Deductions', 'Net Pay', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <PayrollRow
                    key={p.id}
                    record={p}
                    isAdmin={isAdmin}
                    onMarkPaid={handleMarkPaid}
                    onDelete={handleDelete}
                    onView={setViewPayroll}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── STAFF VIEW ─────────────────────────────────────────────────────
export function PayrollStaff() {
  const now = new Date()
  const [payrolls,    setPayrolls]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [viewPayroll, setViewPayroll] = useState(null)
  const [year,        setYear]        = useState(now.getFullYear())
  const [error,       setError]       = useState('')

  useEffect(() => { fetchMyPayroll() }, [year])

  async function fetchMyPayroll() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/payroll/my')
      setPayrolls(data.payrolls || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your payslips')
      setPayrolls([])
    } finally {
      setLoading(false)
    }
  }

  const filtered    = payrolls.filter((p) => p.year === year)
  const totalEarned = filtered
    .filter((p) => p.status === 'PAID')
    .reduce((s, p) => s + p.netSalary, 0)

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <BackButton />

      {viewPayroll && (
        <PayslipModal payroll={viewPayroll} onClose={() => setViewPayroll(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Payslips</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Rate: RM {HOURLY_RATE}/hr · 6 billable hrs/day · EPF 11% · SOCSO 0.5%
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* YTD card */}
      <div className="bg-slate-800 text-white rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
              Year-to-Date Earnings
            </p>
            <p className="text-3xl font-bold mt-1">{rm(totalEarned)}</p>
            <p className="text-slate-400 text-sm mt-1">
              {filtered.filter((p) => p.status === 'PAID').length} paid payslip
              {filtered.filter((p) => p.status === 'PAID').length !== 1 ? 's' : ''} in {year}
            </p>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-slate-700 text-white text-sm border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none"
          >
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Payslip list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-500">No payslips for {year}</p>
            <p className="text-sm mt-1">Payroll for this period hasn't been generated yet.</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors"
            >
              {/* Month tile */}
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-500">
                  {MONTHS[p.month - 1].slice(0, 3).toUpperCase()}
                </span>
                <span className="text-lg font-black text-slate-700">{p.month}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800 text-sm">
                    {MONTHS[p.month - 1]} {p.year}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>Gross: <span className="font-semibold text-slate-700">{rm(p.grossSalary)}</span></span>
                  <span>Deductions: <span className="font-semibold text-red-500">
                    − {rm(p.epfDeduction + p.socsoDeduction + (p.advanceDeduction || 0))}
                  </span></span>
                  <span>OT: <span className="font-semibold">{p.overtimeHours}h</span></span>
                  {p.attendedDays != null && (
                    <span>Days: <span className="font-semibold">{p.attendedDays}</span></span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-emerald-700">{rm(p.netSalary)}</p>
                <button
                  onClick={() => setViewPayroll(p)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 mt-1"
                >
                  View Slip →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}