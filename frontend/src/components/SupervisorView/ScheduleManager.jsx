import { useState, useEffect } from 'react'
import api from '../../services/api'
import useAuthStore from '../../stores/authStore'

const ScheduleManager = () => {
  const { user } = useAuthStore()
  const [schedules, setSchedules] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [formData, setFormData] = useState({
    employeeId: '',
    shiftDate: new Date().toISOString().split('T')[0],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    station: ''
  })

  useEffect(() => {
    fetchStaff()
    fetchSchedules()
  }, [selectedDate])

    const fetchStaff = async () => {
    try {
      const response = await api.get('/employees/staff')
      console.log('Staff loaded:', response.data)
      setStaff(response.data)
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/schedule?date=${selectedDate}`)
      setSchedules(response.data.schedules || [])
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/schedule', formData)
      setShowForm(false)
      setFormData({
        employeeId: '',
        shiftDate: selectedDate,
        shiftStart: '09:00',
        shiftEnd: '17:00',
        station: ''
      })
      fetchSchedules()
      alert('Shift created successfully!')
    } catch (error) {
      console.error('Failed to create shift:', error)
      alert(error.response?.data?.error || 'Failed to create shift')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to cancel this shift?')) {
      try {
        await api.delete(`/schedule/${id}`)
        fetchSchedules()
        alert('Shift cancelled successfully')
      } catch (error) {
        console.error('Failed to delete shift:', error)
        alert('Failed to cancel shift')
      }
    }
  }

  const getEmployeeName = (employeeId) => {
    const emp = staff.find(s => s.id === employeeId)
    return emp ? emp.name : 'Unknown'
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Schedule Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Shift'}
        </button>
      </div>

      {/* Date Picker */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded p-2 w-64"
        />
      </div>

      {/* Add Shift Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Shift</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                className="border rounded p-2 w-full"
                required
              >
                <option value="">Select Staff</option>
                {staff.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.position || emp.role}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.shiftDate}
                onChange={(e) => setFormData({...formData, shiftDate: e.target.value})}
                className="border rounded p-2 w-full"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.shiftStart}
                onChange={(e) => setFormData({...formData, shiftStart: e.target.value})}
                className="border rounded p-2 w-full"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={formData.shiftEnd}
                onChange={(e) => setFormData({...formData, shiftEnd: e.target.value})}
                className="border rounded p-2 w-full"
                required
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Station/Area</label>
              <input
                type="text"
                placeholder="e.g., Kitchen Station A, Front Counter, Bar"
                value={formData.station}
                onChange={(e) => setFormData({...formData, station: e.target.value})}
                className="border rounded p-2 w-full"
              />
            </div>
            
            <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700 col-span-2">
              Create Shift
            </button>
          </form>
        </div>
      )}

      {/* Schedules List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="font-semibold">Shifts for {new Date(selectedDate).toLocaleDateString()}</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No shifts scheduled for this date
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Station</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{schedule.employee?.name || getEmployeeName(schedule.employeeId)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{schedule.employee?.position || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {schedule.shiftStart} - {schedule.shiftEnd}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{schedule.station || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      schedule.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                      schedule.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Cancel
                    </button>
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

export default ScheduleManager