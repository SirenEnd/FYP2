require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {

  // ── DEPARTMENTS ───────────────────────────────────────────────
  const kitchen = await prisma.department.upsert({
    where: { name: 'Kitchen' },
    update: {},
    create: { name: 'Kitchen' }
  })

  const service = await prisma.department.upsert({
    where: { name: 'F&B Service' },
    update: {},
    create: { name: 'F&B Service' }
  })

  const management = await prisma.department.upsert({
    where: { name: 'Management' },
    update: {},
    create: { name: 'Management' }
  })

  console.log('✅ Departments created')

  // ── BRANCH ────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { name: 'Air Putih Main Branch' },
    update: {},
    create: {
      name: 'Air Putih Main Branch',
      address: 'Jalan Air Putih, Kuantan',
      isActive: true,
      latitude: 3.832790246950293, 
      longitude:  103.34158788617017
    }
  })

  console.log('✅ Branch created')

  // ── PASSWORDS ─────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 10)

  // ── ADMIN ─────────────────────────────────────────────────────
  await prisma.employee.upsert({
    where: { email: 'admin@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-000',
      name: 'Faizal Hassan',
      email: 'admin@restrohr.com',
      password,
      role: 'ADMIN',
      position: 'Admin',
      salary: 5000,
      departmentId: management.id,
      branchId: branch.id
    }
  })

  // ── SUPERVISOR ────────────────────────────────────────────────
  await prisma.employee.upsert({
    where: { email: 'supervisor@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-007',
      name: 'Nurul Hidayah',
      email: 'supervisor@restrohr.com',
      password,
      role: 'SUPERVISOR',
      position: 'Supervisor',
      salary: 3200,
      departmentId: management.id,
      branchId: branch.id
    }
  })

  // ── KITCHEN STAFF ─────────────────────────────────────────────
  const kitchenStaff = [
    { employeeId: 'RST-001', name: 'Ahmad Rizal',  email: 'ahmad@restrohr.com',  salary: 1700 },
    { employeeId: 'RST-008', name: 'Farid Aiman',  email: 'farid@restrohr.com',  salary: 1700 },
    { employeeId: 'RST-009', name: 'Zarith Sofia', email: 'zarith@restrohr.com', salary: 1700 },
    { employeeId: 'RST-010', name: 'Hafizuddin',   email: 'hafiz@restrohr.com',  salary: 1700 },
  ]

  for (const staff of kitchenStaff) {
    await prisma.employee.upsert({
      where: { email: staff.email },
      update: {},
      create: {
        employeeId: staff.employeeId,
        name: staff.name,
        email: staff.email,
        password,
        role: 'STAFF',
        position: 'Kitchen Staff',
        salary: staff.salary,
        departmentId: kitchen.id,
        branchId: branch.id
      }
    })
  }

  // ── SERVICE CREW ──────────────────────────────────────────────
  const serviceCrew = [
    { employeeId: 'RST-002', name: 'Siti Aisyah',  email: 'siti@restrohr.com',   salary: 1600 },
    { employeeId: 'RST-003', name: 'Haziq Farhan', email: 'haziq@restrohr.com',  salary: 1600 },
    { employeeId: 'RST-004', name: 'Nurul Fatin',  email: 'fatin@restrohr.com',  salary: 1600 },
    { employeeId: 'RST-005', name: 'Azrul Hisham', email: 'azrul@restrohr.com',  salary: 1600 },
  ]

  for (const staff of serviceCrew) {
    await prisma.employee.upsert({
      where: { email: staff.email },
      update: {},
      create: {
        employeeId: staff.employeeId,
        name: staff.name,
        email: staff.email,
        password,
        role: 'STAFF',
        position: 'Service Crew',
        salary: staff.salary,
        departmentId: service.id,
        branchId: branch.id
      }
    })
  }

  console.log('✅ Employees created')

  // ── TIMETABLE ─────────────────────────────────────────────────
  // Deactivate any existing timetables for this branch first
  await prisma.timetable.updateMany({
    where: { branchId: branch.id },
    data: { isActive: false }
  })

  // Get admin employee for createdBy
  const admin = await prisma.employee.findUnique({
    where: { email: 'admin@restrohr.com' }
  })

  const timetable = await prisma.timetable.create({
    data: {
      branchId: branch.id,
      name: 'May 2026 Schedule',
      effectiveFrom: new Date('2026-05-01'),
      isActive: true,
      createdBy: admin.id
    }
  })

  console.log('✅ Timetable created')

  // ── SAMPLE TIMETABLE SLOTS ────────────────────────────────────
  // Get all employees for slot assignment
  const allStaff = await prisma.employee.findMany({
    where: { branchId: branch.id, role: 'STAFF' }
  })

  const getEmp = (name) => allStaff.find(e => e.name === name)

  // Sample slots — Mon to Fri, morning shift 8am-12pm for kitchen
  // Afternoon shift 12pm-5pm for service crew
  const slots = [
    // Monday
    { emp: 'Ahmad Rizal',  day: 0, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Ahmad Rizal',  day: 0, start: 9,  end: 10, station: 'Kitchen' },
    { emp: 'Ahmad Rizal',  day: 0, start: 10, end: 11, station: 'Kitchen' },
    { emp: 'Farid Aiman',  day: 0, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Farid Aiman',  day: 0, start: 9,  end: 10, station: 'Kitchen' },
    { emp: 'Siti Aisyah',  day: 0, start: 12, end: 13, station: 'Service' },
    { emp: 'Siti Aisyah',  day: 0, start: 13, end: 14, station: 'Service' },
    { emp: 'Haziq Farhan', day: 0, start: 12, end: 13, station: 'Service' },

    // Tuesday
    { emp: 'Zarith Sofia', day: 1, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Zarith Sofia', day: 1, start: 9,  end: 10, station: 'Kitchen' },
    { emp: 'Hafizuddin',   day: 1, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Nurul Fatin',  day: 1, start: 12, end: 13, station: 'Service' },
    { emp: 'Azrul Hisham', day: 1, start: 12, end: 13, station: 'Service' },

    // Wednesday
    { emp: 'Ahmad Rizal',  day: 2, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Farid Aiman',  day: 2, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Siti Aisyah',  day: 2, start: 12, end: 13, station: 'Service' },
    { emp: 'Haziq Farhan', day: 2, start: 12, end: 13, station: 'Service' },

    // Thursday
    { emp: 'Zarith Sofia', day: 3, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Hafizuddin',   day: 3, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Nurul Fatin',  day: 3, start: 12, end: 13, station: 'Service' },
    { emp: 'Azrul Hisham', day: 3, start: 12, end: 13, station: 'Service' },

    // Friday
    { emp: 'Ahmad Rizal',  day: 4, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Farid Aiman',  day: 4, start: 8,  end: 9,  station: 'Kitchen' },
    { emp: 'Zarith Sofia', day: 4, start: 10, end: 11, station: 'Kitchen' },
    { emp: 'Siti Aisyah',  day: 4, start: 12, end: 13, station: 'Service' },
    { emp: 'Haziq Farhan', day: 4, start: 12, end: 13, station: 'Service' },

    // Saturday
    { emp: 'Hafizuddin',   day: 5, start: 9,  end: 10, station: 'Kitchen' },
    { emp: 'Nurul Fatin',  day: 5, start: 11, end: 12, station: 'Service' },
    { emp: 'Azrul Hisham', day: 5, start: 11, end: 12, station: 'Service' },
  ]

  for (const slot of slots) {
    const emp = getEmp(slot.emp)
    if (!emp) continue
    await prisma.timetableSlot.upsert({
      where: {
        timetableId_dayOfWeek_startHour_employeeId: {
          timetableId: timetable.id,
          dayOfWeek: slot.day,
          startHour: slot.start,
          employeeId: emp.id
        }
      },
      update: {},
      create: {
        timetableId: timetable.id,
        employeeId: emp.id,
        dayOfWeek: slot.day,
        startHour: slot.start,
        endHour: slot.end,
        station: slot.station
      }
    })
  }

  console.log('✅ Timetable slots created')

  console.log('\n🎉 Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Branch     → Air Putih Main Branch')
  console.log('  Dept       → Kitchen, F&B Service, Management')
  console.log('  Employees  → 10 total (4 Kitchen, 4 Service, 1 Supervisor, 1 Admin)')
  console.log('  Timetable  → May 2026 Schedule (active)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Test accounts (all password: password123)')
  console.log('  Admin      → admin@restrohr.com')
  console.log('  Supervisor → supervisor@restrohr.com')
  console.log('  Staff      → ahmad@restrohr.com')
  console.log('             → siti@restrohr.com')
  console.log('             → farid@restrohr.com')
  console.log('             → zarith@restrohr.com')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())