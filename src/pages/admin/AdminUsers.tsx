import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { createManagedUser, updateUserRole, runAdminSecurityAction } from '@/services/api'
import { UserX, UserCheck, Trash2, PlusCircle, UserPlus, LogOut } from 'lucide-react'
import { formatDate, getInitials } from '@/utils'
import Tooltip from '@/components/Tooltip'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { requiredText, validateAdminEmail, validatePassword } from '@/utils/validation'
import type { UserRow } from '@/types/database'
import ConfirmModal from '@/components/ConfirmModal'
import AdminListSearch from '@/components/AdminListSearch'

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '', username: '', role: 'user' as UserRow['role'] })
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | UserRow['role']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest')
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, statusFilter, sort],
    queryFn: async () => {
      let query = supabase.from('users').select('*', { count: 'exact' }).order(sort === 'name' ? 'username' : 'created_at', { ascending: sort !== 'newest' }).range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1)
      if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
      if (roleFilter !== 'all') query = query.eq('role', roleFilter)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      return query
    },
  })

  const users = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const email = validateAdminEmail(newUserForm.email)
      const password = validatePassword(newUserForm.password)
      const username = requiredText(newUserForm.username, 'Tên hiển thị', 2, 40)
      const result = await createManagedUser({ email, password, username, role: newUserForm.role })
      if (result.error) throw result.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowNewUser(false)
      setNewUserForm({ email: '', password: '', username: '', role: 'user' })
      toast.success('Đã thêm người dùng')
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Không thể tạo người dùng'),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' | 'banned' }) => {
      if (id === currentUser?.id && status !== 'active') throw new Error('Không thể tự khóa tài khoản quản trị đang đăng nhập')
      const result = await runAdminSecurityAction(status === 'active' ? 'unlock' : 'lock', id)
      if (result.error) throw result.error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã cập nhật trạng thái người dùng') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái'),
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRow['role'] }) => {
      if (id === currentUser?.id && role !== 'admin') throw new Error('Không thể tự gỡ quyền quản trị của chính mình')
      await updateUserRole(id, role)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã cập nhật vai trò người dùng') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật vai trò'),
  })

  const securityMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'revoke_sessions' }) => runAdminSecurityAction(action, id).then(result => { if (result.error) throw result.error }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã cập nhật bảo mật tài khoản') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật bảo mật'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id === currentUser?.id) throw new Error('Không thể xóa tài khoản quản trị đang đăng nhập')
      const result = await supabase.from('users').delete().eq('id', id)
      if (result.error) throw result.error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã xóa người dùng') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể xóa người dùng'),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Quản lý người dùng</h1>
        <div className="flex items-center gap-4">
          <AdminListSearch value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Tìm người dùng..." storageKey="football-stories-admin-users-search" suggestions={['admin', 'editor', 'moderator', 'contributor']} />
          <select value={roleFilter} onChange={event => { setRoleFilter(event.target.value as typeof roleFilter); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Lọc vai trò người dùng">
            <option value="all">Tất cả vai trò</option>
            <option value="user">Người dùng</option>
            <option value="contributor">Cộng tác viên</option>
            <option value="editor">Biên tập viên</option>
            <option value="moderator">Kiểm duyệt viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Lọc trạng thái người dùng">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="suspended">Tạm ngưng</option>
            <option value="banned">Đã cấm</option>
          </select>
          <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Sắp xếp người dùng">
            <option value="newest">Mới tham gia</option>
            <option value="oldest">Tham gia lâu nhất</option>
            <option value="name">Theo tên A-Z</option>
          </select>
          <button onClick={() => setShowNewUser(!showNewUser)} className="btn-primary text-sm">
            <UserPlus size={15} /> Thêm người dùng
          </button>
        </div>
      </div>

      {/* Manual User Creation Form */}
      {showNewUser && (
        <div className="card p-6 mb-6 animate-fade-in-up">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><PlusCircle size={18} className="text-blue-400" /> Tạo người dùng mới</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email *</label>
              <input value={newUserForm.email} onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))}
                className="input text-sm" placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mật khẩu *</label>
              <input value={newUserForm.password} onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))}
                className="input text-sm" type="password" placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tên hiển thị *</label>
              <input value={newUserForm.username} onChange={e => setNewUserForm(f => ({ ...f, username: e.target.value }))}
                className="input text-sm" placeholder="Tên hiển thị" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Vai trò</label>
              <select value={newUserForm.role} onChange={e => setNewUserForm(f => ({ ...f, role: e.target.value as 'user' | 'admin' }))}
                className="input text-sm">
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option><option value="editor">Biên tập viên</option><option value="moderator">Kiểm duyệt viên</option><option value="contributor">Cộng tác viên</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => createUserMutation.mutate()}
              disabled={!newUserForm.email || !newUserForm.password || !newUserForm.username || createUserMutation.isPending}
              className="btn-primary text-sm flex items-center justify-center min-w-[120px]">
              {createUserMutation.isPending ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : 'Tạo người dùng'}
            </button>
            <button onClick={() => setShowNewUser(false)} className="btn-ghost text-sm">Hủy</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {['Người dùng', 'Vai trò', 'Trạng thái', 'Ngày tham gia', 'Thao tác'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>)}
                  </tr>
                ))
              ) : (users as UserRow[]).map(u => (
                <tr key={u.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                          {getInitials(u.username)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{u.username}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><select className="input text-xs py-1 px-2 min-w-36" value={u.role} disabled={roleMutation.isPending || u.id === currentUser?.id} onChange={event => roleMutation.mutate({ id: u.id, role: event.target.value as UserRow['role'] })} aria-label={`Vai trò của ${u.username}`}><option value="user">Người dùng</option><option value="contributor">Cộng tác viên</option><option value="editor">Biên tập viên</option><option value="moderator">Kiểm duyệt viên</option><option value="admin">Quản trị viên</option></select></td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.status === 'active' ? 'badge-green' : u.status === 'suspended' ? 'badge-orange' : 'badge-red'}`}>
                      {u.status === 'active' ? 'Hoạt động' : u.status === 'suspended' ? 'Tạm ngưng' : 'Đã cấm'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {u.status === 'active' ? (
                        <Tooltip content="Tạm ngưng tài khoản" placement="top">
                          <button onClick={() => statusMutation.mutate({ id: u.id, status: 'suspended' })} disabled={statusMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs disabled:opacity-50" style={{ color: '#fb923c' }}>
                            <UserX size={13} />
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Kích hoạt tài khoản" placement="top">
                          <button onClick={() => statusMutation.mutate({ id: u.id, status: 'active' })} disabled={statusMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs disabled:opacity-50" style={{ color: '#4ade80' }}>
                            <UserCheck size={13} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip content="Thu hồi toàn bộ phiên đăng nhập" placement="top"><button onClick={() => securityMutation.mutate({ id: u.id, action: 'revoke_sessions' })} disabled={securityMutation.isPending} className="btn-ghost px-2 py-1 text-xs" style={{ color: '#f59e0b' }}><LogOut size={13} /></button></Tooltip>
                      <Tooltip content="Xóa người dùng vĩnh viễn" placement="top">
                        <button onClick={() => setConfirmUserId(u.id)} disabled={deleteMutation.isPending}
                          className="btn-ghost px-2 py-1 text-xs disabled:opacity-50" style={{ color: '#f87171' }}>
                          <Trash2 size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">Trang trước</button>
          <span className="text-sm px-4" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">Trang sau</button>
        </div>
      )}
      <ConfirmModal open={Boolean(confirmUserId)} title="Xóa người dùng?" message="Tài khoản và dữ liệu liên quan sẽ bị xóa vĩnh viễn. Hãy chắc chắn bạn đã kiểm tra nhật ký quản trị trước khi tiếp tục." confirmLabel="Xóa người dùng" loading={deleteMutation.isPending} onCancel={() => setConfirmUserId(null)} onConfirm={() => { if (confirmUserId) deleteMutation.mutate(confirmUserId, { onSettled: () => setConfirmUserId(null) }) }} />
    </div>
  )
}
