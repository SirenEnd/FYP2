require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
const authRoutes = require('./routes/auth.routes')
const employeeRoutes = require('./routes/employee.routes')
const departmentRoutes = require('./routes/department.routes')
const attendanceRoutes = require('./routes/attendance.routes')
const leaveRoutes = require('./routes/leave.routes')
const payrollRoutes = require('./routes/payroll.routes')
const branchRoutes = require('./routes/branch.routes')
const timetableRoutes = require('./routes/timetable.routes')
const taskRoutes = require('./routes/task.routes')
const jobApplicationRoutes = require('./routes/jobApplication.routes')

app.use('/api/auth', authRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leave', leaveRoutes)
app.use('/api/payroll', payrollRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/timetable', timetableRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/jobapplications', jobApplicationRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'RestroHR API is running', version: '1.0.0', status: 'OK' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

module.exports = app