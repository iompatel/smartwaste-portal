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

  it('wakes a sleeping admin backend and retries a PDF download once', async () => {
    const service = new ApiService();
    (service as any).apiWakeUrl = 'https://admin-backend.example.test/api/ready';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Too Many Requests', {
        status: 429,
        headers: { 'X-Render-Routing': 'hibernate-rate-limited' },
      }))
      .mockResolvedValueOnce(new Response('{"status":"ready"}', {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('%PDF-1.7', {
        headers: { 'Content-Type': 'application/pdf' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const blob = await service.requestBlob('/api/admin/reports/users');

    expect(await blob.text()).toBe('%PDF-1.7');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://admin-backend.example.test/api/ready', expect.objectContaining({
      credentials: 'omit', cache: 'no-store', signal: expect.any(AbortSignal),
    }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('admin backend cold starts', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('wakes Render and retries the original JSON request once', async () => {
    const service = new ApiService();
    (service as any).apiWakeUrl = 'https://admin-backend.example.test/api/ready';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Too Many Requests', {
        status: 429,
        headers: { 'X-Render-Routing': 'hibernate-rate-limited' },
      }))
      .mockResolvedValueOnce(new Response('{"status":"ready"}', {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('{"totalUsers":3}', {
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.request<{ totalUsers: number }>('/api/dashboard/summary')).resolves.toEqual({ totalUsers: 3 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://admin-backend.example.test/api/ready', expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', signal: expect.any(AbortSignal),
    }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not wake the backend for application rate limits', async () => {
    const service = new ApiService();
    (service as any).apiWakeUrl = 'https://admin-backend.example.test/api/ready';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"Please wait."}', {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.request('/api/auth/admin-login')).rejects.toThrow('Please wait.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports that the backend is still waking if the retry is also hibernating', async () => {
    const service = new ApiService();
    (service as any).apiWakeUrl = 'https://admin-backend.example.test/api/ready';
    const sleepingResponse = () => new Response('Too Many Requests', {
      status: 429,
      headers: { 'X-Render-Routing': 'hibernate-rate-limited' },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sleepingResponse())
      .mockResolvedValueOnce(new Response('{"status":"ready"}', {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(sleepingResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.request('/api/dashboard/summary')).rejects.toThrow('still waking up');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
