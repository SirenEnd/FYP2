const prisma = require('../utils/prisma')

// ── HAVERSINE FORMULA ─────────────────────────────────────────────
const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ── CLOCK IN ──────────────────────────────────────────────────────
const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { latitude, longitude } = req.body

    // 1. Require GPS coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Location is required to clock in. Please enable GPS.'
      })
    }

    // 2. Get all active branches with coordinates
    const branches = await prisma.branch.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null }
      }
    })

    if (branches.length === 0) {
      return res.status(400).json({
        error: 'No branches with location data found. Contact your admin.'
      })
    }

    // 3. Find nearest branch
    let nearestBranch = null
    let nearestDistance = Infinity

    for (const branch of branches) {
      const distance = getDistanceMeters(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(branch.latitude),
        parseFloat(branch.longitude)
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestBranch = branch
      }
    }

    // 4. Check within 100m radius
    const RADIUS_METERS = 100
    if (nearestDistance > RADIUS_METERS) {
      return res.status(403).json({
        error: `You are too far from any branch. Nearest: ${nearestBranch.name} (${Math.round(nearestDistance)}m away). Must be within ${RADIUS_METERS}m.`,
        nearestBranch: nearestBranch.name,
        distanceMeters: Math.round(nearestDistance),
        requiredMeters: RADIUS_METERS
      })
    }

    // 5. Check for already active session
    const activeSession = await prisma.attendance.findFirst({
      where: { employeeId, clockOut: null }
    })

    if (activeSession) {
      return res.status(409).json({
        error: 'You already have an active session. Please clock out first.'
      })
    }

    // 6. Determine LATE or PRESENT (9am cutoff)
    const now = new Date()
    const shiftStart = new Date(now)
    shiftStart.setHours(9, 0, 0, 0)
    const status = now > shiftStart ? 'LATE' : 'PRESENT'

    // 7. Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        clockIn: now,
        status,
        date: now,
        branchId: nearestBranch.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      }
    })

    res.status(201).json({
      message: `Clocked in at ${nearestBranch.name}`,
      branch: nearestBranch.name,
      distanceMeters: Math.round(nearestDistance),
      status,
      attendance
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── START BREAK ───────────────────────────────────────────────────
const startBreak = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: { employeeId, clockOut: null }
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

// ── END BREAK ─────────────────────────────────────────────────────
const endBreak = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: { employeeId, clockOut: null }
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

// ── CLOCK OUT ─────────────────────────────────────────────────────
const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: { employeeId, clockOut: null }
    })

    if (!activeSession) {
      return res.status(404).json({ error: 'No active session found' })
    }

    const now = new Date()
    const clockInTime = new Date(activeSession.clockIn)

    let breakMinutes = 0
    if (activeSession.breakStart && activeSession.breakEnd) {
      const breakStart = new Date(activeSession.breakStart)
      const breakEnd = new Date(activeSession.breakEnd)
      breakMinutes = (breakEnd - breakStart) / (1000 * 60)
    }

    const totalMs = now - clockInTime
    const totalHours = parseFloat(
      ((totalMs / (1000 * 60 * 60)) - (breakMinutes / 60)).toFixed(2)
    )

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

// ── GET TODAY ─────────────────────────────────────────────────────
const getToday = async (req, res) => {
  try {
    const employeeId = req.user.id

    const activeSession = await prisma.attendance.findFirst({
      where: { employeeId, clockOut: null },
      orderBy: { clockIn: 'desc' },
      include: {
        branch: { select: { name: true } }
      }
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

// ── MY HISTORY ────────────────────────────────────────────────────
const getMyHistory = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { month, year } = req.query

    const now = new Date()
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth()
    const targetYear = year ? parseInt(year) : now.getFullYear()

    const start = new Date(targetYear, targetMonth, 1)
    const end = new Date(targetYear, targetMonth + 1, 1)

    const records = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lt: end } },
      include: { branch: { select: { name: true } } },
      orderBy: { date: 'desc' }
    })

    const uniqueDays = new Set()
    const completedSessions = []

    records.forEach(record => {
      uniqueDays.add(new Date(record.date).toDateString())
      if (record.clockOut !== null) completedSessions.push(record)
    })

    const totalDays = uniqueDays.size
    const presentDays = completedSessions.filter(r => r.status === 'PRESENT').length
    const lateDays = completedSessions.filter(r => r.status === 'LATE').length
    const totalHours = completedSessions.reduce((sum, r) => sum + (r.totalHours || 0), 0)

    res.json({
      month: targetMonth + 1,
      year: targetYear,
      summary: {
        totalDays,
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

// ── REPORT ────────────────────────────────────────────────────────
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
        },
        branch: { select: { name: true } }
      },
      orderBy: { clockIn: 'asc' }
    })

    res.json({ date: filterDate, total: records.length, records })
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