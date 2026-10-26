/**
 * Who can be added to a spreadsheet, checked before any Google request.
 * Owner access is never granted or removed here.
 */

export const SHARE_ACCESS = [
  { id: 'writer', label: 'Can edit' },
  { id: 'commenter', label: 'Can comment' },
  { id: 'reader', label: 'Can view' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function shareAccessLabel(role) {
  if (role === 'owner') return 'Owner'
  return SHARE_ACCESS.find((item) => item.id === role)?.label || 'Has access'
}

export function shareRequest(email, role) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized) return { ok: false, error: 'Enter the person’s email address.' }
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!SHARE_ACCESS.some((item) => item.id === role)) {
    return { ok: false, error: 'Choose whether they can view, comment, or edit.' }
  }
  return { ok: true, email: normalized, role }
}
