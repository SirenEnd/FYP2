const prisma = require('../utils/prisma')
const { addDays, differenceInDays, eachDayOfInterval, isWeekend, isSameMonth, 
        startOfMonth, endOfMonth, getYear, getMonth, setMonth, setYear } = require('date-fns')

const HOURLY_RATE = 13.00
const BILLABLE_HOURS_PER_DAY = 6
const OT_MULTIPLIER = 1.5
const SUPERVISOR_FIXED = 2500.00
const ADVANCE_MAX_PERCENT = 0.50
const EPF_RATE = 0.11
const SOCSO_RATE = 0.005
const SOCSO_CAP = 4000
const WORKING_DAYS_PER_CYCLE = 24  // Default for calculation

const fmt2 = (n) => parseFloat(n.toFixed(2))

/**
 * Calculate actual working days in a cycle
 */
const calculateActualWorkingDays = async (employeeId, attendances, cycleStart, cycleEnd) => {
  const attendedDates = new Set(
    attendances.filter(a => a.clockOut !== null).map(a => new Date(a.date).toDateString())
  )
  
  // Get unpaid leaves for this period
  const unpaidLeaves = await prisma.leaveRequest.findMany({
    where: { 
      employeeId: employeeId,
      status: 'APPROVED', 
      leaveType: 'UNPAID',
      startDate: { lte: cycleEnd },
      endDate: { gte: cycleStart }
    }
  })
  
  // Calculate unpaid leave days within the cycle
  let unpaidDays = 0
  for (const leave of unpaidLeaves) {
    const leaveStart = new Date(Math.max(leave.startDate, cycleStart))
    const leaveEnd = new Date(Math.min(leave.endDate, cycleEnd))
    const days = Math.ceil((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1
    unpaidDays += days
  }
  
  return attendedDates.size - unpaidDays
}

const calculatePayroll = async (attendances, employeeId, role, advanceAmount = 0, cycleStart, cycleEnd) => {
  const completedSessions = attendances.filter(a => a.clockOut !== null)
  const actualWorkingDays = await calculateActualWorkingDays(employeeId, attendances, cycleStart, cycleEnd)
  
  const totalClocked = completedSessions.reduce((sum, a) => sum + (a.totalHours || 0), 0)
  const expectedHours = actualWorkingDays * BILLABLE_HOURS_PER_DAY
  const overtimeHours = fmt2(Math.max(0, totalClocked - expectedHours))

  let basePay, overtimePay, grossSalary

  if (role === 'SUPERVISOR') {
    basePay = SUPERVISOR_FIXED
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  } else {
    // Calculate based on actual working days
    basePay = fmt2(actualWorkingDays * BILLABLE_HOURS_PER_DAY * HOURLY_RATE)
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  }

  const socsoBase = Math.min(grossSalary, SOCSO_CAP)
  const epfDeduction = fmt2(grossSalary * EPF_RATE)
  const socsoDeduction = fmt2(socsoBase * SOCSO_RATE)
  const netSalary = fmt2(grossSalary - epfDeduction - socsoDeduction - advanceAmount)

  return {
    basePay, 
    overtimeHours, 
    overtimePay, 
    grossSalary,
    epfDeduction, 
    socsoDeduction, 
    netSalary,
    advanceDeduction: advanceAmount, 
    attendedDays: actualWorkingDays,
    totalHoursWorked: fmt2(totalClocked)
  }
}

/**
 * Helper: Convert month/year to 28-day cycle dates
 */
const getCycleDatesFromMonth = (month, year) => {
  // For March 2024, start from March 1
  // For subsequent months, calculate based on 28-day cycles
  const baseDate = new Date(year, month - 1, 1)
  
  // Check if this is March 2024 (the starting point)
  if (month === 3 && year === 2024) {
    return {
      cycleStart: new Date(2024, 2, 1), // March 1, 2024
      cycleEnd: new Date(2024, 2, 28)   // March 28, 2024
    }
  }
  
  // Calculate cycles from March 2024
  const march2024 = new Date(2024, 2, 1)
  const targetDate = new Date(year, month - 1, 1)
  const daysDiff = Math.floor((targetDate - march2024) / (1000 * 60 * 60 * 24))
  const cyclesPassed = Math.floor(daysDiff / 28)
  
  const cycleStart = addDays(march2024, cyclesPassed * 28)
  const cycleEnd = addDays(cycleStart, 27)
  
  return { cycleStart, cycleEnd }
}

/**
 * Helper: Convert cycle dates to month/year for frontend
 */
const getMonthYearFromCycle = (cycleStart) => {
  // For display purposes, show the month that contains most of the cycle
  const midDate = addDays(cycleStart, 14)
  return {
    month: midDate.getMonth() + 1,
    year: midDate.getFullYear()
  }
}

// POST /api/payroll/generate
const generatePayroll = async (req, res) => {
  try {
    let { cycleStart, cycleEnd, month, year } = req.body
    
    // Handle month/year input from frontend
    if (month && year) {
      const dates = getCycleDatesFromMonth(month, year)
      cycleStart = dates.cycleStart
      cycleEnd = dates.cycleEnd
    }
    
    // If still no dates, auto-generate based on last payroll
    if (!cycleStart || !cycleEnd) {
      const lastPayroll = await prisma.payroll.findFirst({
        orderBy: { cycleEnd: 'desc' }
      })
      
      if (lastPayroll) {
        cycleStart = addDays(lastPayroll.cycleEnd, 1)
        cycleEnd = addDays(cycleStart, 27)
      } else {
        cycleStart = new Date('2024-03-01')
        cycleEnd = addDays(cycleStart, 27)
      }
    }

    const start = new Date(cycleStart)
    const end = new Date(cycleEnd)
    end.setHours(23, 59, 59, 999)

    // Validate cycle duration
    const cycleDays = differenceInDays(end, start) + 1
    if (cycleDays !== 28) {
      return res.status(400).json({ 
        error: `Cycle must be 28 days, got ${cycleDays} days`,
        suggestedEnd: addDays(start, 27)
      })
    }

    // Get all active employees (excluding ADMIN)
    const employees = await prisma.employee.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } }
    })

    const results = [], errors = []

    for (const emp of employees) {
      // Check for existing payroll
      const existing = await prisma.payroll.findFirst({
        where: { 
          employeeId: emp.id, 
          cycleStart: start,
          cycleEnd: end
        }
      })
      
      if (existing) {
        errors.push({ employee: emp.name, error: 'Payroll already generated for this cycle' })
        continue
      }

      // Get attendances
      const attendances = await prisma.attendance.findMany({
        where: { 
          employeeId: emp.id, 
          date: { gte: start, lte: end }, 
          clockOut: { not: null } 
        }
      })

      // Get approved advances for this cycle
      const advances = await prisma.salaryAdvance.findMany({
        where: { 
          employeeId: emp.id, 
          status: 'APPROVED',
          requestedAt: { gte: start, lte: end },
          deductedPayrollId: null
        }
      })
      const advanceTotal = advances.reduce((s, a) => s + a.amount, 0)

      const calc = await calculatePayroll(attendances, emp.id, emp.role, advanceTotal, start, end)

      const payroll = await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          cycleStart: start,
          cycleEnd: end,
          basicSalary: calc.basePay,
          overtimeHours: calc.overtimeHours,
          overtimePay: calc.overtimePay,
          epfDeduction: calc.epfDeduction,
          socsoDeduction: calc.socsoDeduction,
          grossSalary: calc.grossSalary,
          netSalary: calc.netSalary,
          advanceDeduction: calc.advanceDeduction,
          status: 'PENDING'
        }
      })

      // Link advances
      if (advances.length > 0) {
        await prisma.salaryAdvance.updateMany({
          where: { id: { in: advances.map(a => a.id) } },
          data: { deductedPayrollId: payroll.id }
        })
      }

      const monthYear = getMonthYearFromCycle(start)
      results.push({
        id: payroll.id, 
        employee: emp.name, 
        employeeId: emp.employeeId,
        role: emp.role, 
        attendedDays: calc.attendedDays,
        totalHours: calc.totalHoursWorked, 
        basePay: calc.basePay,
        overtimePay: calc.overtimePay, 
        advanceDeduction: calc.advanceDeduction,
        netSalary: calc.netSalary, 
        month: monthYear.month,
        year: monthYear.year,
        status: 'PROCESSED'
      })
    }

    res.status(201).json({
      message: `Payroll generated for cycle ${start.toDateString()} → ${end.toDateString()}`,
      cycleStart: start,
      cycleEnd: end,
      processed: results.length, 
      skipped: errors.length,
      results, 
      errors
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error: ' + err.message })
  }
}

// GET /api/payroll
const getAllPayroll = async (req, res) => {
  try {
    const { month, year, cycleStart } = req.query
    
    let whereClause = {}
    
    // Handle month/year filter from frontend
    if (month && year) {
      const dates = getCycleDatesFromMonth(parseInt(month), parseInt(year))
      whereClause = {
        cycleStart: dates.cycleStart,
        cycleEnd: dates.cycleEnd
      }
    } else if (cycleStart) {
      whereClause = { cycleStart: new Date(cycleStart) }
    }
    
    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: { 
          select: { 
            employeeId: true, 
            name: true, 
            position: true, 
            role: true, 
            department: { select: { name: true } } 
          } 
        }
      },
      orderBy: [{ cycleStart: 'desc' }, { employee: { name: 'asc' } }]
    })
    
    // Add month/year for frontend compatibility
    const payrollsWithMonth = payrolls.map(p => ({
      ...p,
      month: p.cycleStart.getMonth() + 1,
      year: p.cycleStart.getFullYear()
    }))
    
    const totalNet = payrollsWithMonth.reduce((s, p) => s + p.netSalary, 0)
    res.json({ 
      total: payrollsWithMonth.length, 
      totalNetSalary: parseFloat(totalNet.toFixed(2)), 
      payrolls: payrollsWithMonth 
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/my
const getMyPayroll = async (req, res) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: { employeeId: req.user.id },
      orderBy: { cycleStart: 'desc' }
    })
    
    // Add month/year for frontend compatibility
    const payrollsWithMonth = payrolls.map(p => ({
      ...p,
      month: p.cycleStart.getMonth() + 1,
      year: p.cycleStart.getFullYear()
    }))
    
    res.json({ total: payrollsWithMonth.length, payrolls: payrollsWithMonth })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/:id
const getPayrollById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { 
        employee: { 
          select: { 
            employeeId: true, 
            name: true, 
            position: true, 
            role: true, 
            department: { select: { name: true } } 
          } 
        } 
      }
    })
    if (!payroll) return res.status(404).json({ error: 'Payroll record not found' })
    if (req.user.role === 'STAFF' && payroll.employeeId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' })
    
    // Add month/year for frontend
    const payrollWithMonth = {
      ...payroll,
      month: payroll.cycleStart.getMonth() + 1,
      year: payroll.cycleStart.getFullYear()
    }
    
    res.json(payrollWithMonth)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/:id/pay
const markAsPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') return res.status(409).json({ error: 'Already paid' })
    const updated = await prisma.payroll.update({ 
      where: { id }, 
      data: { status: 'PAID', paidAt: new Date() } 
    })
    
    const updatedWithMonth = {
      ...updated,
      month: updated.cycleStart.getMonth() + 1,
      year: updated.cycleStart.getFullYear()
    }
    
    res.json({ message: 'Payroll marked as paid', payroll: updatedWithMonth })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/payroll/:id
const deletePayroll = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') return res.status(409).json({ error: 'Cannot delete a paid record' })
    await prisma.payroll.delete({ where: { id } })
    res.json({ message: 'Payroll deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/payroll/advance
const requestAdvance = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { amount, reason } = req.body
    if (!amount) return res.status(400).json({ error: 'amount is required' })

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
    const maxAdvance = emp.role === 'SUPERVISOR'
      ? SUPERVISOR_FIXED * ADVANCE_MAX_PERCENT
      : WORKING_DAYS_PER_CYCLE * BILLABLE_HOURS_PER_DAY * HOURLY_RATE * ADVANCE_MAX_PERCENT

    if (parseFloat(amount) > maxAdvance)
      return res.status(400).json({ 
        error: `Advance cannot exceed RM${maxAdvance.toFixed(2)} (50% of base pay)`, 
        maxAdvance 
      })

    const advance = await prisma.salaryAdvance.create({
      data: { employeeId, amount: parseFloat(amount), reason, status: 'PENDING' }
    })
    res.status(201).json({ message: 'Advance request submitted', advance, maxAdvance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/advance/:id/approve
const approveAdvance = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const advance = await prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: req.user.id, reviewedAt: new Date() }
    })
    res.json({ message: 'Advance approved', advance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/advance/:id/reject
const rejectAdvance = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const advance = await prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: req.user.id, reviewedAt: new Date() }
    })
    res.json({ message: 'Advance rejected', advance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/advances
const getAllAdvances = async (req, res) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      include: { employee: { select: { employeeId: true, name: true, role: true, position: true } } },
      orderBy: { requestedAt: 'desc' }
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/advances/my
const getMyAdvances = async (req, res) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      where: { employeeId: req.user.id },
      orderBy: { requestedAt: 'desc' }
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/payroll/auto-generate
const autoGeneratePayroll = async (req, res) => {
  try {
    const lastPayroll = await prisma.payroll.findFirst({
      orderBy: { cycleEnd: 'desc' }
    })
    
    let nextStart, nextEnd
    
    if (!lastPayroll) {
      nextStart = new Date('2024-03-01')
      nextEnd = addDays(nextStart, 27)
    } else {
      nextStart = addDays(lastPayroll.cycleEnd, 1)
      nextEnd = addDays(nextStart, 27)
    }
    
    const today = new Date()
    if (nextEnd <= today) {
      req.body = { cycleStart: nextStart, cycleEnd: nextEnd }
      return generatePayroll(req, res)
    } else {
      res.json({ 
        message: 'No cycles ready for generation',
        nextCycleStart: nextStart,
        nextCycleEnd: nextEnd,
        daysUntilGeneration: Math.ceil((nextEnd - today) / (1000 * 60 * 60 * 24))
      })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/cycles
const getPayrollCycles = async (req, res) => {
  try {
    const cycles = await prisma.payroll.findMany({
      select: {
        cycleStart: true,
        cycleEnd: true
      },
      distinct: ['cycleStart', 'cycleEnd'],
      orderBy: { cycleStart: 'desc' }
    })
    res.json({ cycles })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  generatePayroll, 
  getAllPayroll, 
  getMyPayroll, 
  getPayrollById,
  markAsPaid, 
  deletePayroll, 
  requestAdvance, 
  approveAdvance, 
  rejectAdvance,
  getAllAdvances, 
  getMyAdvances,
  getPayrollCycles,
  autoGeneratePayroll
}