import { Routes } from '@angular/router';

import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { AdminActivityComponent } from './pages/admin/admin-activity.component';
import { AdminBroadcastComponent } from './pages/admin/admin-broadcast.component';
import { AdminPanelComponent } from './pages/admin/admin-panel.component';
import { ForgotPasswordComponent } from './pages/auth/forgot-password.component';
import { LoginComponent } from './pages/auth/login.component';
import { SignupComponent } from './pages/auth/signup.component';
import { DashboardEntryComponent } from './pages/dashboard/dashboard-entry.component';
import { HireRequestsComponent } from './pages/hire/hire-requests.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { TicketsComponent } from './pages/tickets/tickets.component';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin-console',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/auth/admin-login.component').then((module) => module.AdminLoginComponent),
  },
  {
    path: 'worker-console',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/auth/worker-login.component').then((module) => module.WorkerLoginComponent),
  },
  { path: 'signup', component: SignupComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardEntryComponent },
      { path: 'tickets', component: TicketsComponent },
      { path: 'hire-worker', component: HireRequestsComponent },
      { path: 'broadcast-desk', component: AdminBroadcastComponent, canActivate: [adminGuard] },
      { path: 'admin-activity', component: AdminActivityComponent, canActivate: [adminGuard] },
      { path: 'profile', component: ProfileComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'admin-panel', component: AdminPanelComponent, canActivate: [adminGuard] },
      {
        path: 'admin-panel/users',
        loadComponent: () =>
          import('./pages/admin/admin-accounts.component').then(
            (module) => module.AdminAccountsComponent,
          ),
        canActivate: [adminGuard],
        data: { accountRole: 'user' },
      },
      {
        path: 'admin-panel/workers',
        loadComponent: () =>
          import('./pages/admin/admin-accounts.component').then(
            (module) => module.AdminAccountsComponent,
          ),
        canActivate: [adminGuard],
        data: { accountRole: 'worker' },
      },
      // Preserve old deep links while keeping /admin-console as a separate login page.
      { path: 'admin-console/users', redirectTo: 'admin-panel/users', pathMatch: 'full' },
      { path: 'admin-console/workers', redirectTo: 'admin-panel/workers', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/login' },
];
