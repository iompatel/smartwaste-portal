import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { map } from 'rxjs';

import { AdminAuthService } from './admin-auth.service';

export const privateAdminGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  return auth.validateSession().pipe(
    map((valid) =>
      valid
        ? true
        : router.createUrlTree(['/admin-console'], { queryParams: { returnUrl: state.url } }),
    ),
  );
};
