import { useState, useEffect, useMemo } from 'react'
import api from '../../services/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7) // 7am to 11pm

const POSITION_GROUPS = {
  'Kitchen Staff': ['Kitchen Staff', 'Head Chef', 'Sous Chef', 'Cook', 'Kitchen Crew'],
  'Service Crew': ['Service Crew', 'Waiter', 'Waitress', 'Cashier', 'Front Counter'],
  'Supervisor': ['Supervisor', 'Kitchen Supervisor', 'Floor Supervisor'],
  'Management': ['Admin', 'Manager', 'System Administrator'],
  'Other': []
}

const getDefaultStation = (position, role) => {
  const pos = (position || '').toLowerCase()
  if (pos.includes('kitchen') || pos.includes('chef') || pos.includes('cook')) return 'Kitchen'
  if (pos.includes('service') || pos.includes('waiter') || pos.includes('waitress') ||
      pos.includes('cashier') || pos.includes('counter')) return 'Service'
  return ''
}

const getPositionGroup = (employee) => {
  const pos = employee.position || ''
  for (const [group, keywords] of Object.entries(POSITION_GROUPS)) {
    if (group === 'Other') continue
    if (keywords.some(k => pos.toLowerCase().includes(k.toLowerCase()))) return group
  }
  if (employee.role === 'SUPERVISOR') return 'Supervisor'
  if (employee.role === 'ADMIN') return 'Management'
  return 'Other'
}

const ScheduleManager = () => {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [timetable, setTimetable] = useState(null)
  const [grid, setGrid] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedStation, setSelectedStation] = useState('')
  const [positionFilter, setPositionFilter] = useState('All')
  const [searchName, setSearchName] = useState('')
  const [newTimetable, setNewTimetable] = useState({ name: '', effectiveFrom: '' })
  const [newBranch, setNewBranch] = useState({ name: '', address: '' })

  useEffect(() => { fetchBranches(); fetchEmployees() }, [])
  useEffect(() => { if (selectedBranch) fetchTimetable(selectedBranch) }, [selectedBranch])

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
      setEmployees(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchTimetable = async (branchId) => {
    setLoading(true)
    try {
      const res = await api.get(`/timetable/branch/${branchId}`)
      setTimetable(res.data.timetable)
      setGrid(res.data.grid)
    } catch (err) {
      if (err.response?.status === 404) { setTimetable(null); setGrid([]) }
    } finally { setLoading(false) }
  }

  const handleCreateBranch = async (e) => {
    e.preventDefault()
    try {
      await api.post('/branches', newBranch)
      setShowBranchForm(false)
      setNewBranch({ name: '', address: '' })
      fetchBranches()
    } catch (err) { alert(err.response?.data?.error || 'Failed to create branch') }
  }

  const handleCreateTimetable = async (e) => {
    e.preventDefault()
    try {
      await api.post('/timetable', { branchId: selectedBranch, ...newTimetable })
      setShowCreateForm(false)
      setNewTimetable({ name: '', effectiveFrom: '' })
      fetchTimetable(selectedBranch)
    } catch (err) { alert(err.response?.data?.error || 'Failed to create timetable') }
  }

  const handleCellClick = (dayIndex, hour) => {
    if (!timetable) return
    setSelectedCell({ dayIndex, hour })
    setSelectedEmployee('')
    setSelectedStation('')
    setPositionFilter('All')
    setSearchName('')
  }

  const handleEmployeeSelect = (empId) => {
    setSelectedEmployee(empId)
    const emp = employees.find(e => e.id === parseInt(empId))
    if (emp) setSelectedStation(getDefaultStation(emp.position, emp.role))
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
    } catch (err) { alert(err.response?.data?.error || 'Failed to assign slot') }
  }

  const handleRemoveSlot = async (slotId, e) => {
    e.stopPropagation()
    if (!window.confirm('Remove this assignment?')) return
    try {
      await api.delete(`/timetable/slot/${slotId}`)
      fetchTimetable(selectedBranch)
    } catch (err) { alert('Failed to remove slot') }
  }

  // Group employees by position for the selector
  const groupedEmployees = useMemo(() => {
    const groups = {}
    employees.forEach(emp => {
      const group = getPositionGroup(emp)
      if (!groups[group]) groups[group] = []
      groups[group].push(emp)
    })
    return groups
  }, [employees])

  const filteredEmployees = useMemo(() => {
    let list = positionFilter === 'All' ? employees : (groupedEmployees[positionFilter] || [])
    if (searchName) list = list.filter(e => e.name.toLowerCase().includes(searchName.toLowerCase()))
    return list
  }, [employees, groupedEmployees, positionFilter, searchName])

  // Get slots for a specific day+hour cell
  const getCellSlots = (dayIndex, hour) => {
    if (!grid[dayIndex]) return []
    const hourData = grid[dayIndex]?.hours?.find(h => h.hour === hour)
    return hourData?.slots || []
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Timetable Manager</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowBranchForm(!showBranchForm)}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm">
            + New Branch
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} disabled={!selectedBranch}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50">
            + New Timetable
          </button>
        </div>
      </div>

      {/* New Branch Form */}
      {showBranchForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-gray-600">
          <h3 className="text-lg font-semibold mb-4">Create New Branch</h3>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
              <input type="text" value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                className="border rounded p-2 w-full" placeholder="e.g. KL Main Branch" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={newBranch.address}
                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                className="border rounded p-2 w-full" placeholder="e.g. Jalan Bukit Bintang, KL" />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Branch</button>
              <button type="button" onClick={() => setShowBranchForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* New Timetable Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold mb-4">Create New Timetable</h3>
          <form onSubmit={handleCreateTimetable} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timetable Name</label>
              <input type="text" value={newTimetable.name}
                onChange={(e) => setNewTimetable({ ...newTimetable, name: e.target.value })}
                className="border rounded p-2 w-full" placeholder="e.g. May 2026 Schedule" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input type="date" value={newTimetable.effectiveFrom}
                onChange={(e) => setNewTimetable({ ...newTimetable, effectiveFrom: e.target.value })}
                className="border rounded p-2 w-full" required />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Timetable</button>
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Selector + Timetable Info */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-4">
        <label className="font-medium text-gray-700">Branch:</label>
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
          className="border rounded p-2 min-w-48">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {timetable && (
          <div className="ml-2 text-sm text-gray-600 flex items-center gap-2">
            <span className="font-medium">{timetable.name}</span>
            <span>· Effective: {new Date(timetable.effectiveFrom).toLocaleDateString()}</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
          </div>
        )}
      </div>

      {/* Employee Assignment Panel */}
      {selectedCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-blue-800">
              Assign Employee — {DAYS[selectedCell.dayIndex]}, {String(selectedCell.hour).padStart(2, '0')}:00–{String(selectedCell.hour + 1).padStart(2, '0')}:00
            </h3>
            <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>

          {/* Position Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['All', ...Object.keys(groupedEmployees)].map(group => (
              <button key={group}
                onClick={() => { setPositionFilter(group); setSelectedEmployee('') }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${positionFilter === group
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                {group} {group !== 'All' && `(${(groupedEmployees[group] || []).length})`}
              </button>
            ))}
          </div>

          {/* Search + Employee List */}
          <div className="flex gap-4 flex-wrap items-start">
            <div className="flex-1 min-w-64">
              <input type="text" value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name..."
                className="border rounded p-2 w-full mb-2 text-sm" />
              <div className="border rounded bg-white max-h-40 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400 text-center">No employees found</div>
                ) : (
                  filteredEmployees.map(emp => (
                    <div key={emp.id}
                      onClick={() => handleEmployeeSelect(emp.id.toString())}
                      className={`px-3 py-2 cursor-pointer flex justify-between items-center hover:bg-blue-50 border-b last:border-b-0
                        ${selectedEmployee === emp.id.toString() ? 'bg-blue-100 border-blue-200' : ''}`}>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{emp.name}</div>
                        <div className="text-xs text-gray-500">{emp.position || emp.role}</div>
                      </div>
                      <div className="text-xs text-gray-400">{emp.department?.name}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Station + Assign */}
            <div className="flex flex-col gap-3 min-w-48">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                <input type="text" value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="border rounded p-2 w-full text-sm"
                  placeholder="Auto-filled by position" />
                <p className="text-xs text-gray-400 mt-1">Auto-filled based on role</p>
              </div>
              <button onClick={handleAssignSlot} disabled={!selectedEmployee}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium">
                ✓ Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Grid — Days as ROWS, Hours as COLUMNS */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading timetable...</div>
      ) : !timetable ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No active timetable for this branch</p>
          <button onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">
            Create Timetable
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 bg-gray-50 border-b text-xs text-gray-500 flex justify-between">
            <span>💡 Click any cell to assign an employee. Click ✕ on a tag to remove.</span>
            <span>Showing 07:00 – 24:00</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${HOURS.length * 90 + 100}px` }}>
              <thead>
                <tr className="bg-gray-100">
                  {/* Day column header */}
                  <th className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 w-24 sticky left-0 bg-gray-100 z-10">
                    Day / Hour
                  </th>
                  {HOURS.map(hour => (
                    <th key={hour} className="border border-gray-200 p-2 text-xs font-semibold text-gray-600 text-center min-w-20">
                      {String(hour).padStart(2, '0')}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIndex) => (
                  <tr key={day} className="hover:bg-gray-50">
                    {/* Day label — sticky left */}
                    <td className="border border-gray-200 p-2 text-xs font-semibold text-gray-700 text-center sticky left-0 bg-white z-10 whitespace-nowrap">
                      {day}
                    </td>
                    {HOURS.map(hour => {
                      const slots = getCellSlots(dayIndex, hour)
                      const isSelected = selectedCell?.dayIndex === dayIndex && selectedCell?.hour === hour
                      return (
                        <td key={hour}
                          onClick={() => handleCellClick(dayIndex, hour)}
                          className={`border border-gray-200 p-1 align-top cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' :
                              slots.length > 0 ? 'bg-green-50 hover:bg-green-100' :
                              'hover:bg-blue-50'}`}
                          style={{ minWidth: '80px', minHeight: '52px' }}>
                          <div className="flex flex-col gap-0.5">
                            {slots.map(slot => (
                              <div key={slot.slotId}
                                className="bg-blue-600 text-white rounded px-1 py-0.5 text-xs flex items-start justify-between gap-0.5 group">
                                <div className="min-w-0">
                                  <div className="font-medium truncate leading-tight">{slot.employee.name}</div>
                                  {slot.station && (
                                    <div className="text-blue-200 truncate leading-tight" style={{ fontSize: '10px' }}>
                                      {slot.station}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => handleRemoveSlot(slot.slotId, e)}
                                  className="text-blue-300 hover:text-white flex-shrink-0 leading-none font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
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