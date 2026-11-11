import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

import { AuthService } from '../app/services/auth.service';

export function hasWorkerSession(auth: Pick<AuthService, 'currentUser' | 'isAuthenticated'>) {
  return auth.isAuthenticated && auth.currentUser?.role === 'worker';
}

export const workerGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return hasWorkerSession(auth)
    ? true
    : router.createUrlTree(['/worker-console'], { queryParams: { returnUrl: state.url } });
};
