import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { updateUserStatus, updateUserRole } from '@/services/api'
import { Search, UserX, UserCheck, Shield, ShieldOff, Trash2, PlusCircle, UserPlus } from 'lucide-react'
import { formatDate, getInitials } from '@/utils'
import Tooltip from '@/components/Tooltip'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '', username: '', role: 'user' as 'user' | 'admin' })
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      let query = supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1)
      if (search) query = query.ilike('username', `%${search}%`)
      return query
    },
  })

  const users = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: { data: { username: newUserForm.username } }
      })
      if (error) throw error
      // if role is admin, wait for trigger to sync to public.users, then update role
      if (newUserForm.role === 'admin' && data.user) {
        await new Promise(resolve => setTimeout(resolve, 800))
        await updateUserRole(data.user.id, 'admin')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowNewUser(false)
      setNewUserForm({ email: '', password: '', username: '', role: 'user' })
      toast.success('Đã thêm người dùng')
    },
    onError: (err: any) => toast.error(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' | 'banned' }) => {
      await updateUserStatus(id, status)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã cập nhật trạng thái người dùng') },
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'admin' | 'user' }) => {
      await updateUserRole(id, role)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã cập nhật vai trò người dùng') },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('users').delete().eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Đã xóa người dùng') },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Quản lý người dùng</h1>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Tìm người dùng..." className="input pl-9 h-9 text-sm w-52" />
          </div>
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
                <option value="admin">Quản trị viên</option>
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
              ) : users.map((u: any) => (
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
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>
                      {u.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                    </span>
                  </td>
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
                      {u.role === 'user' ? (
                        <Tooltip content="Cấp quyền quản trị viên" placement="top">
                          <button onClick={() => roleMutation.mutate({ id: u.id, role: 'admin' })} disabled={roleMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs disabled:opacity-50" style={{ color: '#60a5fa' }}>
                            <Shield size={13} />
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Gỡ quyền quản trị viên" placement="top">
                          <button onClick={() => roleMutation.mutate({ id: u.id, role: 'user' })} disabled={roleMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs disabled:opacity-50" style={{ color: 'var(--text-muted)' }}>
                            <ShieldOff size={13} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip content="Xóa người dùng vĩnh viễn" placement="top">
                        <button onClick={() => { if (confirm('Bạn có chắc muốn xóa người dùng này?')) deleteMutation.mutate(u.id) }} disabled={deleteMutation.isPending}
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
    </div>
  )
}
