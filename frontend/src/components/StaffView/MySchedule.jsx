import { useState, useEffect } from 'react'
import api from '../../services/api'
import useAuthStore from '../../stores/authStore'

const MySchedule = () => {
  const { user } = useAuthStore()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchMySchedule()
  }, [selectedMonth, selectedYear])

  const fetchMySchedule = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/schedule/my?month=${selectedMonth}&year=${selectedYear}`)
      setSchedules(response.data.schedules || [])
    } catch (error) {
      console.error('Failed to fetch schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group schedules by date
  const groupedSchedules = schedules.reduce((groups, schedule) => {
    const date = new Date(schedule.shiftDate).toLocaleDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(schedule)
    return groups
  }, {})

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">My Schedule</h2>

      {/* Month/Year Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
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

      {/* Schedule Cards */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : Object.keys(groupedSchedules).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No shifts scheduled for this month
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedSchedules).map(([date, daySchedules]) => (
            <div key={date} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold">{date}</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {daySchedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b last:border-b-0">
                      <td className="px-6 py-4">
                        <div className="font-medium">{schedule.shiftStart} - {schedule.shiftEnd}</div>
                        {schedule.station && (
                          <div className="text-sm text-gray-500 mt-1">Station: {schedule.station}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          schedule.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                          schedule.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {schedule.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MySchedule