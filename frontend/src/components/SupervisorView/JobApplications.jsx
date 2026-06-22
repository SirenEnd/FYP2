import { useState, useEffect } from 'react'
import api from '../../services/api'
import BackButton from '../BackButton'

const POSITION_META = {
  KITCHEN_STAFF: { label: 'Kitchen Staff', icon: '👨‍🍳', color: '#b45309', bg: '#fef3c7' },
  SERVICE_CREW: { label: 'Service Crew', icon: '🍽️', color: '#0284c7', bg: '#e0f2fe' }
}

const STATUS_META = {
  PENDING: { label: 'Pending', textColor: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  REVIEWED: { label: 'Reviewed', textColor: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  CONTACTED: { label: 'Contacted', textColor: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  REJECTED: { label: 'Rejected', textColor: '#7f1d1d', bg: '#fee2e2', dot: '#ef4444' }
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.PENDING
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: m.bg,
        color: m.textColor,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        padding: '3px 10px',
        borderRadius: 999,
        textTransform: 'uppercase'
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DetailModal({ application, onClose, onStatusChange }) {
  const [updating, setUpdating] = useState(false)
  const meta = POSITION_META[application.position] || {}

  const setStatus = async (status) => {
    if (status === application.status) return
    setUpdating(true)
    try {
      await api.put(`/job-applications/${application.id}/status`, { status })
      onStatusChange()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Application Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="font-bold text-gray-900">{application.name}</p>
            <p className="text-sm text-gray-500">{application.email} · {application.phone}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Position</p>
              <p className="text-sm font-semibold text-gray-800">{meta.icon} {meta.label}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Applied</p>
              <p className="text-sm font-semibold text-gray-800">{fmtDate(application.createdAt)}</p>
            </div>
          </div>

          <div className="border-l-4 border-gray-200 pl-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Address</p>
            <p className="text-sm text-gray-700">{application.address}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Typhoid Vaccination</p>
            <p className="text-sm font-semibold text-gray-800">
              {application.typhoidVaccinated
                ? `✅ Vaccinated (${application.vaccinationYear})`
                : '❌ Not vaccinated'}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(STATUS_META).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  disabled={updating || application.status === s}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50"
                  style={{
                    borderColor: application.status === s ? STATUS_META[s].dot : '#e5e7eb',
                    background: application.status === s ? STATUS_META[s].bg : '#fff',
                    color: application.status === s ? STATUS_META[s].textColor : '#6b7280'
                  }}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const JobApplications = () => {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/job-applications')
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = applications
    .filter((a) => statusFilter === 'ALL' || a.status === statusFilter)
    .filter((a) => positionFilter === 'ALL' || a.position === positionFilter)
    .filter(
      (a) =>
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    )

  const pendingCount = applications.filter((a) => a.status === 'PENDING').length

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <BackButton />

      {viewing && (
        <DetailModal
          application={viewing}
          onClose={() => setViewing(null)}
          onStatusChange={() => { load(); setViewing(null) }}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Applications</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review applications submitted via "Join Our Crew"</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Applications', value: applications.length, color: 'text-gray-800' },
          { label: 'Pending Review', value: pendingCount, color: 'text-amber-600' },
          { label: 'Kitchen Staff', value: applications.filter((a) => a.position === 'KITCHEN_STAFF').length, color: 'text-amber-700' },
          { label: 'Service Crew', value: applications.filter((a) => a.position === 'SERVICE_CREW').length, color: 'text-sky-700' }
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50 flex-wrap">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{
                  background: statusFilter === s ? '#2563eb' : 'transparent',
                  color: statusFilter === s ? '#fff' : '#6b7280'
                }}
              >
                {s === 'ALL' ? 'All' : STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto flex-wrap">
            {['ALL', 'KITCHEN_STAFF', 'SERVICE_CREW'].map((p) => (
              <button
                key={p}
                onClick={() => setPositionFilter(p)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{
                  background: positionFilter === p ? '#374151' : 'transparent',
                  color: positionFilter === p ? '#fff' : '#6b7280'
                }}
              >
                {p === 'ALL' ? 'All Positions' : POSITION_META[p].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold text-gray-500">No applications found</p>
            <p className="text-sm mt-1">
              {applications.length === 0
                ? 'No one has applied yet — share the "Join Our Crew" link to get started.'
                : 'No records match your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((app) => {
              const meta = POSITION_META[app.position] || {}
              return (
                <div
                  key={app.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  style={{ background: app.status === 'PENDING' ? '#fffbeb' : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm text-gray-900">{app.name}</span>
                      <StatusBadge status={app.status} />
                      <span
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          padding: '1px 7px',
                          borderRadius: 999,
                          fontWeight: 600,
                          fontSize: 11
                        }}
                      >
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{app.email} · {app.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-400">Applied {fmtDate(app.createdAt)}</span>
                    <button
                      onClick={() => setViewing(app)}
                      className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobApplications