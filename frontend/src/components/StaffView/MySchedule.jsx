import { useState, useEffect } from 'react'
import api from '../../services/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const MySchedule = () => {
  const [schedule, setSchedule] = useState([])
  const [timetableName, setTimetableName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMySchedule()
  }, [])

  const fetchMySchedule = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/timetable/my')
      setSchedule(res.data.schedule || [])
      setTimetableName(res.data.timetableName || '')
      setEffectiveFrom(res.data.effectiveFrom || '')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const totalShifts = schedule.reduce((sum, day) => sum + day.shifts.length, 0)
  const totalHours = schedule.reduce((sum, day) =>
    sum + day.shifts.reduce((s, shift) => {
      const start = parseInt(shift.start)
      const end = parseInt(shift.end)
      return s + (end - start)
    }, 0), 0)

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">My Weekly Schedule</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your schedule...</div>
      ) : error ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <p className="text-yellow-700 text-lg mb-2">⚠️ {error}</p>
          <p className="text-gray-500 text-sm">Please contact your supervisor to be assigned to a branch.</p>
        </div>
      ) : (
        <>
          {/* Timetable Info */}
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
            <div>
              <div className="font-semibold text-gray-800">{timetableName}</div>
              <div className="text-sm text-gray-500">
                Effective from: {new Date(effectiveFrom).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalShifts}</div>
                <div className="text-xs text-gray-500">Shifts/week</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{totalHours}h</div>
                <div className="text-xs text-gray-500">Hours/week</div>
              </div>
            </div>
          </div>

          {/* Weekly Grid */}
          <div className="grid grid-cols-1 gap-4">
            {schedule.map((day) => (
              <div key={day.day} className="bg-white rounded-lg shadow overflow-hidden">
                <div className={`px-4 py-3 flex justify-between items-center
                  ${day.shifts.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <h3 className="font-semibold">{day.day}</h3>
                  <span className="text-sm">
                    {day.shifts.length === 0 ? 'Day Off' : `${day.shifts.length} shift${day.shifts.length > 1 ? 's' : ''}`}
                  </span>
                </div>

                {day.shifts.length === 0 ? (
                  <div className="px-4 py-3 text-gray-400 text-sm italic">No shifts scheduled</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {day.shifts.map((shift) => (
                      <div key={shift.slotId} className="px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1 font-mono text-sm font-medium">
                            {shift.start} – {shift.end}
                          </div>
                          {shift.station && (
                            <div className="text-sm text-gray-600">
                              📍 {shift.station}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {parseInt(shift.end) - parseInt(shift.start)}h
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default MySchedule