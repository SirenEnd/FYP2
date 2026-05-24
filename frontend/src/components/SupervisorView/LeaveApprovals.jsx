import { useState, useEffect } from "react";

import api from "../../services/api";

const LEAVE_TYPE_META = {
  ANNUAL:    { label: "Annual",    icon: "🌴", color: "#0284c7", bg: "#e0f2fe" },
  MEDICAL:   { label: "Medical",   icon: "🏥", color: "#7c3aed", bg: "#ede9fe" },
  EMERGENCY: { label: "Emergency", icon: "🚨", color: "#dc2626", bg: "#fee2e2" },
  UNPAID:    { label: "Unpaid",    icon: "💼", color: "#b45309", bg: "#fef3c7" },
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

function Avatar({ name, size = 36 }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const palette = [
    ["#dbeafe", "#1d4ed8"], ["#d1fae5", "#065f46"], ["#fef3c7", "#92400e"],
    ["#ede9fe", "#5b21b6"], ["#fce7f3", "#9d174d"],
  ];
  const [bg, fg] = palette[(name || "").charCodeAt(0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
}

function dayCount(start, end) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewModal({ leave, onClose, onDone }) {
  const [action, setAction]   = useState(null); // "approve" | "reject"
  const [note, setNote]       = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const meta = LEAVE_TYPE_META[leave.leaveType] || LEAVE_TYPE_META.ANNUAL;
  const nd   = dayCount(leave.startDate, leave.endDate);

  async function confirm() {
    setLoading(true); setErr("");
    try {
      if (action === "approve") {
        await api.put(`/leave/${leave.id}/approve`, { note });
      } else {
        await api.put(`/leave/${leave.id}/reject`, { note });
      }
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || "Action failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Review Application</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Employee card */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
            <Avatar name={leave.employee?.name} size={44} />
            <div>
              <p className="font-bold text-gray-900 text-sm">{leave.employee?.name}</p>
              <p className="text-xs text-gray-500">{leave.employee?.position} · {leave.employee?.department?.name || leave.employee?.role}</p>
            </div>
          </div>

          {/* Leave details */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Type", value: <span className="flex items-center gap-1">{meta.icon} {meta.label}</span> },
              { label: "Duration", value: `${nd} day${nd !== 1 ? "s" : ""}` },
              { label: "Applied", value: fmtDate(leave.createdAt) },
            ].map(d => (
              <div key={d.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{d.label}</p>
                <p className="text-sm font-semibold text-gray-800">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">
            <span>📅</span>
            <span>{fmtDate(leave.startDate)}</span>
            <span className="text-gray-400 mx-1">→</span>
            <span>{fmtDate(leave.endDate)}</span>
          </div>

          {/* Reason */}
          {leave.reason && (
            <div className="border-l-4 border-gray-200 pl-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-gray-700">{leave.reason}</p>
            </div>
          )}

          {/* Confirm action selection */}
          {!action ? (
            <div className="flex gap-3 pt-1">
              <button onClick={() => setAction("reject")}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                ✕ Reject
              </button>
              <button onClick={() => setAction("approve")}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                ✓ Approve
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${action === "approve" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {action === "approve" ? "✓ Approving this application" : "✕ Rejecting this application"}
                <button onClick={() => setAction(null)} className="ml-auto text-xs font-medium opacity-60 hover:opacity-100">change</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  placeholder={action === "approve" ? "e.g. Approved, enjoy your leave!" : "e.g. Insufficient coverage during this period."}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {err && <p className="text-red-500 text-sm">{err}</p>}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button onClick={confirm} disabled={loading}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors ${action === "approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
                  {loading ? "Processing…" : `Confirm ${action === "approve" ? "Approval" : "Rejection"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeaveApprovals({ role = "SUPERVISOR" }) {
  const [leaves, setLeaves]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("PENDING");
  const [search, setSearch]         = useState("");
  const [reviewing, setReviewing]   = useState(null);

  async function load() {
  setLoading(true);
  try {
    const response = await api.get("/leave");
    console.log("=== DEBUGGING RESPONSE ===");
    console.log("Response data:", response.data);
    console.log("Keys in response data:", Object.keys(response.data));
    
    // Try to find the array inside the object
    let leavesData = [];
    for (const key in response.data) {
      if (Array.isArray(response.data[key])) {
        console.log(`Found array at key: "${key}"`, response.data[key]);
        leavesData = response.data[key];
        break;
      }
    }
    
    console.log("Extracted leaves data:", leavesData);
    setLeaves(leavesData);
  } catch (error) {
    console.error("Failed to load leaves:", error);
    setLeaves([]);
  } finally { 
    setLoading(false); 
  }
}

  useEffect(() => { load(); }, []);

  const filtered = leaves
    .filter(l => filter === "ALL" || l.status === filter)
    .filter(l => !search || l.employee?.name?.toLowerCase().includes(search.toLowerCase()));

  const pending = leaves.filter(l => l.status === "PENDING").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {reviewing && (
        <ReviewModal leave={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load(); }} />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
  {role === "ADMIN"
    ? "Manage all leave requests across the restaurant including supervisors"
    : "Review and action your team's leave requests — your own leave is reviewed by Admin"}
</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pending Review",   value: leaves.filter(l => l.status === "PENDING").length,  color: "text-amber-600" },
          { label: "Approved",         value: leaves.filter(l => l.status === "APPROVED").length, color: "text-emerald-600" },
          { label: "Rejected",         value: leaves.filter(l => l.status === "REJECTED").length, color: "text-red-500" },
          { label: "Total Requests",   value: leaves.length,                                       color: "text-gray-800" },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pending > 0 && filter === "PENDING" && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <span className="text-lg">⏰</span>
          <span><strong>{pending} application{pending !== 1 ? "s" : ""}</strong> waiting for your review.</span>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50 flex-wrap">
          <input
            type="text"
            placeholder="Search employee…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <div className="flex gap-1">
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors relative"
                style={{
                  background: filter === s ? "#2563eb" : "transparent",
                  color: filter === s ? "#fff" : "#6b7280",
                }}>
                {s === "ALL" ? "All" : STATUS_META[s].label}
                {s === "PENDING" && pending > 0 && filter !== "PENDING" && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
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
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold text-gray-500">No requests here</p>
            <p className="text-sm mt-1">
              {filter === "PENDING" ? "No pending applications — all clear!" : "No records match your filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(leave => {
              const meta = LEAVE_TYPE_META[leave.leaveType] || LEAVE_TYPE_META.ANNUAL;
              const nd = dayCount(leave.startDate, leave.endDate);
              return (
                <div key={leave.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  style={{ background: leave.status === "PENDING" ? "#fffbeb" : undefined }}>
                  <Avatar name={leave.employee?.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                     <span className="font-bold text-sm text-gray-900">{leave.employee?.name}</span>
                      <StatusBadge status={leave.status} />
                      {leave.employee?.role === 'SUPERVISOR' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          Supervisor
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{leave.employee?.department?.name || leave.employee?.role}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <span style={{ background: meta.bg, color: meta.color, padding: "1px 7px", borderRadius: 999, fontWeight: 600 }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span>{fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}</span>
                      <span className="font-semibold text-gray-700">{nd} day{nd !== 1 ? "s" : ""}</span>
                    </div>
                    {leave.reason && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{leave.reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-400">Applied {fmtDate(leave.createdAt)}</span>
                    {leave.status === "PENDING" ? (
                      <button onClick={() => setReviewing(leave)}
                        className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                        Review →
                      </button>
                    ) : (
                      leave.note && (
                        <span className="text-xs text-gray-400 max-w-[160px] text-right truncate" title={leave.note}>
                          📝 {leave.note}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}