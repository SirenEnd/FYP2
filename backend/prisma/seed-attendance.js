const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

// generate small GPS offset (~100m radius)
function generateNearbyLocation(lat, lng) {
  const radius = 0.0010 // ~100m

  const newLat = lat + (Math.random() - 0.5) * radius
  const newLng = lng + (Math.random() - 0.5) * radius

  return { lat: newLat, lng: newLng }
}

function isWorkDay(probability = 0.8) {
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
  const employees = await prisma.employee.findMany({
    include: { branch: true }
  })

  const start = new Date('2026-01-01')
  const end = new Date('2026-04-30')
  const dates = getDates(start, end)

  const records = []

  for (const emp of employees) {
    if (!emp.branch) continue

    const isSupervisor = emp.role === 'SUPERVISOR'

    for (const date of dates) {

      const workChance = isSupervisor ? 0.9 : 0.8
      if (!isWorkDay(workChance)) continue

      const baseHour = randomBetween(8, 11)
      const workHours = isSupervisor ? randomBetween(6, 9) : randomBetween(5, 8)

      const clockIn = new Date(date)
      clockIn.setHours(baseHour, Math.floor(randomBetween(0, 30)), 0)

      const clockOut = new Date(clockIn)
      clockOut.setHours(clockIn.getHours() + workHours)

      // GPS near branch (100m rule simulation)
      const location = generateNearbyLocation(
        emp.branch.latitude || 0,
        emp.branch.longitude || 0
      )

      records.push({
        employeeId: emp.id,
        branchId: emp.branchId,
        clockIn,
        clockOut,
        totalHours: workHours,
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

  console.log(`✅ Inserted ${records.length} attendance records`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())