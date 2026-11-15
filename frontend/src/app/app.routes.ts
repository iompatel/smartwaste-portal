import { Routes } from '@angular/router';
import { SmartWastePortalComponent } from './smartwaste/smartwaste-portal.component';

export const routes: Routes = [
  { path: '', component: SmartWastePortalComponent },
  { path: 'login', component: SmartWastePortalComponent },
  { path: 'signup', component: SmartWastePortalComponent },
  { path: 'dashboard', component: SmartWastePortalComponent },
  { path: 'tickets', component: SmartWastePortalComponent },
  { path: 'hire', component: SmartWastePortalComponent },
  { path: 'profile', component: SmartWastePortalComponent },
  { path: 'settings', component: SmartWastePortalComponent },
  { path: 'worker-console', component: SmartWastePortalComponent },
  { path: 'worker', component: SmartWastePortalComponent },
  { path: 'admin-console', component: SmartWastePortalComponent },
  { path: 'admin', component: SmartWastePortalComponent },
  { path: '**', redirectTo: '' },
];
