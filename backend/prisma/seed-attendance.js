const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function chance(prob) {
  return Math.random() < prob
}

// ~100m GPS offset
function generateNearbyLocation(lat, lng) {
  const radius = 0.0010

  return {
    lat: lat + (Math.random() - 0.5) * radius,
    lng: lng + (Math.random() - 0.5) * radius
  }
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
  const employees = await prisma.employee.findMany({
    include: { branch: true }
  })

  const dates = getDates(
    new Date('2026-01-01'),
    new Date('2026-04-30')
  )

  const records = []

  for (const emp of employees) {
    if (!emp.branch) continue

    const isSupervisor = emp.role === 'SUPERVISOR'

    for (const date of dates) {

      // =========================
      // ATTENDANCE PROBABILITY
      // =========================
      let attendanceChance

      if (emp.role === 'ADMIN') continue // admin excluded

      if (isSupervisor) {
        attendanceChance = 0.92
      } else {
        attendanceChance = 0.78
      }

      // skip absent days
      if (!chance(attendanceChance)) continue

      // =========================
      // LATE ARRIVAL (realistic)
      // =========================
      const isLate = chance(isSupervisor ? 0.05 : 0.18)

      const baseHour = isLate
        ? randomBetween(10, 12)   // late arrival
        : randomBetween(8, 10)    // normal arrival

      const clockIn = new Date(date)
      clockIn.setHours(
        Math.floor(baseHour),
        Math.floor(randomBetween(0, 59)),
        0
      )

      // =========================
      // SHIFT LENGTH (realistic)
      // =========================
      let workHours

      if (isSupervisor) {
        workHours = randomBetween(6, 9)
      } else {
        workHours = randomBetween(5, 8)
      }

      // =========================
      // EARLY LEAVE (rare)
      // =========================
      const leftEarly = chance(isSupervisor ? 0.05 : 0.12)

      if (leftEarly) {
        workHours -= randomBetween(0.5, 2)
        if (workHours < 4) workHours = 4
      }

      const clockOut = new Date(clockIn)
      clockOut.setHours(clockIn.getHours() + Math.floor(workHours))

      // =========================
      // OVERTIME (RARE)
      // =========================
      let overtimeHours = 0

      const hasOvertime = chance(isSupervisor ? 0.12 : 0.08)

      if (hasOvertime) {
        overtimeHours = randomBetween(1, 3)
        clockOut.setHours(clockOut.getHours() + Math.floor(overtimeHours))
      }

      // =========================
      // GPS LOCATION
      // =========================
      const location = generateNearbyLocation(
        emp.branch.latitude || 0,
        emp.branch.longitude || 0
      )

      records.push({
        employeeId: emp.id,
        branchId: emp.branchId,
        clockIn,
        clockOut,
        totalHours: workHours + overtimeHours,
        status: 'PRESENT',
        date: new Date(date),
        latitude: location.lat,
        longitude: location.lng
      })
    }
  }

  await prisma.attendance.createMany({
    data: records,
    skipDuplicates: true
  })

  console.log(`✅ Inserted ${records.length} realistic attendance records`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())