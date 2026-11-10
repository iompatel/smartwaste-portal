import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { ForgotPasswordComponent } from './pages/auth/forgot-password.component';
import { LoginComponent } from './pages/auth/login.component';
import { SignupComponent } from './pages/auth/signup.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HireRequestsComponent } from './pages/hire/hire-requests.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { TicketsComponent } from './pages/tickets/tickets.component';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
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
      { path: 'dashboard', component: DashboardComponent },
      { path: 'tickets', component: TicketsComponent },
      { path: 'hire-worker', component: HireRequestsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '/login' },
];
