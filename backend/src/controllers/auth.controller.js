const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find employee by email
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { department: true }
    })

    if (!employee) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (!employee.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, employee.password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: employee.id,
        employeeId: employee.employeeId,
        role: employee.role,
        departmentId: employee.departmentId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    // Return token + safe employee data
    res.json({
      message: 'Login successful',
      token,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        position: employee.position,
        department: employee.department.name
      }
    })

  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.id },
      include: { department: true },
      omit: { password: true }
    })
    res.json(employee)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { login, getMe }