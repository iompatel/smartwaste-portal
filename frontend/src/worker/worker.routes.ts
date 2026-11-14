import { Routes } from '@angular/router';

import { DashboardComponent } from '../app/pages/dashboard/dashboard.component';
import { HireRequestsComponent } from '../app/pages/hire/hire-requests.component';
import { ProfileComponent } from '../app/pages/profile/profile.component';
import { SettingsComponent } from '../app/pages/settings/settings.component';
import { TicketsComponent } from '../app/pages/tickets/tickets.component';
import { ShellComponent } from '../app/shell/shell.component';
import { workerGuard } from './worker.guard';
import { WorkerLoginComponent } from './worker-login.component';

export const workerRoutes: Routes = [
  { path: '', redirectTo: '/worker-console', pathMatch: 'full' },
  { path: 'worker-console', component: WorkerLoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [workerGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'tickets', component: TicketsComponent },
      { path: 'hire-worker', component: HireRequestsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '/worker-console' },
];
