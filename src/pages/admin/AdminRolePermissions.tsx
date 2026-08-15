import { Info, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import RolePermissionGuide from "@/components/RolePermissionGuide";

export default function AdminRolePermissions() {
  const { user } = useAuth();
  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <ShieldCheck size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-family-display)" }}
          >
            Quyền và vai trò
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Tài liệu nội bộ giúp mỗi thành viên hiểu rõ phạm vi quyền ngay khi
            được cấp tài khoản.
          </p>
        </div>
      </div>
      <div className="role-current-access card">
        <KeyRound size={18} />
        <div>
          <span>Vai trò hiện tại của bạn</span>
          <strong>{user?.role ?? "user"}</strong>
        </div>
        <p>
          Giao diện chỉ hiển thị những chức năng phù hợp; Supabase RLS và RPC
          tiếp tục kiểm tra quyền ở server cho mọi thao tác.
        </p>
      </div>
      <RolePermissionGuide />
      <div className="role-security-note">
        <Info size={17} />
        <p>
          Nếu nhiệm vụ thay đổi, quản trị viên nên cập nhật role thay vì dùng
          chung tài khoản. Chỉ cấp quyền cao hơn khi thực sự cần và thu hồi
          session sau khi thay đổi quyền nhạy cảm.
        </p>
      </div>
    </div>
  );
}
