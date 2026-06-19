import { useState, useEffect, useMemo } from 'react'
import BackButton from '../BackButton'
import api from '../../services/api'

const TASK_TYPES = [
  { key: 'TOILET_CLEANING', label: 'Toilet Cleaning', freq: 'Daily',  color: 'bg-cyan-500',  badge: 'bg-cyan-100 text-cyan-700' },
  { key: 'BARTENDING',      label: 'Bartending',       freq: 'Daily',  color: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-700' },
  { key: 'TRASH_DISPOSAL',  label: 'Trash Disposal',   freq: 'Daily',  color: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  { key: 'FILTER_CLEANING', label: 'Filter Cleaning',  freq: 'Weekly', color: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const isServiceCrew = (emp) => {
  const pos = (emp.position || '').toLowerCase()
  return emp.role === 'STAFF' && (
    pos.includes('service') || pos.includes('waiter') ||
    pos.includes('waitress') || pos.includes('cashier') || pos.includes('counter')
  )
}

const getMonday = (d) => {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
const fmtDate = (d) => d.toISOString().split('T')[0]
const fmtShort = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

const TaskManager = () => {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [loading, setLoading] = useState(false)
  const [assignCell, setAssignCell] = useState(null) // { taskType, date }
  const [selectedEmployee, setSelectedEmployee] = useState('')

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  useEffect(() => { fetchBranches(); fetchEmployees() }, [])
  useEffect(() => { fetchTasks() }, [weekStart, selectedBranch])

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data)
      if (res.data.length > 0) setSelectedBranch(res.data[0].id)
    } catch (err) { console.error(err) }
  }

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees')
      setEmployees(res.data.filter(isServiceCrew))
    } catch (err) { console.error(err) }
  }

  const fetchTasks = async () => {
    if (!selectedBranch) return
    setLoading(true)
    try {
      const res = await api.get('/tasks', {
        params: { weekStart: fmtDate(weekStart), branchId: selectedBranch }
      })
      setTasks(res.data.tasks)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  const getCellTasks = (taskType, date) =>
    tasks.filter(t => t.taskType === taskType && sameDay(t.date, date))

  const branchEmployees = useMemo(
    () => employees.filter(e => e.branchId === parseInt(selectedBranch)),
    [employees, selectedBranch]
  )

  const openAssign = (taskType, date) => {
    setAssignCell({ taskType, date })
    setSelectedEmployee('')
  }

  const handleAssign = async () => {
    if (!selectedEmployee || !assignCell) return
    try {
      await api.post('/tasks', {
        employeeId: parseInt(selectedEmployee),
        taskType: assignCell.taskType,
        date: fmtDate(assignCell.date),
        branchId: selectedBranch
      })
      setAssignCell(null)
      fetchTasks()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign task')
    }
  }

  const handleRemove = async (taskId) => {
    if (!window.confirm('Remove this task assignment?')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      fetchTasks()
    } catch (err) {
      alert('Failed to remove task')
    }
  }

  const shiftWeek = (delta) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  return (
    <div className="container mx-auto p-4">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Task Assignments</h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TASK_TYPES.map(t => (
          <span key={t.key} className={`px-3 py-1 rounded-full text-xs font-medium ${t.badge}`}>
            ● {t.label} <span className="opacity-70">({t.freq})</span>
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-4">
        <label className="font-medium text-gray-700">Branch:</label>
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
          className="border rounded p-2 min-w-48">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => shiftWeek(-1)} className="px-3 py-2 border rounded hover:bg-gray-50">←</button>
          <span className="text-sm font-medium text-gray-700">
            {fmtShort(weekDays[0])} – {fmtShort(weekDays[6])}
          </span>
          <button onClick={() => shiftWeek(1)} className="px-3 py-2 border rounded hover:bg-gray-50">→</button>
          <button onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">This week</button>
        </div>
      </div>

      {/* Assign popover */}
      {assignCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-blue-800">
              Assign {TASK_TYPES.find(t => t.key === assignCell.taskType)?.label} — {assignCell.date.toLocaleDateString()}
            </h3>
            <button onClick={() => setAssignCell(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
              className="border rounded p-2 min-w-64">
              <option value="">Select Service Crew staff...</option>
              {branchEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>
              ))}
            </select>
            <button onClick={handleAssign} disabled={!selectedEmployee}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              ✓ Assign
            </button>
          </div>
          {branchEmployees.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No Service Crew staff found for this branch.</p>
          )}
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tasks...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 w-40 sticky left-0 bg-gray-100 z-10">
                  Task
                </th>
                {weekDays.map((d, i) => (
                  <th key={i} className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 text-center min-w-32">
                    {DAY_LABELS[i]}<br /><span className="font-normal text-gray-400">{fmtShort(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASK_TYPES.map(taskType => (
                <tr key={taskType.key}>
                  <td className="border border-gray-200 p-2 text-xs font-semibold text-gray-700 sticky left-0 bg-white z-10">
                    {taskType.label}
                    <div className="text-gray-400 font-normal">{taskType.freq}</div>
                  </td>
                  {weekDays.map((d, i) => {
                    const cellTasks = getCellTasks(taskType.key, d)
                    return (
                      <td key={i} className="border border-gray-200 p-1 align-top" style={{ minHeight: '60px' }}>
                        <div className="flex flex-col gap-1">
                          {cellTasks.map(t => (
                            <div key={t.id}
                              className={`${taskType.color} text-white rounded px-2 py-1 text-xs flex items-center justify-between gap-1 group`}>
                              <span className="truncate">{t.employee.name}</span>
                              <button onClick={() => handleRemove(t.id)}
                                className="text-white/60 hover:text-white flex-shrink-0 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                ✕
                              </button>
                            </div>
                          ))}
                          <button onClick={() => openAssign(taskType.key, d)}
                            className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded py-1 transition-colors">
                            + Assign
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TaskManager