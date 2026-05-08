const prisma = require('../utils/prisma')

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7) // 7am to 11pm

// POST /api/timetable — Create new timetable for a branch
const createTimetable = async (req, res) => {
  try {
    const { branchId, name, effectiveFrom } = req.body
    const createdBy = req.user.id

    if (!branchId || !name || !effectiveFrom) {
      return res.status(400).json({ error: 'branchId, name and effectiveFrom are required' })
    }

    // Deactivate current active timetable for this branch
    await prisma.timetable.updateMany({
      where: { branchId: parseInt(branchId), isActive: true },
      data: { isActive: false, effectiveTo: new Date() }
    })

    const timetable = await prisma.timetable.create({
      data: {
        branchId: parseInt(branchId),
        name,
        effectiveFrom: new Date(effectiveFrom),
        createdBy,
        isActive: true
      },
      include: {
        branch: { select: { name: true } }
      }
    })

    res.status(201).json({ message: 'Timetable created successfully', timetable })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/timetable/branch/:branchId — Get active timetable grid for a branch
const getActiveTimetable = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId)

    const timetable = await prisma.timetable.findFirst({
      where: { branchId, isActive: true },
      include: {
        branch: { select: { name: true } },
        slots: {
          include: {
            employee: {
              select: {
                id: true, employeeId: true, name: true,
                position: true,
                department: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    if (!timetable) {
      return res.status(404).json({ error: 'No active timetable found for this branch' })
    }

    // Build grid structure
    const grid = DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      hours: HOURS.map(hour => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        slots: timetable.slots.filter(
          s => s.dayOfWeek === dayIndex && s.startHour === hour
        ).map(s => ({
          slotId: s.id,
          employee: s.employee,
          station: s.station,
          endHour: s.endHour
        }))
      }))
    }))

    res.json({
      timetable: {
        id: timetable.id,
        name: timetable.name,
        branch: timetable.branch,
        effectiveFrom: timetable.effectiveFrom,
        effectiveTo: timetable.effectiveTo,
        isActive: timetable.isActive
      },
      grid
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/timetable/:id/slot — Assign employee to a grid cell
const assignSlot = async (req, res) => {
  try {
    const timetableId = parseInt(req.params.id)
    const { employeeId, dayOfWeek, startHour, endHour, station } = req.body

    if (dayOfWeek === undefined || startHour === undefined || !employeeId) {
      return res.status(400).json({ error: 'employeeId, dayOfWeek and startHour are required' })
    }

    if (startHour < 7 || startHour > 23) {
      return res.status(400).json({ error: 'startHour must be between 7 and 23' })
    }

    // Check if slot already exists for this employee at this time
    const existing = await prisma.timetableSlot.findFirst({
      where: {
        timetableId,
        dayOfWeek: parseInt(dayOfWeek),
        startHour: parseInt(startHour),
        employeeId: parseInt(employeeId)
      }
    })

    if (existing) {
      return res.status(409).json({ error: 'Employee already assigned to this slot' })
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        timetableId,
        employeeId: parseInt(employeeId),
        dayOfWeek: parseInt(dayOfWeek),
        startHour: parseInt(startHour),
        endHour: endHour ? parseInt(endHour) : parseInt(startHour) + 1,
        station
      },
      include: {
        employee: { select: { id: true, name: true, position: true } }
      }
    })

    res.status(201).json({ message: 'Slot assigned successfully', slot })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/timetable/slot/:slotId — Remove employee from a slot
const removeSlot = async (req, res) => {
  try {
    const slotId = parseInt(req.params.slotId)
    await prisma.timetableSlot.delete({ where: { id: slotId } })
    res.json({ message: 'Slot removed successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/timetable/my — Employee views own weekly schedule
const getMySchedule = async (req, res) => {
  try {
    const employeeId = req.user.id

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { branchId: true }
    })

    if (!employee?.branchId) {
      return res.status(404).json({ error: 'You are not assigned to any branch yet' })
    }

    const timetable = await prisma.timetable.findFirst({
      where: { branchId: employee.branchId, isActive: true }
    })

    if (!timetable) {
      return res.status(404).json({ error: 'No active timetable for your branch' })
    }

    const slots = await prisma.timetableSlot.findMany({
      where: { timetableId: timetable.id, employeeId },
      orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }]
    })

    const schedule = DAYS.map((day, index) => ({
      day,
      shifts: slots
        .filter(s => s.dayOfWeek === index)
        .map(s => ({
          slotId: s.id,
          start: `${String(s.startHour).padStart(2, '0')}:00`,
          end: `${String(s.endHour).padStart(2, '0')}:00`,
          station: s.station
        }))
    }))

    res.json({
      timetableName: timetable.name,
      effectiveFrom: timetable.effectiveFrom,
      schedule
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/timetable — List all timetables (Admin)
const getAllTimetables = async (req, res) => {
  try {
    const { branchId } = req.query

    const timetables = await prisma.timetable.findMany({
      where: { ...(branchId && { branchId: parseInt(branchId) }) },
      include: {
        branch: { select: { name: true } },
        _count: { select: { slots: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ total: timetables.length, timetables })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  createTimetable, getActiveTimetable, assignSlot,
  removeSlot, getMySchedule, getAllTimetables
}