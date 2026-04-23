const prisma = require('../utils/prisma')

// POST /api/schedule — Supervisor/Admin creates shift
const createSchedule = async (req, res) => {
  try {
    const { employeeId, shiftDate, shiftStart, shiftEnd, station } = req.body

    if (!employeeId || !shiftDate || !shiftStart || !shiftEnd) {
      return res.status(400).json({ error: 'employeeId, shiftDate, shiftStart and shiftEnd are required' })
    }

    // Check for duplicate shift on same day
    const existing = await prisma.schedule.findFirst({
      where: {
        employeeId: parseInt(employeeId),
        shiftDate: new Date(shiftDate)
      }
    })

    if (existing) {
      return res.status(409).json({ error: 'Employee already has a shift on this date' })
    }

    const schedule = await prisma.schedule.create({
      data: {
        employeeId: parseInt(employeeId),
        shiftDate: new Date(shiftDate),
        shiftStart,
        shiftEnd,
        station
      },
      include: {
        employee: {
          select: { name: true, position: true, department: { select: { name: true } } }
        }
      }
    })

    res.status(201).json({ message: 'Shift created successfully', schedule })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/schedule — get schedules by date or week
const getSchedules = async (req, res) => {
  try {
    const { date, employeeId, departmentId } = req.query

    const filterDate = date ? new Date(date) : new Date()
    filterDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(filterDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const schedules = await prisma.schedule.findMany({
      where: {
        shiftDate: { gte: filterDate, lt: nextDay },
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
      orderBy: { shiftStart: 'asc' }
    })

    res.json({ date: filterDate, total: schedules.length, schedules })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/schedule/my — Staff views own schedule
const getMySchedule = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { month, year } = req.query

    const now = new Date()
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth()
    const targetYear = year ? parseInt(year) : now.getFullYear()

    const start = new Date(targetYear, targetMonth, 1)
    const end = new Date(targetYear, targetMonth + 1, 1)

    const schedules = await prisma.schedule.findMany({
      where: {
        employeeId,
        shiftDate: { gte: start, lt: end }
      },
      orderBy: { shiftDate: 'asc' }
    })

    res.json({
      month: targetMonth + 1,
      year: targetYear,
      total: schedules.length,
      schedules
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/schedule/:id — Supervisor/Admin updates shift
const updateSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { shiftDate, shiftStart, shiftEnd, station, status } = req.body

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        ...(shiftDate && { shiftDate: new Date(shiftDate) }),
        ...(shiftStart && { shiftStart }),
        ...(shiftEnd && { shiftEnd }),
        ...(station && { station }),
        ...(status && { status })
      },
      include: {
        employee: {
          select: { name: true, position: true }
        }
      }
    })

    res.json({ message: 'Schedule updated', schedule })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/schedule/:id — Supervisor/Admin cancels shift
const deleteSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    await prisma.schedule.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })

    res.json({ message: 'Shift cancelled successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/schedule/week — get full week schedule
const getWeekSchedule = async (req, res) => {
  try {
    const { startDate } = req.query

    const start = startDate ? new Date(startDate) : new Date()
    start.setHours(0, 0, 0, 0)

    // Set to Monday of current week
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)

    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    const schedules = await prisma.schedule.findMany({
      where: {
        shiftDate: { gte: start, lt: end },
        status: { not: 'CANCELLED' }
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
      orderBy: [{ shiftDate: 'asc' }, { shiftStart: 'asc' }]
    })

    res.json({
      weekStart: start,
      weekEnd: end,
      total: schedules.length,
      schedules
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { createSchedule, getSchedules, getMySchedule, updateSchedule, deleteSchedule, getWeekSchedule }