import { useState } from 'react'
import { Image, Link as LinkIcon, UploadCloud, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadImageToCloudinary, type CloudinaryFolder } from '@/lib/cloudinary'
import { useProcessing } from '@/hooks/useProcessing'

type Props = {
  value: string
  onChange: (url: string) => void
  folder: CloudinaryFolder
  label?: string
}

export default function CloudinaryImageField({ value, onChange, folder, label = 'Hình ảnh' }: Props) {
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const process = useProcessing()

  const upload = async (source: File | string) => {
    setLoading(true)
    try {
      const result = await process('Đang lưu ảnh lên Cloudinary...', () => uploadImageToCloudinary(source, folder))
      onChange(result.secure_url)
      setUrl(result.secure_url)
      toast.success('Đã lưu ảnh trên Cloudinary')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ảnh')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-2">{label}</label>
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="w-full h-36 object-cover rounded-lg" />
          <button type="button" onClick={() => { onChange(''); setUrl('') }} className="absolute top-2 right-2 share-utility" aria-label="Xóa ảnh">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-1 p-1 mb-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <button type="button" onClick={() => setMode('file')} className={mode === 'file' ? 'btn-primary flex-1 min-h-8 text-xs' : 'btn-ghost flex-1 min-h-8 text-xs'}>
              <UploadCloud size={13} /> Tải tệp
            </button>
            <button type="button" onClick={() => setMode('url')} className={mode === 'url' ? 'btn-primary flex-1 min-h-8 text-xs' : 'btn-ghost flex-1 min-h-8 text-xs'}>
              <LinkIcon size={13} /> Dán URL
            </button>
          </div>
          {mode === 'file' ? (
            <label className="flex flex-col items-center justify-center min-h-28 border border-dashed rounded-lg cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
              {loading ? <span className="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" /> : <><Image size={20} /><span className="text-xs mt-2">Chọn ảnh</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" disabled={loading} onChange={event => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }} />
            </label>
          ) : (
            <div className="flex gap-2">
              <input value={url} onChange={event => setUrl(event.target.value)} className="input text-sm" placeholder="https://..." />
              <button type="button" disabled={loading || !url.trim()} onClick={() => void upload(url)} className="btn-primary px-3 disabled:opacity-50">
                {loading ? 'Đang lưu' : 'Lưu'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
