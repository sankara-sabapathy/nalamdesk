import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'patients', loadComponent: () => import('./patients/patient-list/patient-list.component').then(m => m.PatientListComponent) },
    { path: 'visit/:id', loadComponent: () => import('./visits/visit/visit.component').then(m => m.VisitComponent) },
    { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) }
];
