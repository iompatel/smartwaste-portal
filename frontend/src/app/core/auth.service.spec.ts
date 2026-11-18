import { describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { ApiService } from './api.service';

function makeApi(request: (...args: any[]) => Promise<any>) {
  const requestMock = vi.fn(request);
  const api = {
    request: requestMock,
    getStoredUser: () => null,
    getStoredRole: () => null,
    getToken: () => null,
    getCsrf: () => null,
    setToken: vi.fn(),
    setCsrf: vi.fn(),
    setStoredUser: vi.fn(),
    setStoredRole: vi.fn(),
  } as unknown as ApiService;
  return { api, requestMock };
}

const worker = {
  id: 7,
  firstName: 'Field',
  lastName: 'Worker',
  email: 'worker@example.test',
  role: 'worker' as const,
  address: 'Depot',
  mobile: '9999999999',
};

describe('worker credential login', () => {
  it('stores the returned worker profile instead of inventing a fallback', async () => {
    const { api } = makeApi(async () => ({ token: 'signed-token', user: worker, worker }));
    const auth = new AuthService(api);

    await expect(auth.login('worker', 'worker@example.test', 'secret')).resolves.toMatchObject({
      id: 7,
      role: 'worker',
    });
    expect(auth.currentRole()).toBe('worker');
  });

  it('retries a network failure against the real API origin once', async () => {
    const { api, requestMock } = makeApi(
      vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ token: 'signed-token', user: worker, worker }),
    );
    const auth = new AuthService(api);

    await expect(auth.login('worker', 'worker@example.test', 'secret')).resolves.toMatchObject({ id: 7 });
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock.mock.calls[1][0]).toBe('/api/auth/worker-login');
  }, 10_000);

  it('reports an unreachable sign-in service instead of claiming success', async () => {
    const { api } = makeApi(async () => {
      throw new TypeError('Failed to fetch');
    });
    const auth = new AuthService(api);

    await expect(auth.login('worker', 'worker@example.test', 'secret'))
      .rejects.toThrow(/Could not reach the sign-in service/);
    expect(auth.currentUser()).toBeNull();
  }, 10_000);
});
