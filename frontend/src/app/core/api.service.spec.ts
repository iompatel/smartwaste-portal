import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiService } from './api.service';
import { isClosedStatus } from '../smartwaste/data';

describe('API-to-UI mappings', () => {
  const service = new ApiService();

  it('keeps cancelled tickets distinct from completed tickets', () => {
    const ticket = service.mapTicketToUi({
      id: 1,
      ticketCode: 'SWM-000001',
      userId: 1,
      wasteType: 'Mixed waste',
      description: 'Cancelled report',
      locationAddress: '1 Main Street',
      status: 'cancelled',
      priority: 'medium',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(ticket.status).toBe('Cancelled');
    expect(isClosedStatus(ticket.status)).toBe(true);
  });

  it('does not invent a price for hire requests', () => {
    const booking = service.mapHireToUi({
      id: 1,
      requestCode: 'HIRE-0001',
      userId: 1,
      requesterName: 'Alex Morgan',
      requesterMobile: '9999999999',
      requesterEmail: 'alex@example.test',
      requesterAddress: '1 Main Street',
      title: 'Home cleaning',
      purpose: 'Cleaning',
      workAddress: '1 Main Street',
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(booking.status).toBe('Cancelled');
    expect(booking).not.toHaveProperty('price');
  });
});

describe('authenticated PDF downloads', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('sends session credentials and returns the PDF blob', async () => {
    const service = new ApiService();
    vi.spyOn(service, 'getCsrf').mockReturnValue('test-csrf');
    vi.spyOn(service, 'getToken').mockReturnValue(null);
    const fetchMock = vi.fn().mockResolvedValue(new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchMock);
    const blob = await service.requestBlob('/api/admin/reports/workers');
    expect(await blob.text()).toBe('%PDF-1.7');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/reports/workers', expect.objectContaining({
      credentials: 'include', cache: 'no-store', headers: expect.objectContaining({ 'X-Admin-CSRF': 'test-csrf' }),
    }));
  });

  it('rejects SPA rewrites instead of downloading HTML as a report', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>App</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(new ApiService().requestBlob('/api/admin/reports/users')).rejects.toThrow('unexpected response');
  });
});
