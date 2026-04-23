import { useState, useEffect } from 'react'
import api from '../../services/api'

const AttendanceReport = () => {
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [selectedDate, selectedEmployee])

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
      if (selectedEmployee) {
        url += `&employeeId=${selectedEmployee}`
      }
      const response = await api.get(url)
      setAttendances(response.data.records || [])
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'PRESENT': return 'bg-green-100 text-green-700'
      case 'LATE': return 'bg-yellow-100 text-yellow-700'
      case 'ABSENT': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Attendance Report</h2>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
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
            className="border rounded p-2"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.position || emp.role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : attendances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No attendance records found for this date
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Break</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendances.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{record.employee?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.employee?.position || '-'}</td>
                  <td className="px-6 py-4 text-sm">{new Date(record.clockIn).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-sm">
                    {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {record.breakStart && record.breakEnd ? 
                      `${new Date(record.breakStart).toLocaleTimeString()} - ${new Date(record.breakEnd).toLocaleTimeString()}` : 
                      '-'
                    }
                  </td>
                  <td className="px-6 py-4 text-sm">{record.totalHours || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AttendanceReport