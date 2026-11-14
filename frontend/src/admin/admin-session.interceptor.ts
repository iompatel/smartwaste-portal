import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { ADMIN_CSRF_KEY, ADMIN_USER_KEY } from './admin.constants';

export const adminSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !request.url.endsWith('/auth/admin-login')) {
        sessionStorage.removeItem(ADMIN_CSRF_KEY);
        sessionStorage.removeItem(ADMIN_USER_KEY);
        void router.navigate(['/admin-console']);
      }
      return throwError(() => error);
    }),
  );
};
