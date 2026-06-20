import { useState, useEffect, useMemo } from 'react'
import BackButton from '../BackButton'
import api from '../../services/api'
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, ClipboardList, Sparkles } from 'lucide-react'

const TASK_META = {
  TOILET_CLEANING: { label: 'Toilet Cleaning', icon: '🧽', freq: 'Daily',  badge: 'bg-cyan-100 text-cyan-700' },
  BARTENDING:      { label: 'Bartending',      icon: '🍹', freq: 'Daily',  badge: 'bg-pink-100 text-pink-700' },
  TRASH_DISPOSAL:  { label: 'Trash Disposal',  icon: '🗑️', freq: 'Daily',  badge: 'bg-amber-100 text-amber-700' },
  FILTER_CLEANING: { label: 'Filter Cleaning', icon: '🧰', freq: 'Weekly', badge: 'bg-emerald-100 text-emerald-700' },
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const getMonday = (d) => {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

const fmtDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
const isToday = (d) => sameDay(d, new Date())

const MyTasks = () => {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  ), [weekStart])

  useEffect(() => { fetchTasks() }, [weekStart])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/tasks/my', { params: { weekStart: fmtDate(weekStart) } })
      setTasks(res.data.tasks || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'DONE' ? 'PENDING' : 'DONE'
    setUpdatingId(task.id)
    try {
      await api.put(`/tasks/my/${task.id}/status`, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task')
    } finally {
      setUpdatingId(null)
    }
  }

  const shiftWeek = (delta) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  const tasksForDay = (date) => tasks.filter(t => sameDay(t.date, date))
  const doneCount = tasks.filter(t => t.status === 'DONE').length
  const totalCount = tasks.length
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <BackButton />

      <h2 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="w-6 h-6 text-blue-600" />
        My Tasks
      </h2>
      <p className="text-sm text-gray-500 mb-6">Cleaning, bartending & trash duties assigned to you</p>

      {/* Week navigator */}
      <div className="bg-white rounded-lg shadow p-3 mb-2 flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="p-2 rounded hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-gray-700">
          {weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
        <button onClick={() => shiftWeek(1)} className="p-2 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <button onClick={() => setWeekStart(getMonday(new Date()))}
        className="text-xs text-blue-600 hover:underline mb-4">
        Jump to this week
      </button>

      {/* Progress summary */}
      {totalCount > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="font-medium text-gray-700">{doneCount} of {totalCount} completed</span>
            <span className="text-gray-400">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your tasks...</div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No tasks assigned this week</p>
          <p className="text-gray-400 text-sm mt-1">Enjoy the clear schedule 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {weekDays.map((date, i) => {
            const dayTasks = tasksForDay(date)
            if (dayTasks.length === 0) return null
            return (
              <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                <div className={`px-4 py-2 flex items-center justify-between
                  ${isToday(date) ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
                  <span className="font-semibold text-sm">
                    {DAY_NAMES[i]}{isToday(date) && ' · Today'}
                  </span>
                  <span className="text-xs opacity-80">
                    {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {dayTasks.map(task => {
                    const meta = TASK_META[task.taskType] || {}
                    const isDone = task.status === 'DONE'
                    return (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleStatus(task)}
                          disabled={updatingId === task.id}
                          className="flex-shrink-0 disabled:opacity-50"
                          title={isDone ? 'Mark as pending' : 'Mark as done'}
                        >
                          {isDone
                            ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                            : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-400" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span>{meta.icon}</span>
                            <span className={`text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {meta.label || task.taskType}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.badge}`}>
                              {meta.freq}
                            </span>
                          </div>
                          {task.notes && <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MyTasks