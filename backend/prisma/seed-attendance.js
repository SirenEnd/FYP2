const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function isWorkDay(probability = 0.75) {
  return Math.random() < probability
}

function getDates(start, end) {
  const dates = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

async function seed() {
  const employees = await prisma.employee.findMany()

  const start = new Date('2026-01-01')
  const end = new Date('2026-04-30')
  const dates = getDates(start, end)

  const records = []

  for (const emp of employees) {
    const isSupervisor = emp.role === 'SUPERVISOR'

    for (const date of dates) {

      // skip random off days
      const workChance = isSupervisor ? 0.85 : 0.75
      if (!isWorkDay(workChance)) continue

      const baseStartHour = randomBetween(8, 11)

      const workHours = isSupervisor
        ? randomBetween(6, 9)
        : randomBetween(5, 8)

      const overtimeHours = Math.random() < 0.2
        ? randomBetween(1, 3)
        : 0

      const clockIn = new Date(date)
      clockIn.setHours(baseStartHour, randomBetween(0, 30), 0)

      const clockOut = new Date(date)
      clockOut.setHours(baseStartHour + workHours, randomBetween(0, 30), 0)

      records.push({
        employeeId: emp.id,
        clockIn,
        clockOut,
        totalHours: workHours + overtimeHours,
        status: 'PRESENT',
        date: new Date(date),
      })
    }
  }

  await prisma.attendance.createMany({
    data: records,
    skipDuplicates: true,
  })

  console.log(`Inserted ${records.length} realistic attendance records`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())