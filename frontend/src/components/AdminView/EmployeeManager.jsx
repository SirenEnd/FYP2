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
    departmentId: 1,
    branchId: null
  })
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    fetchEmployees()
    fetchBranches()
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    const res = await api.get('/departments')
    setDepartments(res.data)
  }

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches')
      setBranches(response.data)
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees')
      setEmployees(response.data)
    } catch (error) {
      console.error('Failed to fetch employees:', error)
      if (error.response?.status === 403) {
        alert('Access denied. Admin rights required.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'STAFF',
      position: '',
      salary: 0,
      departmentId: departments[0]?.id || 1,
      branchId: null
    })
    setEditingEmployee(null)
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setFormData({
      employeeId: employee.employeeId || '',
      name: employee.name || '',
      email: employee.email || '',
      password: '', // Don't populate password for security
      phone: employee.phone || '',
      role: employee.role || 'STAFF',
      position: employee.position || '',
      salary: employee.salary || 0,
      departmentId: employee.departmentId || departments[0]?.id || 1,
      branchId: employee.branchId || null
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingEmployee) {
        // Update existing employee
        await api.put(`/employees/${editingEmployee.id}`, formData)
        alert('Employee updated successfully!')
      } else {
        // Create new employee
        await api.post('/employees', formData)
        alert('Employee created successfully!')
      }
      setShowForm(false)
      resetForm()
      fetchEmployees()
    } catch (error) {
      console.error('Failed to save employee:', error)
      alert(error.response?.data?.error || 'Failed to save employee')
    }
  }

  const handleDelete = async (employee) => {
    if (!window.confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
      return
    }
    
    try {
      await api.delete(`/employees/${employee.id}`)
      alert('Employee deleted successfully!')
      fetchEmployees()
    } catch (error) {
      console.error('Failed to delete employee:', error)
      alert(error.response?.data?.error || 'Failed to delete employee')
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
            resetForm()
            setShowForm(!showForm)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Employee ID (e.g., RST-011)"
              value={formData.employeeId}
              onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
              className="border rounded p-2"
              required
              disabled={editingEmployee} // Disable editing of employee ID
            />
            <input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="border rounded p-2"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="border rounded p-2"
              required
            />
            <input
              type="password"
              placeholder={editingEmployee ? "Password (leave blank to keep current)" : "Password"}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="border rounded p-2"
              required={!editingEmployee}
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="border rounded p-2"
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="border rounded p-2"
            >
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={formData.departmentId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  departmentId: parseInt(e.target.value)
                })
              }
              className="border rounded p-2"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Salary (RM)"
              value={formData.salary}
              onChange={(e) => setFormData({...formData, salary: parseFloat(e.target.value)})}
              className="border rounded p-2"
            />
            <select
              value={formData.branchId || ''}
              onChange={(e) =>
                setFormData({ ...formData, branchId: e.target.value ? parseInt(e.target.value) : null })
              }
              className="border rounded p-2"
              required
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex-1">
                {editingEmployee ? 'Update Employee' : 'Create Employee'}
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
                    <td className="px-6 py-4 text-sm">{emp.branch?.name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        emp.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        emp.role === 'SUPERVISOR' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{emp.position || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      RM {emp.salary?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
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