const prisma = require('../utils/prisma')
const bcrypt = require('bcryptjs')

const getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        position: true,
        salary: true,
        joinDate: true,
        isActive: true,
        department: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    })
    res.json(employees)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const getStaffList = async (req, res) => {
  try {
    const staff = await prisma.employee.findMany({
      where: { 
        role: 'STAFF',
        isActive: true 
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        position: true,
        role: true
      }
    })
    console.log('Staff list:', staff) // Debug log
    res.json(staff)
  } catch (err) {
    console.error('Error:', err)
    res.status(500).json({ error: err.message })
  }
}

const getEmployeeById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' })
    }

    if (req.user.role === 'STAFF' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: id },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        position: true,
        salary: true,
        joinDate: true,
        isActive: true,
        department: { select: { id: true, name: true } }
      }
    })

    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const createEmployee = async (req, res) => {
  try {
    const { employeeId, name, email, password, phone, role, position, salary, departmentId } = req.body

    if (!employeeId || !name || !email || !password || !departmentId) {
      return res.status(400).json({ error: 'employeeId, name, email, password and departmentId are required' })
    }

    const existing = await prisma.employee.findFirst({
      where: { OR: [{ email }, { employeeId }] }
    })
    if (existing) return res.status(409).json({ error: 'Email or Employee ID already exists' })

    const hashedPassword = await bcrypt.hash(password, 10)

    const employee = await prisma.employee.create({
      data: {
        employeeId,
        name,
        email,
        password: hashedPassword,
        phone,
        role: role || 'STAFF',
        position,
        salary: parseFloat(salary) || 0,
        departmentId: parseInt(departmentId)
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        salary: true,
        department: { select: { id: true, name: true } }
      }
    })

    res.status(201).json({ message: 'Employee created successfully', employee })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const updateEmployee = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, email, phone, role, position, salary, departmentId, isActive } = req.body

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(role && { role }),
        ...(position && { position }),
        ...(salary && { salary: parseFloat(salary) }),
        ...(departmentId && { departmentId: parseInt(departmentId) }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        salary: true,
        isActive: true,
        department: { select: { id: true, name: true } }
      }
    })

    res.json({ message: 'Employee updated successfully', employee })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const deleteEmployee = async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    await prisma.employee.update({
      where: { id },
      data: { isActive: false }
    })

    res.json({ message: 'Employee deactivated successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { 
  getAllEmployees, 
  getStaffList,
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
}