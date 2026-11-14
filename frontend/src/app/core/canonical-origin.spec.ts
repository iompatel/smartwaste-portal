import { canonicalRedirectUrl } from './canonical-origin';

describe('canonicalRedirectUrl', () => {
  it('moves a Render URL to the custom origin and preserves route state', () => {
    expect(
      canonicalRedirectUrl(
        'https://smartwaste-worker.onrender.com/worker-console?returnUrl=%2Fdashboard#login',
        'smartwaste-worker.onrender.com',
        'https://worker.smartwaste.dpdns.org',
      ),
    ).toBe(
      'https://worker.smartwaste.dpdns.org/worker-console?returnUrl=%2Fdashboard#login',
    );
  });

  it('does not redirect local or unrelated hosts', () => {
    expect(
      canonicalRedirectUrl(
        'http://localhost:4400/worker-console',
        'smartwaste-worker.onrender.com',
        'https://worker.smartwaste.dpdns.org',
      ),
    ).toBeNull();
  });

  it('rejects malformed or non-HTTPS canonical origins', () => {
    expect(canonicalRedirectUrl('not a url', 'example.com', 'https://safe.example')).toBeNull();
    expect(
      canonicalRedirectUrl('https://example.com', 'example.com', 'http://unsafe.example'),
    ).toBeNull();
  });
});
