import { storedTheme } from './theme.service';

describe('storedTheme', () => {
  it('accepts dark and falls back safely for invalid storage', () => {
    expect(storedTheme('dark')).toBe('dark');
    expect(storedTheme('light')).toBe('light');
    expect(storedTheme('unexpected')).toBe('light');
    expect(storedTheme(null)).toBe('light');
  });
});
