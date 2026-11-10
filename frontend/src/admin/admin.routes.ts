import { Routes } from '@angular/router';

import { AdminActivityComponent } from '../app/pages/admin/admin-activity.component';
import { AdminBroadcastComponent } from '../app/pages/admin/admin-broadcast.component';
import { AdminPanelComponent } from '../app/pages/admin/admin-panel.component';
import { AdminLoginComponent } from '../app/pages/auth/admin-login.component';
import { HireRequestsComponent } from '../app/pages/hire/hire-requests.component';
import { ProfileComponent } from '../app/pages/profile/profile.component';
import { SettingsComponent } from '../app/pages/settings/settings.component';
import { TicketsComponent } from '../app/pages/tickets/tickets.component';
import { ShellComponent } from '../app/shell/shell.component';
import { privateAdminGuard } from './admin.guard';

export const adminRoutes: Routes = [
  { path: '', redirectTo: '/admin-console', pathMatch: 'full' },
  { path: 'admin-console', component: AdminLoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [privateAdminGuard],
    children: [
      { path: 'admin-panel', component: AdminPanelComponent },
      {
        path: 'admin-panel/users',
        loadComponent: () =>
          import('../app/pages/admin/admin-accounts.component').then(
            (module) => module.AdminAccountsComponent,
          ),
        data: { accountRole: 'user' },
      },
      {
        path: 'admin-panel/workers',
        loadComponent: () =>
          import('../app/pages/admin/admin-accounts.component').then(
            (module) => module.AdminAccountsComponent,
          ),
        data: { accountRole: 'worker' },
      },
      { path: 'tickets', component: TicketsComponent },
      { path: 'hire-worker', component: HireRequestsComponent },
      { path: 'broadcast-desk', component: AdminBroadcastComponent },
      { path: 'admin-activity', component: AdminActivityComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '/admin-console' },
];
