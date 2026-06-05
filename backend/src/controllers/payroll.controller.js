const prisma = require('../utils/prisma')

// ── CONSTANTS ─────────────────────────────────────────────────────
const HOURLY_RATE = 10.00          // RM 10.00/hr
const SHIFT_HOURS = 8              // 8 hrs per shift (incl. 1hr break)
const BREAK_HOURS = 1              // 1hr break deducted
const EFFECTIVE_HOURS = SHIFT_HOURS - BREAK_HOURS  // 7 billable hrs per shift
const OT_MULTIPLIER = 1.5
const SERVICE_CHARGE_PER_MONTH = 220 // flat RM220 service charge

// Malaysian statutory deductions
const EPF_RATE = 0.11              // employee 11%
const SOCSO_RATE = 0.005           // employee 0.5%
const SOCSO_CAP = 4000             // SOCSO capped at RM4,000 salary

// ── HELPERS ───────────────────────────────────────────────────────
const fmt2 = (n) => parseFloat(n.toFixed(2))

const calculatePayroll = (attendances, basicSalary) => {
  // Sum all clocked hours this month
  const totalClocked = attendances.reduce((sum, a) => sum + (a.totalHours || 0), 0)

  // Expected hours = number of days attended × 7 billable hrs
  const attendedDays = attendances.filter(a => a.clockOut !== null).length
  const expectedHours = attendedDays * EFFECTIVE_HOURS

  // Overtime = any hours beyond 7/day
  const normalHours  = Math.min(totalClocked, expectedHours)
  const overtimeHours = fmt2(Math.max(0, totalClocked - expectedHours))

  // Pay calculation
  const normalPay   = fmt2(normalHours * HOURLY_RATE)
  const overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
  const grossSalary = fmt2(normalPay + overtimePay + SERVICE_CHARGE_PER_MONTH)

  // Statutory deductions (based on basicSalary / contract pay, not gross)
  const socsoBase      = Math.min(basicSalary, SOCSO_CAP)
  const epfDeduction   = fmt2(basicSalary * EPF_RATE)
  const socsoDeduction = fmt2(socsoBase * SOCSO_RATE)

  const netSalary = fmt2(grossSalary - epfDeduction - socsoDeduction)

  return {
    totalHoursWorked: fmt2(totalClocked),
    normalHours: fmt2(normalHours),
    overtimeHours,
    normalPay,
    overtimePay,
    serviceCharge: SERVICE_CHARGE_PER_MONTH,
    grossSalary,
    epfDeduction,
    socsoDeduction,
    netSalary,
    attendedDays,
  }
}

// ── POST /api/payroll/generate ─────────────────────────────────────
const generatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' })
    }

    const targetMonth = parseInt(month)
    const targetYear  = parseInt(year)

    const employees = await prisma.employee.findMany({ where: { isActive: true } })

    const results = []
    const errors  = []

    for (const emp of employees) {
      const existing = await prisma.payroll.findFirst({
        where: { employeeId: emp.id, month: targetMonth, year: targetYear }
      })

      if (existing) {
        errors.push({ employee: emp.name, error: 'Payroll already generated for this period' })
        continue
      }

      const start = new Date(targetYear, targetMonth - 1, 1)
      const end   = new Date(targetYear, targetMonth, 1)

      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          date: { gte: start, lt: end },
          clockOut: { not: null }        // only completed sessions
        }
      })

      const calc = calculatePayroll(attendances, emp.salary)

      const payroll = await prisma.payroll.create({
        data: {
          employeeId:     emp.id,
          month:          targetMonth,
          year:           targetYear,
          basicSalary:    emp.salary,
          overtimeHours:  calc.overtimeHours,
          overtimePay:    calc.overtimePay,
          serviceCharge:  calc.serviceCharge,
          epfDeduction:   calc.epfDeduction,
          socsoDeduction: calc.socsoDeduction,
          grossSalary:    calc.grossSalary,
          netSalary:      calc.netSalary,
          status:         'PROCESSED'
        }
      })

      results.push({
        id: payroll.id,
        employee: emp.name,
        employeeId: emp.employeeId,
        attendedDays:  calc.attendedDays,
        totalHours:    calc.totalHoursWorked,
        normalPay:     calc.normalPay,
        overtimePay:   calc.overtimePay,
        netSalary:     calc.netSalary,
        status: 'PROCESSED'
      })
    }

    res.status(201).json({
      message: `Payroll generated for ${targetMonth}/${targetYear}`,
      processed: results.length,
      skipped:   errors.length,
      results,
      errors
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET /api/payroll ───────────────────────────────────────────────
const getAllPayroll = async (req, res) => {
  try {
    const { month, year } = req.query

    const payrolls = await prisma.payroll.findMany({
      where: {
        ...(month && { month: parseInt(month) }),
        ...(year  && { year:  parseInt(year)  })
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            name: true,
            position: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { name: 'asc' } }]
    })

    const totalNet = payrolls.reduce((sum, p) => sum + p.netSalary, 0)

    res.json({
      total: payrolls.length,
      totalNetSalary: fmt2(totalNet),
      payrolls
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET /api/payroll/my ────────────────────────────────────────────
const getMyPayroll = async (req, res) => {
  try {
    const employeeId = req.user.id

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })

    res.json({ total: payrolls.length, payrolls })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET /api/payroll/:id ───────────────────────────────────────────
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
            department: { select: { name: true } }
          }
        }
      }
    })

    if (!payroll) return res.status(404).json({ error: 'Payroll record not found' })

    if (req.user.role === 'STAFF' && payroll.employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(payroll)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── PUT /api/payroll/:id/pay ───────────────────────────────────────
const markAsPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') {
      return res.status(409).json({ error: 'Payroll already marked as paid' })
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() }
    })

    res.json({ message: 'Payroll marked as paid', payroll: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── DELETE /api/payroll/:id ────────────────────────────────────────
const deletePayroll = async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') {
      return res.status(409).json({ error: 'Cannot delete a paid payroll record' })
    }

    await prisma.payroll.delete({ where: { id } })
    res.json({ message: 'Payroll record deleted' })
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
  deletePayroll
}