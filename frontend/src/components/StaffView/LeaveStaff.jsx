import { useState, useEffect } from "react";
import api from "../../services/api";

const LEAVE_TYPE_META = {
  ANNUAL:    { label: "Annual Leave",    icon: "🌴", color: "#0284c7", bg: "#e0f2fe" },
  MEDICAL:   { label: "Medical Leave",   icon: "🏥", color: "#7c3aed", bg: "#ede9fe" },
  EMERGENCY: { label: "Emergency Leave", icon: "🚨", color: "#dc2626", bg: "#fee2e2" },
  UNPAID:    { label: "Unpaid Leave",    icon: "💼", color: "#b45309", bg: "#fef3c7" },
};

const STATUS_META = {
  PENDING:  { label: "Pending",  textColor: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  APPROVED: { label: "Approved", textColor: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  REJECTED: { label: "Rejected", textColor: "#7f1d1d", bg: "#fee2e2", dot: "#ef4444" },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: m.bg, color: m.textColor,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      padding: "3px 10px", borderRadius: 999, textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function dayCount(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeaveStaff() {
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filter, setFilter]       = useState("ALL");

  // form state
  const [form, setForm] = useState({ leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]       = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/leave/my");
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function submitLeave(e) {
    e.preventDefault();
    setFormErr("");
    if (!form.startDate || !form.endDate) { setFormErr("Please select start and end dates."); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { setFormErr("End date must be after start date."); return; }
    if (!form.reason.trim()) { setFormErr("Please provide a reason."); return; }
    setSubmitting(true);
    try {
      await api.post("/leave", form);
      setShowForm(false);
      setForm({ leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });
      load();
    } catch (err) {
      setFormErr(err?.response?.data?.message || "Failed to submit. Please try again.");
    } finally { setSubmitting(false); }
  }

  async function cancelLeave(id) {
    if (!window.confirm("Cancel this leave application?")) return;
    try {
      await api.delete(`/leave/${id}`);
      load();
    } catch { alert("Could not cancel leave."); }
  }

  const filtered = filter === "ALL" ? history : history.filter(l => l.status === filter);
  const days = dayCount(form.startDate, form.endDate);

  const statCounts = {
    total:    history.length,
    pending:  history.filter(l => l.status === "PENDING").length,
    approved: history.filter(l => l.status === "APPROVED").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
          <p className="text-sm text-gray-500 mt-0.5">Apply for leave and track your applications</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormErr(""); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Apply for Leave
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Applications", value: statCounts.total,    color: "text-gray-800" },
          { label: "Pending Review",     value: statCounts.pending,   color: "text-amber-600" },
          { label: "Approved",           value: statCounts.approved,  color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Apply Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Apply for Leave</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={submitLeave} className="space-y-4">
              {/* Leave type pills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(LEAVE_TYPE_META).map(([key, m]) => (
                    <button type="button" key={key}
                      onClick={() => setForm(f => ({ ...f, leaveType: key }))}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all"
                      style={{
                        borderColor: form.leaveType === key ? m.color : "#e5e7eb",
                        background: form.leaveType === key ? m.bg : "#fff",
                        color: form.leaveType === key ? m.color : "#6b7280",
                      }}
                    >
                      <span>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" required value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" required value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Duration pill */}
              {days > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-2 rounded-lg">
                  📅 <span><strong>{days}</strong> day{days !== 1 ? "s" : ""} selected</span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea rows={3} required value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Briefly explain the reason for your leave..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formErr && <p className="text-red-500 text-sm">{formErr}</p>}

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                  {submitting ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Filter tabs */}
        <div className="flex gap-1 p-3 border-b border-gray-100 bg-gray-50">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
              style={{
                background: filter === s ? "#2563eb" : "transparent",
                color: filter === s ? "#fff" : "#6b7280",
              }}>
              {s === "ALL" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🌴</p>
            <p className="font-semibold text-gray-500">No leave applications</p>
            <p className="text-sm mt-1">
              {filter === "ALL" ? "You haven't applied for any leave yet." : `No ${filter.toLowerCase()} applications.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(leave => {
              const meta = LEAVE_TYPE_META[leave.leaveType] || LEAVE_TYPE_META.ANNUAL;
              const nd = dayCount(leave.startDate, leave.endDate);
              return (
                <li key={leave.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: meta.bg }}>
                    {meta.icon}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm text-gray-900">{meta.label}</span>
                      <StatusBadge status={leave.status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}
                      <span className="mx-1.5 text-gray-300">·</span>
                      <strong className="text-gray-700">{nd} day{nd !== 1 ? "s" : ""}</strong>
                    </p>
                    {leave.reason && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{leave.reason}</p>
                    )}
                  </div>
                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-400">Applied {fmtDate(leave.createdAt)}</span>
                    {leave.status === "PENDING" && (
                      <button onClick={() => cancelLeave(leave.id)}
                        className="text-xs font-semibold text-red-500 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}