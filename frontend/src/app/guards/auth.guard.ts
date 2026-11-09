import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }

  const adminRoute = /^\/(admin-panel(?:\/|$)|admin-console\/|admin-activity(?:\/|$)|broadcast-desk(?:\/|$))/.test(
    state.url,
  );

  return router.createUrlTree([adminRoute ? '/admin-console' : '/login'], {
    queryParams: { returnUrl: state.url },
  });
};
