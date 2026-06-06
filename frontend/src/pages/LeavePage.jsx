import useAuthStore from "../stores/authStore";
import LeaveStaff from "../components/StaffView/LeaveStaff";
import LeaveApprovals from "../components/SupervisorView/LeaveApprovals";
import BackButton from "../components/BackButton";

export default function LeavePage() {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === "STAFF") return <LeaveStaff />;

  if (role === "SUPERVISOR") return (
    <div>
      <div className="px-6 pt-6">
        <BackButton />
      </div>
      <LeaveStaff isSupervisor hideBackButton />
      <LeaveApprovals role="SUPERVISOR" hideBackButton />
    </div>
  );

  if (role === "ADMIN") return (
    <div>
      <div className="px-6 pt-6">
        <BackButton />
      </div>
      <LeaveApprovals role="ADMIN" />
    </div>
  );

  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Unauthorized — no role found.
    </div>
  );
}