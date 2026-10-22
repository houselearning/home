const PREFERENCE_KEY = 'houselearning-theme-mode';
const THEME_OPTIONS = [
  ['auto', 'Automatic'],
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['independence-day', 'Independence Day'],
  ['halloween', 'Halloween'],
  ['winter-holiday', 'Winter holiday'],
  ['new-year', 'New Year']
];

export function resolveCalendarTheme(mode, systemIsDark, month, day) {
  if (mode !== 'auto') return mode;
  if (month === 6 && day === 4) return 'independence-day';
  if (month === 9 && day === 31) return 'halloween';
  if (month === 11 && day >= 24 && day <= 26) return 'winter-holiday';
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) return 'new-year';
  return systemIsDark ? 'dark' : 'light';
}

function readPreference() {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (THEME_OPTIONS.some(([value]) => value === saved)) return saved;
    const legacy = localStorage.getItem('coolmathtime_theme') || localStorage.getItem('theme');
    return ['light', 'dark', 'auto'].includes(legacy) ? legacy : 'auto';
  } catch (_error) {
    return 'auto';
  }
}

function savePreference(value) {
  try {
    localStorage.setItem(PREFERENCE_KEY, value);
  } catch (_error) {
    return;
  }
}

function createThemeControl(currentMode, onChange) {
  const container = document.createElement('div');
  container.className = 'hl-theme-control';

  const label = document.createElement('label');
  label.htmlFor = 'hl-theme-mode';
  label.textContent = 'Theme';

  const select = document.createElement('select');
  select.id = 'hl-theme-mode';
  select.setAttribute('aria-label', 'Choose appearance or holiday theme');
  for (const [value, text] of THEME_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
  select.value = currentMode;
  select.addEventListener('change', () => onChange(select.value));
  container.append(label, select);
  document.body.appendChild(container);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const themeStylesheet = new URL('./calendar-theme.css', import.meta.url).href;
  const stylesheetExists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(link => new URL(link.href, document.baseURI).href === themeStylesheet);
  if (!stylesheetExists) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = themeStylesheet;
    document.head.appendChild(link);
  }

  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = readPreference();

  function applyTheme() {
    const now = new Date();
    const theme = resolveCalendarTheme(mode, systemPreference.matches, now.getMonth(), now.getDate());
    document.body.dataset.hlTheme = theme;
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }

  function changeMode(nextMode) {
    mode = nextMode;
    savePreference(mode);
    applyTheme();
  }

  function initializeTheme() {
    document.querySelectorAll('.theme-switch-wrapper').forEach(element => element.remove());
    createThemeControl(mode, changeMode);
    applyTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme, { once: true });
  } else {
    initializeTheme();
  }

  const updateSystemTheme = () => {
    if (mode === 'auto') applyTheme();
  };
  if (typeof systemPreference.addEventListener === 'function') {
    systemPreference.addEventListener('change', updateSystemTheme);
  } else if (typeof systemPreference.addListener === 'function') {
    systemPreference.addListener(updateSystemTheme);
  }
}