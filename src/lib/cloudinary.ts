export type CloudinaryFolder = 'football-stories/covers' | 'football-stories/avatars' | 'football-stories/comments' | 'football-stories/articles' | 'football-stories/series' | 'football-stories/community'

import { supabase } from '@/lib/supabase'

type CloudinaryUploadResponse = {
  secure_url: string
  public_id: string
  width: number
  height: number
  format: string
  bytes: number
  duration?: number
}

async function registerMediaAsset(result: CloudinaryUploadResponse, folder: CloudinaryFolder, resourceType: 'image' | 'video') {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('media_assets').upsert({
    public_id: result.public_id,
    secure_url: result.secure_url,
    resource_type: resourceType,
    folder,
    owner_id: user?.id ?? null,
    metadata: { width: result.width, height: result.height, format: result.format, bytes: result.bytes, duration: result.duration ?? null },
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'public_id' })
  if (error) console.warn('Không thể ghi nhận media vào thư viện:', error.message)
}

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

function assertConfiguration() {
  const missing = [
    !cloudName ? 'VITE_CLOUDINARY_CLOUD_NAME' : null,
    !uploadPreset ? 'VITE_CLOUDINARY_UPLOAD_PRESET' : null,
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`Cloudinary chưa được cấu hình: thiếu ${missing.join(' và ')}. VITE_CLOUDINARY_UPLOAD_FOLDER chỉ là thư mục, không thay thế được upload preset.`)
  }
}

function validateRemoteUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.toString()
  } catch {
    throw new Error('Đường dẫn ảnh không hợp lệ. Vui lòng dùng URL bắt đầu bằng http:// hoặc https://')
  }
}

export function validateImageFile(file: File, maxSizeMb = 8) {
  if (!file.type.startsWith('image/')) throw new Error('Tệp đã chọn không phải là hình ảnh')
  if (file.size > maxSizeMb * 1024 * 1024) throw new Error(`Ảnh phải nhỏ hơn ${maxSizeMb} MB`)
}

export function validateVideoFile(file: File, maxSizeMb = 60) {
  if (!file.type.startsWith('video/')) throw new Error('Tệp đã chọn không phải là video')
  if (file.size > maxSizeMb * 1024 * 1024) throw new Error(`Video Reels phải nhỏ hơn ${maxSizeMb} MB`)
}

export async function uploadImageToCloudinary(
  source: File | string,
  folder: CloudinaryFolder,
): Promise<CloudinaryUploadResponse> {
  assertConfiguration()
  if (source instanceof File) validateImageFile(source)

  const body = new FormData()
  body.append('file', typeof source === 'string' ? validateRemoteUrl(source.trim()) : source)
  body.append('upload_preset', uploadPreset!)
  body.append('folder', folder)
  body.append('tags', 'football-stories')

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  const result = await response.json()

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? 'Cloudinary không thể lưu ảnh')
  }
  const uploaded = result as CloudinaryUploadResponse
  await registerMediaAsset(uploaded, folder, 'image')
  return uploaded
}

export async function uploadVideoToCloudinary(
  source: File | string,
  folder: CloudinaryFolder = 'football-stories/community',
): Promise<CloudinaryUploadResponse> {
  assertConfiguration()
  if (source instanceof File) validateVideoFile(source)

  const body = new FormData()
  body.append('file', typeof source === 'string' ? validateRemoteUrl(source.trim()) : source)
  body.append('upload_preset', uploadPreset!)
  body.append('folder', folder)
  body.append('tags', 'football-stories,community,reels')

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body,
  })
  const result = await response.json()

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? 'Cloudinary không thể lưu video')
  }
  const uploaded = result as CloudinaryUploadResponse
  await registerMediaAsset(uploaded, folder, 'video')
  return uploaded
}
