export type CloudinaryFolder = 'football-stories/covers' | 'football-stories/avatars' | 'football-stories/comments' | 'football-stories/articles' | 'football-stories/series'

type CloudinaryUploadResponse = {
  secure_url: string
  public_id: string
  width: number
  height: number
  format: string
  bytes: number
}

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

function assertConfiguration() {
  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu VITE_CLOUDINARY_CLOUD_NAME hoặc VITE_CLOUDINARY_UPLOAD_PRESET trong file .env')
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
  return result as CloudinaryUploadResponse
}
