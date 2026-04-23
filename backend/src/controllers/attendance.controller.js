const prisma = require('../utils/prisma')

// Clock In - Creates a new attendance record
const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.id
    const now = new Date()
    
    // Check if there's an active session (clocked in but not clocked out)
    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOut: null
      }
    })

    if (activeSession) {
      return res.status(409).json({ error: 'You already have an active session. Please clock out first.' })
    }

    // Check shift start time for late status (assuming 9 AM)
    const shiftStart = new Date(now)
    shiftStart.setHours(9, 0, 0, 0)
    const status = now > shiftStart ? 'LATE' : 'PRESENT'

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        clockIn: now,
        status,
        date: now
      }
    })

    res.status(201).json({
      message: 'Clocked in successfully',
      attendance,
      status
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Start Break - Pause current session
const startBreak = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOut: null
      }
    })

    if (!activeSession) {
      return res.status(404).json({ error: 'No active session found' })
    }

    if (activeSession.breakStart && !activeSession.breakEnd) {
      return res.status(409).json({ error: 'Break already in progress' })
    }

    const updated = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: { breakStart: new Date() }
    })

    res.json({ message: 'Break started', attendance: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// End Break - Resume work
const endBreak = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOut: null
      }
    })

    if (!activeSession) {
      return res.status(404).json({ error: 'No active session found' })
    }

    if (!activeSession.breakStart) {
      return res.status(409).json({ error: 'No break in progress' })
    }

    if (activeSession.breakEnd) {
      return res.status(409).json({ error: 'Break already ended' })
    }

    const updated = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: { breakEnd: new Date() }
    })

    res.json({ message: 'Break ended', attendance: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Clock Out - End current session
const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOut: null
      }
    })

    if (!activeSession) {
      return res.status(404).json({ error: 'No active session found' })
    }

    const now = new Date()
    const clockInTime = new Date(activeSession.clockIn)

    // Calculate break duration
    let breakMinutes = 0
    if (activeSession.breakStart && activeSession.breakEnd) {
      const breakStart = new Date(activeSession.breakStart)
      const breakEnd = new Date(activeSession.breakEnd)
      breakMinutes = (breakEnd - breakStart) / (1000 * 60)
    }

    // Calculate total work hours
    const totalMs = now - clockInTime
    const totalHours = parseFloat(((totalMs / (1000 * 60 * 60)) - (breakMinutes / 60)).toFixed(2))

    const updated = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        clockOut: now,
        totalHours: totalHours > 0 ? totalHours : 0
      }
    })

    res.json({
      message: 'Clocked out successfully',
      attendance: updated,
      totalHours
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get today's active session
const getToday = async (req, res) => {
  try {
    const employeeId = req.user.id
    
    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOut: null
      },
      orderBy: { clockIn: 'desc' }
    })

    if (!activeSession) {
      return res.json({ message: 'No active session', attendance: null })
    }

    res.json(activeSession)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get attendance history (all completed sessions)
// Get attendance history (all sessions including active)
const getMyHistory = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { month, year } = req.query

    const now = new Date()
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth()
    const targetYear = year ? parseInt(year) : now.getFullYear()

    const start = new Date(targetYear, targetMonth, 1)
    const end = new Date(targetYear, targetMonth + 1, 1)

    // Get all records (including active sessions)
    const records = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: start, lt: end }
      },
      orderBy: { date: 'desc' }
    })

    // Count UNIQUE days (not sessions)
    const uniqueDays = new Set()
    const completedSessions = []
    
    records.forEach(record => {
      const dateKey = new Date(record.date).toDateString()
      uniqueDays.add(dateKey)
      
      // Only count completed sessions for present/late stats
      if (record.clockOut !== null) {
        completedSessions.push(record)
      }
    })
    
    const totalDays = uniqueDays.size  // Unique calendar days
    const presentDays = completedSessions.filter(r => r.status === 'PRESENT').length
    const lateDays = completedSessions.filter(r => r.status === 'LATE').length
    const totalHours = completedSessions
      .reduce((sum, r) => sum + (r.totalHours || 0), 0)

    res.json({
      month: targetMonth + 1,
      year: targetYear,
      summary: { 
        totalDays,           // Now counts unique days
        presentDays, 
        lateDays, 
        totalHours: parseFloat(totalHours.toFixed(2)) 
      },
      records
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get report for supervisor (all employees)
const getReport = async (req, res) => {
  try {
    const { date, employeeId } = req.query

    const filterDate = date ? new Date(date) : new Date()
    filterDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(filterDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: filterDate, lt: nextDay },
        ...(employeeId && { employeeId: parseInt(employeeId) })
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            position: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { clockIn: 'asc' }
    })

    res.json({
      date: filterDate,
      total: records.length,
      records
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { 
  clockIn, 
  clockOut, 
  startBreak, 
  endBreak, 
  getToday, 
  getReport, 
  getMyHistory 
}