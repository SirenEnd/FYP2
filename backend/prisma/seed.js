const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // =========================
  // DEPARTMENTS
  // =========================
  const kitchen = await prisma.department.upsert({
    where: { name: 'Kitchen' },
    update: {},
    create: { name: 'Kitchen' }
  })

  const management = await prisma.department.upsert({
    where: { name: 'Management' },
    update: {},
    create: { name: 'Management' }
  })

  const service = await prisma.department.upsert({
    where: { name: 'Service' },
    update: {},
    create: { name: 'Service' }
  })

  // =========================
  // BRANCHES (WITH 100m RULE NOTE)
  // =========================
  const branches = [
    {
      name: 'DevBranch',
      lat: 2.949120,
      lng: 101.669274
    },
    {
      name: 'AirPutih',
      lat: 3.8327916381049496,
      lng: 103.34161541779093
    },
    {
      name: 'InderaMahkota',
      lat: 3.835268812791736,
      lng: 103.30137698514375
    }
  ]

  const createdBranches = {}

  for (const b of branches) {
    createdBranches[b.name] = await prisma.branch.upsert({
      where: { name: b.name },
      update: {},
      create: {
        name: b.name,
        address: `${b.name} Branch`,
        latitude: b.lat,
        longitude: b.lng,
        isActive: true
      }
    })
  }

  // =========================
  // PASSWORD
  // =========================
  const password = await bcrypt.hash('password123', 10)

  // =========================
  // ADMIN (existing)
  // =========================
  await prisma.employee.upsert({
    where: { email: 'admin@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-000',
      name: 'Faizal Hassan',
      email: 'admin@restrohr.com',
      password,
      role: 'ADMIN',
      position: 'System Administrator',
      salary: 5000,
      departmentId: management.id,
      branchId: createdBranches.DevBranch.id
    }
  })

  // =========================
  // SUPERVISORS (2 TOTAL)
  // =========================
  const supervisors = [
    {
      id: 'RST-007',
      name: 'Nurul Hidayah',
      email: 'supervisor@restrohr.com',
      branch: createdBranches.AirPutih.id,
      position: 'Kitchen Supervisor',
      departmentId: kitchen.id,
      salary: 3200
    },
    {
      id: 'RST-008',
      name: 'Muhammad Zafran',
      email: 'supervisor2@restrohr.com',
      branch: createdBranches.InderaMahkota.id,
      position: 'Operations Supervisor',
      departmentId: service.id,
      salary: 3300
    }
  ]

  for (const s of supervisors) {
    await prisma.employee.upsert({
      where: { email: s.email },
      update: {},
      create: {
        employeeId: s.id,
        name: s.name,
        email: s.email,
        password,
        role: 'SUPERVISOR',
        position: s.position,
        salary: s.salary,
        departmentId: s.departmentId,
        branchId: s.branch
      }
    })
  }

  // =========================
  // MALAYSIAN NAME GENERATOR
  // =========================
  const firstNames = [
    'Afiq','Hakim','Zul','Amir','Haziq','Syafiq','Farhan','Imran','Daniel','Arif',
    'Aina','Nurul','Siti','Aisyah','Balqis','Farah','Hana','Liyana','Intan','Adriana'
  ]

  const lastNames = [
    'Hassan','Ismail','Rahman','Ali','Omar','Kamal','Aziz','Yusof','Halim','Ibrahim'
  ]

  function generateName(i) {
    return `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`
  }

  function generateEmail(name, role, i) {
    return (
      name
        .toLowerCase()
        .replace(/ /g, '.') +
      `.${role}${i}@restrohr.com`
    )
  }

  // =========================
  // STAFF CREATION (20 PEOPLE)
  // =========================
  const staffCount = 20

  for (let i = 0; i < staffCount; i++) {
    const isKitchen = i < 10

    const name = generateName(i)
    const roleType = isKitchen ? 'kitchen' : 'service'
    const email = generateEmail(name, roleType, i)

    const branchList = Object.values(createdBranches)
    const branch = branchList[i % branchList.length]

    await prisma.employee.upsert({
      where: { email },
      update: {},
      create: {
        employeeId: `RST-1${i.toString().padStart(2, '0')}`,
        name,
        email,
        password,
        role: 'STAFF',
        position: isKitchen ? 'Kitchen Crew' : 'Service Crew',
        salary: isKitchen ? 1800 : 1700,
        departmentId: isKitchen ? kitchen.id : service.id,
        branchId: branch.id
      }
    })
  }

  console.log('✅ Seed completed successfully!')
  console.log('Branches created:', Object.keys(createdBranches))
  console.log('Staff added:', staffCount)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())