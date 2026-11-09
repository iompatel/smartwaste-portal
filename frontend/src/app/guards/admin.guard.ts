import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated) {
    return router.createUrlTree(['/admin-console'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.currentUser?.role !== 'admin') {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
