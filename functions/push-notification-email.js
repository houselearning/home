const ADMIN_EMAILS = new Set(['cajm23331@gmail.com']);
const ADMIN_UIDS = new Set(['2nuzhsYAXiaMhm4RhRWksNLIBcJ3']);

function parseNotificationTarget(subject) {
  const normalized = String(subject || '').trim();
  const directive = normalized.toLowerCase();
  if (directive === '@everyone') return { type: 'everyone' };
  if (directive === '@admins-only') return { type: 'admins' };
  if (directive === '@students') return { type: 'students' };
  if (directive === '@teachers') return { type: 'teachers' };

  const userMatch = normalized.match(/^@user\s+([^\s<>@]+@[^\s<>@]+)$/i);
  if (userMatch) return { type: 'user', email: userMatch[1].toLowerCase() };
  return null;
}

function accountRoles(user, storedRole) {
  return [user.customClaims && user.customClaims.role, storedRole]
    .filter(role => typeof role === 'string')
    .map(role => role.toLowerCase());
}

function isAdmin(user, storedRole) {
  const roles = accountRoles(user, storedRole);
  return user.customClaims?.admin === true
    || roles.includes('admin')
    || ADMIN_EMAILS.has(String(user.email || '').toLowerCase())
    || ADMIN_UIDS.has(user.uid);
}

function isTeacher(user, storedRole) {
  return accountRoles(user, storedRole).includes('teacher');
}

function selectRecipients(users, rolesByUid, target) {
  return users.filter(user => {
    const storedRole = rolesByUid.get(user.uid);
    if (target.type === 'user') return String(user.email || '').toLowerCase() === target.email;
    if (target.type === 'admins') return isAdmin(user, storedRole);
    if (target.type === 'teachers') return !isAdmin(user, storedRole) && isTeacher(user, storedRole);
    if (target.type === 'students') return !isAdmin(user, storedRole) && !isTeacher(user, storedRole);
    return target.type === 'everyone';
  });
}

function plainTextFromHtml(html) {
  return String(html)
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<\s*(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\s*\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([\da-f]{1,6});/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d{1,7});/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function detectImageContentType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return 'image/jpeg';
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

module.exports = {
  detectImageContentType,
  parseNotificationTarget,
  plainTextFromHtml,
  selectRecipients
};