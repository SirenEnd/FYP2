require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

// Middleware - FIXED CORS
app.use(cors({
  origin: 'http://localhost:5173',  // Your frontend URL
  credentials: true,                 // Important for auth
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
const scheduleRoutes = require('./routes/schedule.routes')
const payrollRoutes = require('./routes/payroll.routes')

app.use('/api/auth', authRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/payroll', payrollRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'RestroHR API is running',
    version: '1.0.0',
    status: 'OK'
  })
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