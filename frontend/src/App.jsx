import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import useIsMobile from './hooks/useIsMobile'
import DesktopOnly from './components/DesktopOnly'
import Login from './pages/Login'
import EmployeeManager from './components/AdminView/EmployeeManager'
import ScheduleManager from './components/SupervisorView/ScheduleManager'
import MySchedule from './components/StaffView/MySchedule'
import Attendance from './components/StaffView/Attendance'
import AttendanceReport from './components/SupervisorView/AttendanceReport'
import LeavePage from './pages/LeavePage'
import { PayrollAdmin, PayrollStaff } from './pages/PayrollPage'
import TaskManager from './components/SupervisorView/TaskManager'

const Dashboard = () => {
  const { user } = useAuthStore()
  const isMobile = useIsMobile()
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">AsohHRMS</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.name}</span>
            <span className="px-2 py-1 bg-gray-200 rounded text-sm">{user?.role}</span>
            <button
              onClick={() => useAuthStore.getState().logout()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
          <p>Welcome to your dashboard, {user?.name}!</p>
          <p className="text-gray-600 mt-2">Role: {user?.role}</p>
          <p className="text-gray-600">Employee ID: {user?.employeeId}</p>
          <p className="text-gray-600">Position: {user?.position || 'Not assigned'}</p>
        </div>
        
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {user?.role === 'ADMIN' && (
            <a href="/employees" className="block">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-semibold mb-2">👥 Employee Management</h3>
                <p className="text-gray-600 text-sm">Add, edit, or remove employees</p>
              </div>
            </a>
          )}
          
          {user?.role === 'ADMIN' && (
  
            <a href={isMobile ? undefined : '/payroll'}
              onClick={(e) => isMobile && e.preventDefault()}
              className="block"
            >
              <div className={`bg-white rounded-lg shadow p-6 transition ${
                isMobile ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
              }`}>
                <h3 className="text-lg font-semibold mb-2">💰 Payroll</h3>
                <p className="text-gray-600 text-sm">
                  {isMobile ? 'Desktop only' : 'Process monthly payroll'}
                </p>
              </div>
            </a>
          )}

          {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
            
            <a href={isMobile ? undefined : '/schedules'}
              onClick={(e) => isMobile && e.preventDefault()}
              className="block"
            >
              <div className={`bg-white rounded-lg shadow p-6 transition ${
                isMobile ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
              }`}>
                <h3 className="text-lg font-semibold mb-2">📅 Schedule Management</h3>
                <p className="text-gray-600 text-sm">
                  {isMobile ? 'Desktop only' : 'Create and manage shifts'}
                </p>
              </div>
            </a>
          )}

          {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
            <a href={isMobile ? undefined : '/tasks'}
              onClick={(e) => isMobile && e.preventDefault()}
              className="block"
            >
              <div className={`bg-white rounded-lg shadow p-6 transition ${
                isMobile ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
              }`}>
                <h3 className="text-lg font-semibold mb-2">🧹 Task Assignments</h3>
                <p className="text-gray-600 text-sm">
                  {isMobile ? 'Desktop only' : 'Assign cleaning, bartending & trash duties'}
               </p>
              </div>
           </a>
        )}
          
          <a href="/attendance" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-lg font-semibold mb-2">⏰ Attendance</h3>
              <p className="text-gray-600 text-sm">Clock in/out and view history</p>
            </div>
          </a>

          <a href="/my-schedule" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-lg font-semibold mb-2">📋 My Schedule</h3>
              <p className="text-gray-600 text-sm">View your upcoming shifts</p>
            </div>
          </a>

          {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
            <a href="/attendance-report" className="block">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-semibold mb-2">📊 Attendance Report</h3>
                <p className="text-gray-600 text-sm">View all employee attendance</p>
              </div>
            </a>
          )}

          {/* Leave — visible to all roles */}
          <a href="/leave" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-lg font-semibold mb-2">🌴 Leave Management</h3>
              <p className="text-gray-600 text-sm">
                {user?.role === 'STAFF'
                  ? 'Apply for leave and view your history'
                  : 'Review and approve leave requests'}
              </p>
            </div>
          </a>
        </div>
      </main>
    </div>
  )
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" />
  return children
}
// Add a PayrollRoute helper
const PayrollRoute = () => {
  const { user } = useAuthStore()
  if (user?.role === 'STAFF') return <PayrollStaff />
  return <PayrollAdmin role={user?.role} />
}

const MobileBlockedRoute = ({ children, feature }) => {
  const isMobile = useIsMobile()
  if (isMobile) return <DesktopOnly feature={feature} />
  return children
}



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <AdminRoute>
              <EmployeeManager />
            </AdminRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />

        {/* Schedule Routes */}
        <Route
          path="/schedules"
          element={
            <ProtectedRoute>
              <MobileBlockedRoute feature="Schedule Management">
                <ScheduleManager />
              </MobileBlockedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-schedule"
          element={
            <ProtectedRoute>
              <MySchedule />
            </ProtectedRoute>
          }
        />
        <Route
         path="/tasks"
       element={
          <ProtectedRoute>
            <MobileBlockedRoute feature="Task Assignments">
              <TaskManager />
            </MobileBlockedRoute>
                        </ProtectedRoute>
          }
        />

        {/* Attendance Routes */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance-report"
          element={
            <ProtectedRoute>
              <AttendanceReport />
            </ProtectedRoute>
          }
        />

        {/* Leave Route */}
        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <LeavePage />
            </ProtectedRoute>
          }
        />
                    <Route 
                path="/payroll" 
                element={
                  <ProtectedRoute>
                    <MobileBlockedRoute feature="Payroll">
                      <PayrollRoute />
                    </MobileBlockedRoute>
                  </ProtectedRoute>
                } 
              />
      </Routes>
    </BrowserRouter>
  )
}

export default App
