import { useState, useEffect } from 'react'
import BackButton from '../BackButton'
import api from '../../services/api'

const EmployeeManager = () => {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'STAFF',
    position: '',
    salary: 0,
    departmentId: '',
    branchId: ''
  })
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchEmployees()
    fetchBranches()
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments')
      setDepartments(res.data)
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data)
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
      if (err.response?.status === 403) {
        alert('Access denied. Admin rights required.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getBlankForm = () => ({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'STAFF',
    position: '',
    salary: 0,
    departmentId: departments[0]?.id || '',
    branchId: ''
  })

  const resetForm = () => {
    setFormData(getBlankForm())
    setEditingEmployee(null)
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setFormData({
      employeeId: employee.employeeId || '',
      name: employee.name || '',
      email: employee.email || '',
      password: '',                                   // never pre-fill password
      phone: employee.phone || '',
      role: employee.role || 'STAFF',
      position: employee.position || '',
      salary: employee.salary ?? 0,
      departmentId: employee.departmentId || employee.department?.id || '',
      branchId: employee.branchId || ''              // ← now works because backend returns branchId
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Build the payload — omit blank password on edits
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        position: formData.position,
        salary: parseFloat(formData.salary) || 0,
        departmentId: parseInt(formData.departmentId),
        branchId: formData.branchId ? parseInt(formData.branchId) : null
      }

      if (formData.password.trim() !== '') {
        payload.password = formData.password
      }

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload)
        alert('Employee updated successfully!')
      } else {
        // New employee needs employeeId + password
        payload.employeeId = formData.employeeId
        if (!formData.password.trim()) {
          alert('Password is required for new employees.')
          setSubmitting(false)
          return
        }
        payload.password = formData.password
        await api.post('/employees', payload)
        alert('Employee created successfully!')
      }

      setShowForm(false)
      resetForm()
      fetchEmployees()
    } catch (err) {
      console.error('Failed to save employee:', err)
      alert(err.response?.data?.error || 'Failed to save employee')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (employee) => {
    if (!window.confirm(`Are you sure you want to deactivate ${employee.name}? This cannot be undone.`)) return

    try {
      await api.delete(`/employees/${employee.id}`)
      alert('Employee deactivated successfully!')
      fetchEmployees()
    } catch (err) {
      console.error('Failed to delete employee:', err)
      alert(err.response?.data?.error || 'Failed to delete employee')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    resetForm()
  }

  if (loading) return <div className="text-center py-8">Loading...</div>

  return (
    <div className="container mx-auto p-6">
      <BackButton />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Employee Management</h2>
        <button
          onClick={() => {
            if (showForm && !editingEmployee) {
              handleCancel()
            } else {
              resetForm()
              setShowForm(true)
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm && !editingEmployee ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold mb-4">
            {editingEmployee ? `Edit Employee — ${editingEmployee.name}` : 'Add New Employee'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {/* Employee ID — read-only when editing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <input
                type="text"
                placeholder="e.g. RST-011"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className={`border rounded p-2 w-full ${editingEmployee ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                required={!editingEmployee}
                disabled={!!editingEmployee}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border rounded p-2 w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border rounded p-2 w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editingEmployee && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                placeholder={editingEmployee ? 'Leave blank to keep current' : 'Password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="border rounded p-2 w-full"
                required={!editingEmployee}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="Phone (optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="border rounded p-2 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="border rounded p-2 w-full"
              >
                <option value="STAFF">Staff</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                placeholder="e.g. Kitchen Crew"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="border rounded p-2 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary (RM)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Salary"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="border rounded p-2 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="border rounded p-2 w-full"
                required
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="border rounded p-2 w-full"
                required
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex-1 disabled:opacity-50"
              >
                {submitting
                  ? 'Saving…'
                  : editingEmployee ? 'Update Employee' : 'Create Employee'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 p-2 rounded hover:bg-gray-400 flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{emp.employeeId}</td>
                    <td className="px-6 py-4 text-sm font-medium">{emp.name}</td>
                    <td className="px-6 py-4 text-sm">{emp.email}</td>
                    <td className="px-6 py-4 text-sm">{emp.branch?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        emp.role === 'ADMIN'      ? 'bg-purple-100 text-purple-700' :
                        emp.role === 'SUPERVISOR' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-green-100 text-green-700'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{emp.position || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      RM {emp.salary?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(emp)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </div>
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

export default EmployeeManager
