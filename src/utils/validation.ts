export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function requiredText(value: string, label: string, min: number, max: number): string {
  const cleaned = cleanText(value)
  if (cleaned.length < min) throw new Error(`${label} cần ít nhất ${min} ký tự`)
  if (cleaned.length > max) throw new Error(`${label} không được vượt quá ${max} ký tự`)
  return cleaned
}

export function validateYear(value: number): number {
  if (!Number.isInteger(value) || value < 1800 || value > 2100) throw new Error('Năm phải là số nguyên từ 1800 đến 2100')
  return value
}

export function validateIntegerRange(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} phải là số nguyên từ ${min} đến ${max}`)
  return value
}

export function validateHexColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Màu nhấn phải có định dạng #RRGGBB')
  return value.toLowerCase()
}

export function optionalHttpUrl(value: string, label: string): string | null {
  const cleaned = value.trim()
  if (!cleaned) return null
  try {
    const url = new URL(cleaned)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.toString()
  } catch {
    throw new Error(`${label} phải là URL http:// hoặc https:// hợp lệ`)
  }
}

export function validateAdminEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email không hợp lệ')
  return email
}

export function validateEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!email) throw new Error('Vui lòng nhập email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email cần có dạng ten@mien.com')
  return email
}

export function validateUsername(value: string): string {
  const username = cleanText(value)
  if (username.length < 3) throw new Error('Tên hiển thị cần ít nhất 3 ký tự')
  if (username.length > 30) throw new Error('Tên hiển thị không được vượt quá 30 ký tự')
  if (!/^[\p{L}\p{N} _.-]+$/u.test(username)) throw new Error('Tên hiển thị chỉ nên gồm chữ, số, khoảng trắng, dấu chấm hoặc gạch ngang')
  return username
}

export function validatePassword(value: string): string {
  if (value.length < 8 || value.length > 72) throw new Error('Mật khẩu phải dài từ 8 đến 72 ký tự')
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) throw new Error('Mật khẩu cần có cả chữ và số')
  return value
}
