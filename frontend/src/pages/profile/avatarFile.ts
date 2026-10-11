/**
 * ตรวจไฟล์รูปประจำตัวในหน้าเว็บก่อนอัปโหลด — ให้ผู้ใช้รู้ผลทันทีโดยไม่ต้องรออัปโหลด
 * (ข้อตกลงก้อน 1: JPG / PNG / WebP ไม่เกิน 2 MB) ; backend ตรวจซ้ำจากเนื้อไฟล์จริงเสมอ
 * ใช้รหัส error เดียวกับ backend → ข้อความไทยเดียวกันจาก th.ts
 */

/** ชนิดไฟล์ที่รับ (ใช้ใน accept ของช่องเลือกไฟล์ด้วย) */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'

/** ขนาดไฟล์สูงสุด 2 MB (ตรงกับ AVATAR_MAX_BYTES ฝั่ง backend) */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/**
 * ตรวจไฟล์ที่ผู้ใช้เลือก
 * @returns รหัส error (avatar_invalid_type / avatar_too_large) หรือ null ถ้าผ่าน
 */
export function checkAvatarFile(file: File): 'avatar_invalid_type' | 'avatar_too_large' | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) return 'avatar_invalid_type'
  if (file.size > AVATAR_MAX_BYTES) return 'avatar_too_large'
  return null
}
