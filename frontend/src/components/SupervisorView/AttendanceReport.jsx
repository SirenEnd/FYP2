import { useState, useEffect } from 'react'
import api from '../../services/api'

const AttendanceReport = () => {
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [summary, setSummary] = useState({ total: 0, present: 0, late: 0, absent: 0 })

  useEffect(() => { fetchEmployees() }, [])
  useEffect(() => { fetchReport() }, [selectedDate, selectedEmployee])

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees')
      setEmployees(response.data)
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      let url = `/attendance/report?date=${selectedDate}`
      if (selectedEmployee) url += `&employeeId=${selectedEmployee}`
      const response = await api.get(url)
      const records = response.data.records || []
      setAttendances(records)

      // Calculate summary
      setSummary({
        total: records.length,
        present: records.filter(r => r.status === 'PRESENT').length,
        late: records.filter(r => r.status === 'LATE').length,
        absent: records.filter(r => r.status === 'ABSENT').length
      })
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PRESENT': return 'bg-green-100 text-green-700'
      case 'LATE': return 'bg-yellow-100 text-yellow-700'
      case 'ABSENT': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatTime = (time) => time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  const getBreakDuration = (record) => {
    if (!record.breakStart || !record.breakEnd) return '—'
    const mins = Math.round((new Date(record.breakEnd) - new Date(record.breakStart)) / 60000)
    return `${mins} min`
  }

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Attendance Report</h2>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border rounded p-2 min-w-48"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {emp.position || emp.role}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchReport}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
          <div className="text-sm text-gray-500 mt-1">Total Records</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{summary.present}</div>
          <div className="text-sm text-gray-500 mt-1">Present</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{summary.late}</div>
          <div className="text-sm text-gray-500 mt-1">Late</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
          <div className="text-sm text-gray-500 mt-1">Absent</div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">
            Records for {new Date(selectedDate).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>
          <span className="text-sm text-gray-500">{summary.total} record(s)</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : attendances.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-1">No attendance records found</p>
            <p className="text-sm">for {new Date(selectedDate).toLocaleDateString()}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Break</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendances.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-800">{record.employee?.name}</div>
                      <div className="text-xs text-gray-400">{record.employee?.employeeId}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {record.employee?.position || '—'}
                    </td>
                    <td className="px-4 py-4">
                      {record.branch ? (
                        <div>
                          <div className="text-sm font-medium text-blue-700">{record.branch.name}</div>
                          {record.distanceMeters && (
                            <div className="text-xs text-gray-400">{record.distanceMeters}m from branch</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No location data</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                      {formatTime(record.clockIn)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                      {formatTime(record.clockOut)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {record.breakStart ? (
                        <div>
                          <div className="font-mono text-xs">{formatTime(record.breakStart)} – {formatTime(record.breakEnd)}</div>
                          <div className="text-xs text-gray-400">{getBreakDuration(record)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-800">
                      {record.totalHours ? `${record.totalHours}h` : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AttendanceReport