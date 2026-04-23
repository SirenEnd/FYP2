import { useState, useEffect } from 'react'
import api from '../../services/api'
import { Clock, LogIn, LogOut, Coffee, Calendar } from 'lucide-react'

const Attendance = () => {
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [history, setHistory] = useState([])
  const [todaySessions, setTodaySessions] = useState([])

  useEffect(() => {
    fetchTodayAttendance()
    fetchStats()
    fetchTodaySessions()
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [selectedMonth, selectedYear])

  useEffect(() => {
  // Force sync with backend on component mount
  const syncWithBackend = async () => {
    try {
      const response = await api.get('/attendance/today')
      if (response.data.message === 'No active session' || !response.data.clockIn) {
        setTodayAttendance(null)
      } else {
        setTodayAttendance(response.data)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setTodayAttendance(null)
    }
  }
  syncWithBackend()
}, [])

  const fetchTodayAttendance = async () => {
    try {
      const response = await api.get('/attendance/today')
      setTodayAttendance(response.data || null)
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    } finally {
      setLoading(false)
    }
  }

      const fetchTodaySessions = async () => {
      try {
        const response = await api.get(`/attendance/my?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`)
        const today = new Date().toDateString()
        const todaysRecords = response.data.records.filter(record => 
          new Date(record.date).toDateString() === today
        )
        // Debug: log each session to see what's happening
        console.log('Today sessions:', todaysRecords)
        setTodaySessions(todaysRecords)
      } catch (error) {
        console.error('Failed to fetch today sessions:', error)
      }
    }

  const fetchStats = async () => {
    try {
      const response = await api.get('/attendance/my')
      setStats(response.data.summary)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/attendance/my?month=${selectedMonth}&year=${selectedYear}`)
      setHistory(response.data.records || [])
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  const handleClockIn = async () => {
  try {
    const response = await api.post('/attendance/clockin')
    // Set the new attendance state from response
    setTodayAttendance(response.data.attendance)
    await fetchStats()
    await fetchTodaySessions()
    alert('Clocked in successfully!')
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to clock in')
  }
}

const handleClockOut = async () => {
  try {
    await api.post('/attendance/clockout')
    // Force reset the state to null so Clock In button appears
    setTodayAttendance(null)
    await fetchStats()
    await fetchTodaySessions()
    alert('Clocked out successfully!')
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to clock out')
  }
}

const handleBreakStart = async () => {
  try {
    await api.post('/attendance/break/start')
    await fetchTodayAttendance()
    await fetchTodaySessions() // Add this
    alert('Break started!')
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to start break')
  }
}

const handleBreakEnd = async () => {
  try {
    await api.post('/attendance/break/end')
    await fetchTodayAttendance()
    await fetchTodaySessions() // Add this
    alert('Break ended!')
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to end break')
  }
}
  

  

  const isClockedIn = todayAttendance && !todayAttendance.clockOut
  const isOnBreak = todayAttendance?.breakStart && !todayAttendance?.breakEnd

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Attendance Management</h2>

      {/* Today's Attendance Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Today's Attendance</h3>
        
        <div className="flex flex-wrap gap-3 mb-4">
          {!todayAttendance ? (
            <button
              onClick={handleClockIn}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <LogIn className="w-5 h-5" />
              Clock In
            </button>
          ) : (
            <>
              {!isOnBreak ? (
                <button
                  onClick={handleBreakStart}
                  className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <Coffee className="w-5 h-5" />
                  Start Break
                </button>
              ) : (
                <button
                  onClick={handleBreakEnd}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Coffee className="w-5 h-5" />
                  End Break
                </button>
              )}
              
              <button
                onClick={handleClockOut}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <LogOut className="w-5 h-5" />
                Clock Out
              </button>
            </>
          )}
        </div>

        {todayAttendance && (
          <div className="space-y-2 text-sm text-gray-600">
            <p>✅ Clocked in: {new Date(todayAttendance.clockIn).toLocaleTimeString()}</p>
            {todayAttendance.breakStart && (
              <p>☕ Break started: {new Date(todayAttendance.breakStart).toLocaleTimeString()}</p>
            )}
            {todayAttendance.breakEnd && (
              <p>☕ Break ended: {new Date(todayAttendance.breakEnd).toLocaleTimeString()}</p>
            )}
            <p className="font-medium mt-2">
              Status: 
              <span className={`ml-1 px-2 py-1 rounded text-xs ${
                todayAttendance.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                todayAttendance.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {todayAttendance.status}
              </span>
            </p>
          </div>
        )}
      </div>

                {/* Today's Sessions (shows all clock in/out for today) */}
        {todaySessions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Today's Work Sessions</h3>
            <div className="space-y-2">
              {todaySessions.map((session, index) => (
                <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">Session {index + 1}</span>
                    <span className="text-sm text-gray-600">
                      {new Date(session.clockIn).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-sm text-gray-600">
                      {session.clockOut ? new Date(session.clockOut).toLocaleTimeString() : 'Active'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    {session.clockOut ? `${session.totalHours} hrs` : 'In progress'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Days</p>
            <p className="text-2xl font-bold">{stats.totalDays}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Present</p>
            <p className="text-2xl font-bold text-green-600">{stats.presentDays}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Late</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.lateDays}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Hours</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalHours}</p>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">Attendance History</h3>
        </div>
        
        <div className="p-4 flex gap-4 border-b">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border rounded p-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border rounded p-2"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{new Date(record.clockIn).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 text-sm">
                      {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">{record.totalHours || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        record.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                        record.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Attendance