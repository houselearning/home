const LANGUAGE_NAMES = Object.freeze({
  en: 'English',
  es: 'Spanish',
  tr: 'Turkish',
  pt: 'Portuguese'
});

function responseLanguageInstruction(value) {
  const requested = String(value || 'en').trim().toLowerCase().split(/[-_]/)[0];
  const language = LANGUAGE_NAMES[requested] || LANGUAGE_NAMES.en;
  return `Respond in ${language} unless the student explicitly asks for a different language.`;
}

module.exports = { responseLanguageInstruction };