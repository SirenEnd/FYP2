const prisma = require('../utils/prisma')

// Malaysian payroll calculation helper
const calculatePayroll = (basicSalary, overtimeHours, serviceCharge) => {
  const hourlyRate = basicSalary / (26 * 8)
  const overtimePay = parseFloat((overtimeHours * hourlyRate * 1.5).toFixed(2))

  const grossSalary = parseFloat((basicSalary + overtimePay + serviceCharge).toFixed(2))

  // EPF — employee 11%, employer 13%
  const epfDeduction = parseFloat((basicSalary * 0.11).toFixed(2))

  // SOCSO — 0.5% employee contribution (capped at RM4,000)
  const socsoBase = Math.min(basicSalary, 4000)
  const socsoDeduction = parseFloat((socsoBase * 0.005).toFixed(2))

  const netSalary = parseFloat((grossSalary - epfDeduction - socsoDeduction).toFixed(2))

  return { overtimePay, grossSalary, epfDeduction, socsoDeduction, netSalary }
}

// POST /api/payroll/generate — Admin generates payroll for a month
const generatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' })
    }

    const targetMonth = parseInt(month)
    const targetYear = parseInt(year)

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true }
    })

    const results = []
    const errors = []

    for (const emp of employees) {
      // Check if payroll already exists
      const existing = await prisma.payroll.findFirst({
        where: { employeeId: emp.id, month: targetMonth, year: targetYear }
      })

      if (existing) {
        errors.push({ employee: emp.name, error: 'Payroll already generated' })
        continue
      }

      // Get overtime hours from attendance
      const start = new Date(targetYear, targetMonth - 1, 1)
      const end = new Date(targetYear, targetMonth, 1)

      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          date: { gte: start, lt: end },
          totalHours: { not: null }
        }
      })

      const totalHours = attendances.reduce((sum, a) => sum + (a.totalHours || 0), 0)
      const overtimeHours = Math.max(0, parseFloat((totalHours - (attendances.length * 8)).toFixed(2)))
      const serviceCharge = 220 // flat service charge per month

      const { overtimePay, grossSalary, epfDeduction, socsoDeduction, netSalary } =
        calculatePayroll(emp.salary, overtimeHours, serviceCharge)

      const payroll = await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          month: targetMonth,
          year: targetYear,
          basicSalary: emp.salary,
          overtimeHours,
          overtimePay,
          serviceCharge,
          epfDeduction,
          socsoDeduction,
          grossSalary,
          netSalary,
          status: 'PROCESSED'
        }
      })

      results.push({
        employee: emp.name,
        employeeId: emp.employeeId,
        netSalary,
        status: 'PROCESSED'
      })
    }

    res.status(201).json({
      message: `Payroll generated for ${targetMonth}/${targetYear}`,
      processed: results.length,
      skipped: errors.length,
      results,
      errors
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll — Admin views all payroll records
const getAllPayroll = async (req, res) => {
  try {
    const { month, year } = req.query

    const payrolls = await prisma.payroll.findMany({
      where: {
        ...(month && { month: parseInt(month) }),
        ...(year && { year: parseInt(year) })
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
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })

    const totalNet = payrolls.reduce((sum, p) => sum + p.netSalary, 0)

    res.json({
      total: payrolls.length,
      totalNetSalary: parseFloat(totalNet.toFixed(2)),
      payrolls
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/my — Employee views own payslips
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

// GET /api/payroll/:id — Get single payslip
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

    // Staff can only view own payslip
    if (req.user.role === 'STAFF' && payroll.employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(payroll)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/:id/pay — Admin marks payroll as paid
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

module.exports = { generatePayroll, getAllPayroll, getMyPayroll, getPayrollById, markAsPaid }