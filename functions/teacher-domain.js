const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function normalizeClassInput(input) {
  requireObject(input, 'Class');
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  if (name.length < 3 || name.length > 80) throw new Error('Class name must be 3 to 80 characters.');
  if (description.length > 1000) throw new Error('Class description must be at most 1000 characters.');
  return { name, description };
}

function normalizeJoinCode(input) {
  const code = String(input || '').trim().toUpperCase();
  if (!JOIN_CODE_PATTERN.test(code)) throw new Error('Enter a valid six-character class code.');
  return code;
}

function normalizeCoTeacherEmails(input) {
  if (!Array.isArray(input)) throw new Error('Co-teacher emails must be a list.');
  const emails = [...new Set(input.map(value => String(value || '').trim().toLowerCase()).filter(Boolean))];
  if (emails.length > 5) throw new Error('A class can have at most five co-teachers.');
  if (emails.some(email => email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Enter valid email addresses for co-teachers.');
  }
  return emails;
}

function isValidUserId(value) {
  return USER_ID_PATTERN.test(String(value || ''));
}

function hasTeacherAccess(token, isAdmin) {
  return Boolean(token && (token.role === 'teacher' || isAdmin === true));
}

module.exports = {
  hasTeacherAccess,
  isValidUserId,
  normalizeClassInput,
  normalizeCoTeacherEmails,
  normalizeJoinCode
};