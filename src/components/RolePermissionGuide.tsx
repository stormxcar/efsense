import { Check, Crown, Eye, FilePenLine, ShieldCheck, UserRound, X } from 'lucide-react'
import type { UserRow } from '@/types/database'

const rolePermissionDefinitions: Array<{
  role: UserRow['role']
  label: string
  summary: string
  responsibilities: string[]
  permissions: string[]
  restrictions: string[]
}> = [
  {
    role: 'user',
    label: 'Người dùng',
    summary: 'Thành viên thông thường, không truy cập trang quản trị.',
    responsibilities: ['Tuân thủ quy tắc cộng đồng', 'Tự chịu trách nhiệm về bài đăng và bình luận'],
    permissions: ['Đọc, bình luận và thả cảm xúc', 'Đăng bài/Reels cộng đồng', 'Lưu, theo dõi, báo cáo và quản lý hồ sơ cá nhân'],
    restrictions: ['Không tạo hoặc sửa bài tạp chí', 'Không xem dữ liệu quản trị hay danh tính ẩn danh'],
  },
  {
    role: 'contributor',
    label: 'Cộng tác viên',
    summary: 'Soạn nội dung tạp chí của chính mình để biên tập viên duyệt.',
    responsibilities: ['Chuẩn bị nội dung và nguồn ảnh chính xác', 'Giữ bài ở bản nháp cho tới khi được duyệt'],
    permissions: ['Truy cập khu biên tập', 'Tạo, sửa và xóa bản nháp do mình sở hữu', 'Xem lịch và tài nguyên phục vụ biên tập'],
    restrictions: ['Không tự xuất bản', 'Không sửa bài của người khác', 'Không kiểm duyệt user, comment hoặc report'],
  },
  {
    role: 'editor',
    label: 'Biên tập viên',
    summary: 'Chịu trách nhiệm chất lượng và lịch xuất bản nội dung tạp chí.',
    responsibilities: ['Kiểm tra nội dung, SEO, bản quyền ảnh', 'Điều phối lịch biên tập và chất lượng xuất bản'],
    permissions: ['Tạo, sửa, xuất bản và lên lịch bài viết', 'Quản lý chuyên đề, timeline và phiên bản bài viết', 'Truy cập dashboard nội dung và thư viện media'],
    restrictions: ['Không quản lý tài khoản/role', 'Không khóa user hoặc xử lý báo cáo nếu không đồng thời là moderator'],
  },
  {
    role: 'moderator',
    label: 'Kiểm duyệt viên',
    summary: 'Giữ an toàn cho bình luận, cộng đồng, Reels và báo cáo vi phạm.',
    responsibilities: ['Xử lý báo cáo công bằng và có bằng chứng', 'Bảo vệ dữ liệu thật phía sau tài khoản ẩn danh'],
    permissions: ['Ẩn/khôi phục/xóa comment và ảnh comment', 'Duyệt hoặc từ chối nội dung cộng đồng', 'Xem danh tính thật và lịch sử chỉnh sửa phục vụ kiểm duyệt'],
    restrictions: ['Không quản lý role và tài khoản admin', 'Không xuất bản bài tạp chí', 'Không xem nhật ký quản trị toàn hệ thống'],
  },
  {
    role: 'admin',
    label: 'Quản trị viên',
    summary: 'Quyền cao nhất, chịu trách nhiệm vận hành và bảo mật toàn hệ thống.',
    responsibilities: ['Áp dụng nguyên tắc quyền tối thiểu', 'Bật 2FA, rà audit log và bảo vệ khóa hệ thống'],
    permissions: ['Toàn bộ quyền biên tập và kiểm duyệt', 'Tạo tài khoản, gán role, khóa và thu hồi session', 'Xem audit log, bảo mật, thống kê và quản lý media'],
    restrictions: ['Không chia sẻ tài khoản hoặc khóa bí mật', 'Mọi thao tác nhạy cảm đều được ghi vào nhật ký quản trị'],
  },
]

const roleIcons = { user: UserRound, contributor: FilePenLine, editor: Eye, moderator: ShieldCheck, admin: Crown }

export default function RolePermissionGuide({ selectedRole, compact = false }: { selectedRole?: UserRow['role']; compact?: boolean }) {
  const definitions = selectedRole ? rolePermissionDefinitions.filter(item => item.role === selectedRole) : rolePermissionDefinitions
  return <div className={`role-permission-guide ${compact ? 'is-compact' : ''}`}>
    {definitions.map(definition => {
      const Icon = roleIcons[definition.role]
      return <article key={definition.role} className={`role-permission-card role-${definition.role}`}>
        <header><span><Icon size={18} /></span><div><p>{definition.label}</p><small>{definition.role}</small></div></header>
        <p className="role-permission-summary">{definition.summary}</p>
        <div className="role-permission-columns">
          <section><strong>Được phép</strong>{definition.permissions.map(item => <p key={item}><Check size={13} />{item}</p>)}</section>
          {!compact && <section><strong>Trách nhiệm</strong>{definition.responsibilities.map(item => <p key={item}><ShieldCheck size={13} />{item}</p>)}</section>}
          <section><strong>Giới hạn</strong>{definition.restrictions.map(item => <p key={item}><X size={13} />{item}</p>)}</section>
        </div>
      </article>
    })}
  </div>
}
