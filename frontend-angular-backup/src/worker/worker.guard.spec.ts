import { User } from '../app/models/types';
import { hasWorkerSession } from './worker.guard';

const user = (role: User['role']) => ({ role }) as User;

describe('hasWorkerSession', () => {
  it('accepts only an authenticated worker', () => {
    expect(hasWorkerSession({ isAuthenticated: true, currentUser: user('worker') })).toBeTrue();
    expect(hasWorkerSession({ isAuthenticated: true, currentUser: user('user') })).toBeFalse();
    expect(hasWorkerSession({ isAuthenticated: false, currentUser: user('worker') })).toBeFalse();
  });
});
