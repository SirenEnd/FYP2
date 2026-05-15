import useAuthStore from "../stores/authStore";
import LeaveStaff from "../components/StaffView/LeaveStaff";
import LeaveApprovals from "../components/SupervisorView/LeaveApprovals";

export default function LeavePage() {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === "STAFF") return <LeaveStaff />;
  if (role === "SUPERVISOR") return <LeaveApprovals role="SUPERVISOR" />;
  if (role === "ADMIN") return <LeaveApprovals role="ADMIN" />;

  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Unauthorized — no role found.
    </div>
  );
}