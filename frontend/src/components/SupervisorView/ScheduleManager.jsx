import { useState, useEffect, useMemo, useRef } from 'react'
import BackButton from '../BackButton'
import api from '../../services/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7)

// Color per position group
const POSITION_COLORS = {
  'Kitchen Staff': { bg: 'bg-orange-500', light: 'bg-orange-50', ring: 'ring-orange-400', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  'Service Crew':  { bg: 'bg-blue-500',   light: 'bg-blue-50',   ring: 'ring-blue-400',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  'Supervisor':    { bg: 'bg-purple-500',  light: 'bg-purple-50', ring: 'ring-purple-400',  text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  'Other':         { bg: 'bg-gray-500',    light: 'bg-gray-50',   ring: 'ring-gray-400',    text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-700' },

}

const getPositionGroup = (employee) => {
  const pos = (employee.position || '').toLowerCase()
  if (pos.includes('kitchen') || pos.includes('chef') || pos.includes('cook')) return 'Kitchen Staff'
  if (pos.includes('service') || pos.includes('waiter') || pos.includes('waitress') || pos.includes('cashier') || pos.includes('counter')) return 'Service Crew'
  if (employee.role === 'SUPERVISOR' || pos.includes('supervisor')) return 'Supervisor'
  if (employee.role === 'ADMIN' || pos.includes('manager') || pos.includes('admin')) return 'Management'
  return 'Other'
}

const getDefaultStation = (position) => {
  const pos = (position || '').toLowerCase()
  if (pos.includes('kitchen') || pos.includes('chef') || pos.includes('cook')) return 'Kitchen'
  if (pos.includes('service') || pos.includes('waiter') || pos.includes('waitress') || pos.includes('cashier') || pos.includes('counter')) return 'Service'
  return ''
}

const getSlotColor = (employee) => {
  const group = getPositionGroup(employee)
  return POSITION_COLORS[group] || { bg: 'bg-gray-400', light: 'bg-gray-50', ring: 'ring-gray-300', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-600' }
}

// Helper function to get formatted date for timetable name
const getDefaultTimetableName = () => {
  const now = new Date()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  
  // Function to add ordinal suffix to day (1st, 2nd, 3rd, etc.)
  const getOrdinalDay = (day) => {
    if (day > 3 && day < 21) return `${day}th`
    switch (day % 10) {
      case 1: return `${day}st`
      case 2: return `${day}nd`
      case 3: return `${day}rd`
      default: return `${day}th`
    }
  }
  
  const month = monthNames[now.getMonth()]
  const day = now.getDate()
  const year = now.getFullYear()
  const ordinalDay = getOrdinalDay(day)
  
  // Return format like "April 15th 2026" or "May 1st 2026"
  return `${month} ${ordinalDay} ${year}`
}

// Helper function to get date for effective from (default to next Monday)
const getDefaultEffectiveDate = () => {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday (if today is Monday, use today; otherwise, next Monday)
  let daysUntilMonday
  if (dayOfWeek === 1) {
    daysUntilMonday = 0 // Today is Monday
  } else if (dayOfWeek === 0) {
    daysUntilMonday = 1 // Tomorrow is Monday
  } else {
    daysUntilMonday = 8 - dayOfWeek // Days until next Monday
  }
  
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  
  // Format as YYYY-MM-DD for date input
  return nextMonday.toISOString().split('T')[0]
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
  const [newTimetable, setNewTimetable] = useState({ 
    name: getDefaultTimetableName(), 
    effectiveFrom: getDefaultEffectiveDate() 
  })
  const [newBranch, setNewBranch] = useState({ name: '', address: '' })
  const [dragSource, setDragSource] = useState(null)   // {dayIndex, hour}
  const [dragOver, setDragOver] = useState(null)       // {dayIndex, hour}
  const [copying, setCopying] = useState(false)

  useEffect(() => { fetchBranches(); fetchEmployees() }, [])
  useEffect(() => { if (selectedBranch) fetchTimetable(selectedBranch) }, [selectedBranch])

  // Update timetable name and date when form opens
  const handleOpenCreateForm = () => {
    setNewTimetable({
      name: getDefaultTimetableName(),
      effectiveFrom: getDefaultEffectiveDate()
    })
    setShowCreateForm(true)
  }

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

  const getCellSlots = (dayIndex, hour) => {
    if (!grid[dayIndex]) return []
    return grid[dayIndex]?.hours?.find(h => h.hour === hour)?.slots || []
  }

  // ── DRAG HANDLERS ──────────────────────────────────────────────
  const handleDragStart = (e, dayIndex, hour) => {
    const slots = getCellSlots(dayIndex, hour)
    if (slots.length === 0) { e.preventDefault(); return }
    setDragSource({ dayIndex, hour })
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ dayIndex, hour }))
  }

  const handleDragOver = (e, dayIndex, hour) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver({ dayIndex, hour })
  }

  const handleDragLeave = () => setDragOver(null)

  const handleDrop = async (e, targetDay, targetHour) => {
    e.preventDefault()
    setDragOver(null)

    if (!dragSource) return
    const { dayIndex: srcDay, hour: srcHour } = dragSource

    // Same cell — ignore
    if (srcDay === targetDay && srcHour === targetHour) { setDragSource(null); return }

    const srcSlots = getCellSlots(srcDay, srcHour)
    if (srcSlots.length === 0) { setDragSource(null); return }

    setCopying(true)
    try {
      for (const slot of srcSlots) {
        // Skip if employee already assigned to target cell
        const targetSlots = getCellSlots(targetDay, targetHour)
        const alreadyThere = targetSlots.some(s => s.employee.id === slot.employee.id)
        if (alreadyThere) continue

        await api.post(`/timetable/${timetable.id}/slot`, {
          employeeId: slot.employee.id,
          dayOfWeek: targetDay,
          startHour: targetHour,
          endHour: targetHour + 1,
          station: slot.station
        })
      }
      await fetchTimetable(selectedBranch)
    } catch (err) {
      console.error('Copy failed:', err)
      alert(err.response?.data?.error || 'Some slots could not be copied')
    } finally {
      setCopying(false)
      setDragSource(null)
    }
  }

  const handleDragEnd = () => { setDragSource(null); setDragOver(null) }

  // ── ASSIGN / REMOVE ────────────────────────────────────────────
  const handleCellClick = (dayIndex, hour) => {
    if (!timetable || dragSource) return
    setSelectedCell({ dayIndex, hour })
    setSelectedEmployee('')
    setSelectedStation('')
    setPositionFilter('All')
    setSearchName('')
  }

  const handleEmployeeSelect = (empId) => {
    setSelectedEmployee(empId)
    const emp = employees.find(e => e.id === parseInt(empId))
    if (emp) setSelectedStation(getDefaultStation(emp.position))
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
      setNewTimetable({ 
        name: getDefaultTimetableName(), 
        effectiveFrom: getDefaultEffectiveDate() 
      })
      fetchTimetable(selectedBranch)
    } catch (err) { alert(err.response?.data?.error || 'Failed to create timetable') }
  }

  // ── EMPLOYEE GROUPING ──────────────────────────────────────────
  const groupedEmployees = useMemo(() => {
    const groups = {}
    employees.forEach(emp => {
      const group = getPositionGroup(emp)
      if (group === 'Management' || group === 'Other') return
      if (!groups[group]) groups[group] = []
      groups[group].push(emp)
    })
    return groups
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const assignable = employees.filter(e => {
    const g = getPositionGroup(e)
      return g !== 'Management' && g !== 'Other'
    })
    let list = positionFilter === 'All' ? assignable : (groupedEmployees[positionFilter] || [])
    if (searchName) list = list.filter(e => e.name.toLowerCase().includes(searchName.toLowerCase()))
    return list
  }, [employees, groupedEmployees, positionFilter, searchName])

  return (
    <div className="container mx-auto p-4">
      <BackButton />
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Timetable Manager</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowBranchForm(!showBranchForm)}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm">
            + New Branch
          </button>
          <button onClick={handleOpenCreateForm} disabled={!selectedBranch}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50">
            + New Timetable
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(POSITION_COLORS).filter(([k]) => k !== 'Other').map(([group, colors]) => (
          <span key={group} className={`px-3 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
            ● {group}
          </span>
        ))}
        <span className="ml-4 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          ⟷ Drag cell to copy to another hour
        </span>
      </div>

      {/* Branch Form */}
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
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Timetable Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold mb-4">Create New Timetable</h3>
          <form onSubmit={handleCreateTimetable} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timetable Name</label>
              <input type="text" value={newTimetable.name}
                onChange={(e) => setNewTimetable({ ...newTimetable, name: e.target.value })}
                className="border rounded p-2 w-full" 
                placeholder="e.g. May 2026 Schedule" 
                required />
              <p className="text-xs text-gray-400 mt-1">Auto-suggested: {getDefaultTimetableName()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input type="date" value={newTimetable.effectiveFrom}
                onChange={(e) => setNewTimetable({ ...newTimetable, effectiveFrom: e.target.value })}
                className="border rounded p-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Suggested: Next Monday</p>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Timetable</button>
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Selector */}
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
        {copying && (
          <span className="ml-2 text-xs text-blue-600 animate-pulse font-medium">⟳ Copying slots...</span>
        )}
      </div>

      {/* Assignment Panel */}
      {selectedCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-blue-800">
              Assign Employee — {DAYS[selectedCell.dayIndex]}, {String(selectedCell.hour).padStart(2, '0')}:00–{String(selectedCell.hour + 1).padStart(2, '0')}:00
            </h3>
            <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* Position Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['All', ...Object.keys(groupedEmployees)].map(group => {
              const colors = POSITION_COLORS[group]
              return (
                <button key={group} onClick={() => { setPositionFilter(group); setSelectedEmployee('') }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border
                    ${positionFilter === group
                      ? colors ? `${colors.bg} text-white border-transparent` : 'bg-gray-600 text-white border-transparent'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  {group} {group !== 'All' && `(${(groupedEmployees[group] || []).length})`}
                </button>
              )
            })}
          </div>

          <div className="flex gap-4 flex-wrap items-start">
            <div className="flex-1 min-w-64">
              <input type="text" value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name..."
                className="border rounded p-2 w-full mb-2 text-sm" />
              <div className="border rounded bg-white max-h-40 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400 text-center">No employees found</div>
                ) : filteredEmployees.map(emp => {
                  const colors = POSITION_COLORS[getPositionGroup(emp)] || POSITION_COLORS['Other']
                  return (
                    <div key={emp.id} onClick={() => handleEmployeeSelect(emp.id.toString())}
                      className={`px-3 py-2 cursor-pointer flex justify-between items-center hover:bg-gray-50 border-b last:border-b-0
                        ${selectedEmployee === emp.id.toString() ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors.bg} flex-shrink-0`}></span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.position || emp.role}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{emp.department?.name}</div>
                    </div>
                  )
                })}
              </div>
            </div>

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

      {/* Timetable Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading timetable...</div>
      ) : !timetable ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No active timetable for this branch</p>
          <button onClick={handleOpenCreateForm}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">
            Create Timetable
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 bg-gray-50 border-b text-xs text-gray-500">
            💡 Click any empty cell to assign · Drag a filled cell left/right to copy its staff to another hour · Hover slot to remove
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${HOURS.length * 88 + 100}px` }}>
              <thead>
                <tr className="bg-gray-100">
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
                  <tr key={day}>
                    <td className="border border-gray-200 p-2 text-xs font-semibold text-gray-700 text-center sticky left-0 bg-white z-10 whitespace-nowrap">
                      {day}
                    </td>
                    {HOURS.map(hour => {
                      const slots = getCellSlots(dayIndex, hour)
                      const isSelected = selectedCell?.dayIndex === dayIndex && selectedCell?.hour === hour
                      const isDragSrc = dragSource?.dayIndex === dayIndex && dragSource?.hour === hour
                      const isDragTgt = dragOver?.dayIndex === dayIndex && dragOver?.hour === hour
                      const hasSlots = slots.length > 0

                      return (
                        <td key={hour}
                          onClick={() => handleCellClick(dayIndex, hour)}
                          draggable={hasSlots}
                          onDragStart={(e) => handleDragStart(e, dayIndex, hour)}
                          onDragOver={(e) => handleDragOver(e, dayIndex, hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, dayIndex, hour)}
                          onDragEnd={handleDragEnd}
                          className={`border border-gray-200 p-1 align-top transition-all
                            ${isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''}
                            ${isDragSrc ? 'opacity-50 scale-95' : ''}
                            ${isDragTgt ? 'bg-yellow-100 ring-2 ring-inset ring-yellow-400' : ''}
                            ${!isSelected && !isDragTgt && hasSlots ? 'cursor-grab active:cursor-grabbing' : ''}
                            ${!isSelected && !isDragTgt && !hasSlots ? 'hover:bg-blue-50 cursor-pointer' : ''}
                          `}
                          style={{ minWidth: '80px', minHeight: '56px' }}>

                          {/* Drop target indicator */}
                          {isDragTgt && (
                            <div className="text-center text-yellow-600 text-xs font-medium py-1">
                              ⟷ Copy here
                            </div>
                          )}

                          <div className="flex flex-col gap-0.5">
                            {slots.map(slot => {
                              const colors = getSlotColor(slot.employee)
                              return (
                                <div key={slot.slotId}
                                  className={`${colors.bg} text-white rounded px-1 py-0.5 text-xs flex items-start justify-between gap-0.5 group`}>
                                  <div className="min-w-0">
                                    <div className="font-medium truncate leading-tight">{slot.employee.name}</div>
                                    {slot.station && (
                                      <div className="text-white/70 truncate leading-tight" style={{ fontSize: '10px' }}>
                                        {slot.station}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => handleRemoveSlot(slot.slotId, e)}
                                    className="text-white/50 hover:text-white flex-shrink-0 leading-none font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
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