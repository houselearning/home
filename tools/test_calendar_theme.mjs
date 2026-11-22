import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCalendarTheme } from '../calendar-theme.mjs';

test('automatic mode selects the July 4 theme on July 4', () => {
  assert.equal(resolveCalendarTheme('auto', false, 6, 4), 'independence-day');
});

test('automatic mode selects seasonal holidays and follows system theme otherwise', () => {
  assert.equal(resolveCalendarTheme('auto', false, 9, 31), 'halloween');
  assert.equal(resolveCalendarTheme('auto', false, 11, 25), 'winter-holiday');
  assert.equal(resolveCalendarTheme('auto', false, 0, 1), 'new-year');
  assert.equal(resolveCalendarTheme('auto', true, 2, 18), 'dark');
  assert.equal(resolveCalendarTheme('auto', false, 2, 18), 'light');
});

test('manual theme choice overrides calendar and system defaults', () => {
  assert.equal(resolveCalendarTheme('independence-day', true, 0, 1), 'independence-day');
  assert.equal(resolveCalendarTheme('light', true, 11, 25), 'light');
});