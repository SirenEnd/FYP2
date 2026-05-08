import { useState, useEffect } from 'react'
import api from '../../services/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7) // 7am to 11pm

const ScheduleManager = () => {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [timetable, setTimetable] = useState(null)
  const [grid, setGrid] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null) // {dayIndex, hour}
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedStation, setSelectedStation] = useState('')
  const [newTimetable, setNewTimetable] = useState({ name: '', effectiveFrom: '' })
  const [newBranch, setNewBranch] = useState({ name: '', address: '' })

  useEffect(() => {
    fetchBranches()
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedBranch) fetchTimetable(selectedBranch)
  }, [selectedBranch])

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data)
      if (res.data.length > 0) setSelectedBranch(res.data[0].id)
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees')
      setEmployees(res.data)
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchTimetable = async (branchId) => {
    setLoading(true)
    try {
      const res = await api.get(`/timetable/branch/${branchId}`)
      setTimetable(res.data.timetable)
      setGrid(res.data.grid)
    } catch (err) {
      if (err.response?.status === 404) {
        setTimetable(null)
        setGrid([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBranch = async (e) => {
    e.preventDefault()
    try {
      await api.post('/branches', newBranch)
      setShowBranchForm(false)
      setNewBranch({ name: '', address: '' })
      fetchBranches()
      alert('Branch created successfully!')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create branch')
    }
  }

  const handleCreateTimetable = async (e) => {
    e.preventDefault()
    try {
      await api.post('/timetable', {
        branchId: selectedBranch,
        name: newTimetable.name,
        effectiveFrom: newTimetable.effectiveFrom
      })
      setShowCreateForm(false)
      setNewTimetable({ name: '', effectiveFrom: '' })
      fetchTimetable(selectedBranch)
      alert('Timetable created successfully!')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create timetable')
    }
  }

  const handleCellClick = (dayIndex, hour) => {
    if (!timetable) return
    setSelectedCell({ dayIndex, hour })
    setSelectedEmployee('')
    setSelectedStation('')
  }

  const handleAssignSlot = async () => {
    if (!selectedEmployee || !selectedCell) return
    try {
      await api.post(`/timetable/${timetable.id}/slot`, {
        employeeId: parseInt(selectedEmployee),
        dayOfWeek: selectedCell.dayIndex,
        startHour: selectedCell.hour,
        endHour: selectedCell.hour + 1,
        station: selectedStation
      })
      setSelectedCell(null)
      fetchTimetable(selectedBranch)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign slot')
    }
  }

  const handleRemoveSlot = async (slotId, e) => {
    e.stopPropagation()
    if (!window.confirm('Remove this assignment?')) return
    try {
      await api.delete(`/timetable/slot/${slotId}`)
      fetchTimetable(selectedBranch)
    } catch (err) {
      alert('Failed to remove slot')
    }
  }

  const getCellColor = (slots) => {
    if (slots.length === 0) return 'bg-gray-50 hover:bg-blue-50 cursor-pointer'
    if (slots.length === 1) return 'bg-blue-100 hover:bg-blue-200 cursor-pointer'
    return 'bg-green-100 hover:bg-green-200 cursor-pointer'
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Timetable Manager</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBranchForm(!showBranchForm)}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
          >
            + New Branch
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={!selectedBranch}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            + New Timetable
          </button>
        </div>
      </div>

      {/* New Branch Form */}
      {showBranchForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Branch</h3>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
              <input
                type="text"
                value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                className="border rounded p-2 w-full"
                placeholder="e.g. KL Main Branch"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={newBranch.address}
                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                className="border rounded p-2 w-full"
                placeholder="e.g. Jalan Bukit Bintang, KL"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Create Branch
              </button>
              <button
                type="button"
                onClick={() => setShowBranchForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Timetable Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Timetable</h3>
          <form onSubmit={handleCreateTimetable} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timetable Name</label>
              <input
                type="text"
                value={newTimetable.name}
                onChange={(e) => setNewTimetable({ ...newTimetable, name: e.target.value })}
                className="border rounded p-2 w-full"
                placeholder="e.g. May 2026 Schedule"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input
                type="date"
                value={newTimetable.effectiveFrom}
                onChange={(e) => setNewTimetable({ ...newTimetable, effectiveFrom: e.target.value })}
                className="border rounded p-2 w-full"
                required
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Create Timetable
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex items-center gap-4">
        <label className="font-medium text-gray-700">Branch:</label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
          className="border rounded p-2 min-w-48"
        >
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {timetable && (
          <div className="ml-4 text-sm text-gray-600">
            <span className="font-medium">{timetable.name}</span>
            <span className="ml-2">· Effective: {new Date(timetable.effectiveFrom).toLocaleDateString()}</span>
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
          </div>
        )}
      </div>

      {/* Slot Assignment Panel */}
      {selectedCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-3">
            Assign Employee — {DAYS[selectedCell.dayIndex]} {String(selectedCell.hour).padStart(2, '0')}:00
          </h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="border rounded p-2 min-w-48"
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.position || emp.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Station (optional)</label>
              <input
                type="text"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="border rounded p-2 w-48"
                placeholder="e.g. Kitchen A"
              />
            </div>
            <button
              onClick={handleAssignSlot}
              disabled={!selectedEmployee}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Assign
            </button>
            <button
              onClick={() => setSelectedCell(null)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timetable Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading timetable...</div>
      ) : !timetable ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No active timetable for this branch</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            Create Timetable
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 bg-gray-50 border-b text-xs text-gray-500">
            💡 Click any cell to assign an employee. Click ✕ on an assignment to remove it.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 w-20 sticky left-0 bg-gray-100 z-10">
                    Time
                  </th>
                  {DAYS.map(day => (
                    <th key={day} className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 min-w-36">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-2 text-xs font-medium text-gray-500 text-center sticky left-0 bg-white z-10">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {DAYS.map((day, dayIndex) => {
                      const cell = grid[dayIndex]?.hours.find(h => h.hour === hour)
                      const slots = cell?.slots || []
                      const isSelected = selectedCell?.dayIndex === dayIndex && selectedCell?.hour === hour

                      return (
                        <td
                          key={day}
                          className={`border border-gray-200 p-1 text-xs align-top transition-colors
                            ${isSelected ? 'bg-blue-200 ring-2 ring-blue-400' : getCellColor(slots)}`}
                          onClick={() => handleCellClick(dayIndex, hour)}
                          style={{ minHeight: '48px' }}
                        >
                          {slots.map(slot => (
                            <div
                              key={slot.slotId}
                              className="bg-blue-600 text-white rounded px-1 py-0.5 mb-0.5 flex justify-between items-start"
                            >
                              <div>
                                <div className="font-medium truncate max-w-24">{slot.employee.name}</div>
                                {slot.station && (
                                  <div className="text-blue-200 text-xs truncate">{slot.station}</div>
                                )}
                              </div>
                              <button
                                onClick={(e) => handleRemoveSlot(slot.slotId, e)}
                                className="text-blue-200 hover:text-white ml-1 font-bold leading-none"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScheduleManager