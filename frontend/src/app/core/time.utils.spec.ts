import { formatTimeAgo } from './time.utils';

describe('formatTimeAgo', () => {
  const baseTime = 1700000000000;

  it('returns empty string for null, undefined, or invalid dates', () => {
    expect(formatTimeAgo(null)).toBe('');
    expect(formatTimeAgo(undefined)).toBe('');
    expect(formatTimeAgo('invalid-date')).toBe('');
  });

  it('returns "Just now" for dates less than 10 seconds ago', () => {
    const recent = new Date(baseTime - 5000);
    expect(formatTimeAgo(recent, baseTime)).toBe('Just now');
  });

  it('returns seconds ago for dates under 1 minute', () => {
    const fortyFiveSec = new Date(baseTime - 45000);
    expect(formatTimeAgo(fortyFiveSec, baseTime)).toBe('45s ago');
  });

  it('returns minutes ago for dates under 1 hour', () => {
    const tenMin = new Date(baseTime - 10 * 60 * 1000);
    expect(formatTimeAgo(tenMin, baseTime)).toBe('10m ago');
  });

  it('returns hours ago for dates under 24 hours', () => {
    const twoHours = new Date(baseTime - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(twoHours, baseTime)).toBe('2h ago');
  });

  it('returns "Yesterday" for dates between 24 and 48 hours ago', () => {
    const oneDay = new Date(baseTime - 25 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneDay, baseTime)).toBe('Yesterday');
  });
});
