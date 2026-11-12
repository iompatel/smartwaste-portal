import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthenticatedRequest = request.headers.has('Authorization');

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isAuthenticatedRequest && error.status === 401) {
        const loginPath = auth.loginPathForRole();
        auth.clearSession();
        if (!router.url.startsWith(loginPath)) {
          void router.navigate([loginPath]);
        }
      }
      return throwError(() => error);
    }),
  );
};
