/**
 * สุ่มรหัสผ่านชั่วคราวในหน้าเว็บ — ปุ่ม "สุ่มรหัส" ของหน้าต่างเพิ่มผู้ใช้ / รีเซ็ตรหัสผ่าน (ขั้น 2.6)
 *
 * กติกาเดียวกับรหัสที่ backend สุ่มให้ตอนนำเข้า CSV (backend/accounts/passwords.py):
 *   - ยาว 12 ตัว จากชุดตัวอักษร 56 ตัว — ตัดตัวที่สับสนง่าย (l I 1 o O 0) ออก ไม่มีสัญลักษณ์
 *     (อ่านออกเสียง/พิมพ์ตามง่าย และไม่ถูก Excel มองเป็นสูตร)
 *   - สุ่มด้วย crypto.getRandomValues (ตัวสุ่มสำหรับงานความปลอดภัย — ไม่ใช่ Math.random)
 *   - ไม่เอนเอียง: ทิ้งค่าสุ่มที่ทำให้บางตัวอักษรออกบ่อยกว่าตัวอื่น (rejection sampling)
 * backend ตรวจกฎรหัสผ่าน 4 ข้ออีกครั้งเสมอตอนบันทึก
 */

/** ชุดตัวอักษรที่ใช้สุ่ม (56 ตัว) */
export const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyz' + 'ABCDEFGHJKLMNPQRSTUVWXYZ' + '23456789'

/** ความยาวรหัสผ่านชั่วคราว — 56^12 ≈ 2^69 แบบ */
export const TEMP_PASSWORD_LENGTH = 12

/**
 * ค่าสุ่ม 1 ไบต์ (0–255) ที่ยอมรับได้ต้องน้อยกว่า 224 (= 56 × 4)
 * ถ้าใช้ทุกค่า 0–255 แล้วหารเอาเศษด้วย 56 ตัวอักษร 32 ตัวแรกจะออกบ่อยกว่าตัวอื่น
 */
const BYTE_LIMIT = 256 - (256 % PASSWORD_ALPHABET.length)

/** ตัวสุ่มไบต์: เติมค่าสุ่มลงใน buffer แล้วคืน buffer เดิม (ส่งตัวปลอมได้ใน test) */
type RandomBytes = (buffer: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>

/** เติมไบต์สุ่มด้วยตัวสุ่มของเบราว์เซอร์ */
const browserRandom: RandomBytes = (buffer) => {
  crypto.getRandomValues(buffer)
  return buffer
}

/** สุ่มรหัสผ่านชั่วคราว 12 ตัว */
export function generateTempPassword(randomBytes: RandomBytes = browserRandom): string {
  let password = ''
  // สุ่มทีละชุด จนได้ตัวอักษรครบ (ค่าที่ทิ้งมีโอกาสแค่ 1 ใน 8 จึงแทบไม่ต้องสุ่มซ้ำ)
  while (password.length < TEMP_PASSWORD_LENGTH) {
    for (const byte of randomBytes(new Uint8Array(TEMP_PASSWORD_LENGTH * 2))) {
      if (byte >= BYTE_LIMIT) continue
      password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
      if (password.length === TEMP_PASSWORD_LENGTH) break
    }
  }
  return password
}
