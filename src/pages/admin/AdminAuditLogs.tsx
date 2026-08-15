import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Database,
  Users,
} from "lucide-react";
import { fetchAuditLogs, fetchAuditLogSummary } from "@/services/api";
import { formatRelativeDate } from "@/utils";
import AdminListSearch from "@/components/AdminListSearch";

const PAGE_SIZE = 25;
const actionLabels: Record<string, string> = {
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
  publish: "Xuất bản",
  hide: "Ẩn",
  restore: "Khôi phục",
  lock: "Khóa",
  unlock: "Mở khóa",
  revoke_sessions: "Thu hồi phiên",
  approve: "Duyệt",
  reject: "Từ chối",
};
const entityLabels: Record<string, string> = {
  posts: "Bài viết",
  users: "Người dùng",
  series: "Chuyên đề",
  community_posts: "Bài cộng đồng",
  community_post_comments: "Bình luận cộng đồng",
  comments: "Bình luận bài viết",
  reports: "Báo cáo",
  content_reports: "Báo cáo nội dung",
  media_assets: "Media",
};

function formatCount(value?: number) {
  return new Intl.NumberFormat("vi-VN").format(value ?? 0);
}

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit-logs", page, search, action, entityType, sort],
    queryFn: async () => {
      const result = await fetchAuditLogs({
        page,
        limit: PAGE_SIZE,
        search,
        action: action || undefined,
        entityType: entityType || undefined,
        sort,
      });
      if (result.error) throw result.error;
      return { logs: result.data, count: result.count ?? 0 };
    },
  });
  const { data: summary } = useQuery({
    queryKey: ["admin-audit-summary", 30],
    queryFn: async () => {
      const result = await fetchAuditLogSummary(30);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const logs = data?.logs ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-start gap-3 mb-6">
        <ClipboardList size={23} className="text-blue-400 mt-1" />
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-family-display)" }}
          >
            Nhật ký quản trị
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Dấu vết bất biến giúp biết ai đã thay đổi gì, khi nào và trên đối
            tượng nào.
          </p>
        </div>
      </div>

      <div className="admin-audit-stats">
        <div className="card">
          <Database size={17} />
          <span>Tổng bản ghi</span>
          <strong>{formatCount(summary?.total)}</strong>
        </div>
        <div className="card">
          <Activity size={17} />
          <span>24 giờ qua</span>
          <strong>{formatCount(summary?.last_24h)}</strong>
        </div>
        <div className="card">
          <AlertTriangle size={17} />
          <span>Thao tác nhạy cảm / 30 ngày</span>
          <strong>{formatCount(summary?.destructive)}</strong>
        </div>
        <div className="card">
          <Users size={17} />
          <span>Người quản trị hoạt động / 30 ngày</span>
          <strong>{formatCount(summary?.unique_actors)}</strong>
        </div>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <AdminListSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Tìm thao tác hoặc loại đối tượng..."
          storageKey="football-stories-admin-audit-search"
          suggestions={["delete", "publish", "users", "community_posts"]}
        />
        <select
          className="input h-9 w-auto text-sm"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc thao tác"
        >
          <option value="">Tất cả thao tác</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="input h-9 w-auto text-sm"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc đối tượng"
        >
          <option value="">Tất cả đối tượng</option>
          {Object.entries(entityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="input h-9 w-auto text-sm"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as typeof sort);
            setPage(1);
          }}
          aria-label="Sắp xếp nhật ký"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>
        <span
          className="ml-auto text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Nổi bật:{" "}
          {actionLabels[summary?.top_action ?? ""] ??
            summary?.top_action ??
            "—"}{" "}
          ·{" "}
          {entityLabels[summary?.top_entity ?? ""] ??
            summary?.top_entity ??
            "—"}
        </span>
      </div>

      {error ? (
        <div className="empty-state">
          Không thể tải nhật ký. Hãy kiểm tra quyền quản trị.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-audit-table">
              <thead>
                <tr className="border-b">
                  {[
                    "Thời gian",
                    "Người thực hiện",
                    "Thao tác",
                    "Đối tượng",
                    "Chi tiết",
                  ].map((label) => (
                    <th
                      key={label}
                      className="text-left px-4 py-3 text-xs uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      Đang tải nhật ký…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Không có bản ghi phù hợp.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <td
                        className="px-4 py-3 text-xs whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatRelativeDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {log.actor?.username ?? "Hệ thống"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge text-xs ${["delete", "hide", "lock", "reject"].includes(log.action) ? "badge-orange" : "badge-blue"}`}
                        >
                          {actionLabels[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <strong>
                          {entityLabels[log.entity_type] ?? log.entity_type}
                        </strong>
                        {log.entity_id && (
                          <small
                            className="block mt-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            ID: {log.entity_id.slice(0, 8)}…
                          </small>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <details className="admin-audit-details">
                          <summary>Xem dữ liệu thay đổi</summary>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="admin-pagination" aria-label="Phân trang nhật ký">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trang trước
          </button>
          <span>
            Trang {page}/{totalPages} · {formatCount(total)} bản ghi
          </span>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            Trang sau
          </button>
        </nav>
      )}
    </div>
  );
}
