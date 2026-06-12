const prisma = require('../utils/prisma')
const { addDays, differenceInDays, eachDayOfInterval, isWeekend, isSameMonth } = require('date-fns')

const HOURLY_RATE = 13.00
const BILLABLE_HOURS_PER_DAY = 6
const OT_MULTIPLIER = 1.5
const SUPERVISOR_FIXED = 2500.00
const ADVANCE_MAX_PERCENT = 0.50
const EPF_RATE = 0.11
const SOCSO_RATE = 0.005
const SOCSO_CAP = 4000

const fmt2 = (n) => parseFloat(n.toFixed(2))

/**
 * Calculate actual working days in a cycle (excluding leaves/unpaid time)
 */
const calculateActualWorkingDays = (attendances, cycleStart, cycleEnd) => {
  const attendedDates = new Set(
    attendances.filter(a => a.clockOut !== null).map(a => new Date(a.date).toDateString())
  )
  
  // If using leave management, subtract unpaid leaves
  const unpaidLeaves = await prisma.leave.findMany({
    where: { employeeId, status: 'APPROVED', type: 'UNPAID', 
      date: { gte: cycleStart, lte: cycleEnd } }
  })
  
  return attendedDates.size
}

const calculatePayroll = (attendances, role, basicSalary, advanceAmount = 0, cycleStart, cycleEnd) => {
  const completedSessions = attendances.filter(a => a.clockOut !== null)
  const actualWorkingDays = calculateActualWorkingDays(attendances, cycleStart, cycleEnd)
  
  const totalClocked = completedSessions.reduce((sum, a) => sum + (a.totalHours || 0), 0)
  const expectedHours = actualWorkingDays * BILLABLE_HOURS_PER_DAY
  const overtimeHours = fmt2(Math.max(0, totalClocked - expectedHours))

  let basePay, overtimePay, grossSalary

  if (role === 'SUPERVISOR') {
    basePay = SUPERVISOR_FIXED
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  } else {
    // DYNAMIC calculation based on ACTUAL working days
    basePay = fmt2(actualWorkingDays * BILLABLE_HOURS_PER_DAY * HOURLY_RATE)
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  }

  const socsoBase = Math.min(grossSalary, SOCSO_CAP)
  const epfDeduction = fmt2(grossSalary * EPF_RATE)
  const socsoDeduction = fmt2(socsoBase * SOCSO_RATE)
  const netSalary = fmt2(grossSalary - epfDeduction - socsoDeduction - advanceAmount)

  return {
    basePay, overtimeHours, overtimePay, grossSalary,
    epfDeduction, socsoDeduction, netSalary,
    advanceDeduction: advanceAmount, attendedDays: actualWorkingDays,
    totalHoursWorked: fmt2(totalClocked)
  }
}

// POST /api/payroll/generate
const generatePayroll = async (req, res) => {
  try {
    let { cycleStart, cycleEnd } = req.body
    
    // AUTO-GENERATE if not provided (for scheduled runs)
    if (!cycleStart || !cycleEnd) {
      const lastPayroll = await prisma.payroll.findFirst({
        orderBy: { cycleEnd: 'desc' }
      })
      
      if (lastPayroll) {
        // Start from day after last cycle ended
        cycleStart = addDays(lastPayroll.cycleEnd, 1)
        cycleEnd = addDays(cycleStart, 27) // 28-day cycle
      } else {
        // Initial cycle starting from March 1, 2024
        cycleStart = new Date('2024-03-01')
        cycleEnd = addDays(cycleStart, 27)
      }
    }

    const start = new Date(cycleStart)
    const end = new Date(cycleEnd)
    end.setHours(23, 59, 59, 999)

    // Validate cycle duration (should be 28 days)
    const cycleDays = differenceInDays(end, start) + 1
    if (cycleDays !== 28) {
      return res.status(400).json({ 
        error: `Cycle must be 28 days, got ${cycleDays} days`,
        suggestedEnd: addDays(start, 27)
      })
    }

    // Exclude ADMINs
    const employees = await prisma.employee.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
      include: { attendances: {
        where: { date: { gte: start, lte: end } }
      }}
    })

    const results = [], errors = []

    for (const emp of employees) {
      // Check if payroll already exists for this cycle
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

      const attendances = await prisma.attendance.findMany({
        where: { 
          employeeId: emp.id, 
          date: { gte: start, lte: end }, 
          clockOut: { not: null } 
        }
      })

      // Sum approved advances for this cycle
      const advances = await prisma.salaryAdvance.findMany({
        where: { 
          employeeId: emp.id, 
          status: 'APPROVED',
          requestedAt: { gte: start, lte: end },
          deductedPayrollId: null // Only include not-yet-deducted advances
        }
      })
      const advanceTotal = advances.reduce((s, a) => s + a.amount, 0)

      const calc = calculatePayroll(attendances, emp.role, emp.salary, advanceTotal, start, end)

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

      // Link advance records to this payroll
      if (advances.length > 0) {
        await prisma.salaryAdvance.updateMany({
          where: { id: { in: advances.map(a => a.id) } },
          data: { deductedPayrollId: payroll.id }
        })
      }

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
        cycleStart: start,
        cycleEnd: end,
        status: 'PROCESSED'
      })
    }

    res.status(201).json({
      message: `Payroll generated for cycle ${cycleStart} → ${cycleEnd}`,
      cycleStart, cycleEnd,
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

// GET /api/payroll/cycles - Get all available cycles
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

// POST /api/payroll/auto-generate - For cron jobs
const autoGeneratePayroll = async (req, res) => {
  try {
    // Get the last payroll cycle
    const lastPayroll = await prisma.payroll.findFirst({
      orderBy: { cycleEnd: 'desc' }
    })
    
    let nextStart, nextEnd
    
    if (!lastPayroll) {
      // First cycle: March 1, 2024
      nextStart = new Date('2024-03-01')
      nextEnd = addDays(nextStart, 27)
    } else {
      nextStart = addDays(lastPayroll.cycleEnd, 1)
      nextEnd = addDays(nextStart, 27)
    }
    
    // Check if we should generate (e.g., if nextEnd is in the past or today)
    const today = new Date()
    if (nextEnd <= today) {
      // Generate payroll for this cycle
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