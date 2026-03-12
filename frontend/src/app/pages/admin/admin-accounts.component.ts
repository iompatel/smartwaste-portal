import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { HireRequest, Ticket, User } from '../../models/types';
import { PortalService } from '../../services/portal.service';
import { RolePillComponent } from '../../shared/role-pill.component';
import { forkJoin, of } from 'rxjs';

type ManagedRole = 'user' | 'worker';

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RolePillComponent],
  templateUrl: './admin-accounts.component.html',
  styleUrl: './admin-accounts.component.scss',
})
export class AdminAccountsComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  users: User[] = [];
  tickets: Ticket[] = [];
  hireRequests: HireRequest[] = [];

  loading = true;
  saving = false;
  error = '';
  searchTerm = '';
  showCreatePassword = false;

  readonly managedRole: ManagedRole =
    this.route.snapshot.data['accountRole'] === 'worker' ? 'worker' : 'user';

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    gender: ['Other', [Validators.required]],
    mobile: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    address: ['', [Validators.required]],
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    const hireRequests$ =
      this.managedRole === 'worker' ? this.portalService.getHireRequests() : of([] as HireRequest[]);

    forkJoin({
      users: this.portalService.getUsers(),
      tickets: this.portalService.getTickets(),
      hireRequests: hireRequests$,
    }).subscribe({
      next: ({ users, tickets, hireRequests }) => {
        this.users = users;
        this.tickets = tickets;
        this.hireRequests = hireRequests;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load accounts.';
      },
    });
  }

  createAccount() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.portalService
      .createUser({
        ...this.form.getRawValue(),
        role: this.managedRole,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.form.reset({
            firstName: '',
            lastName: '',
            gender: 'Other',
            mobile: '',
            email: '',
            password: '',
            address: '',
          });
          this.loadData();
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message ?? `Unable to create ${this.singularLabel}.`;
        },
      });
  }

  updateRole(user: User, role: User['role']) {
    this.portalService.updateUser(user.id, { role }).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        this.error = err?.error?.message ?? 'Role update failed.';
      },
    });
  }

  deleteUser(user: User) {
    if (!confirm(`Delete ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    this.portalService.deleteUser(user.id).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        this.error = err?.error?.message ?? `Unable to delete ${this.singularLabel}.`;
      },
    });
  }

  ticketCountFor(user: User) {
    if (this.managedRole === 'worker') {
      return this.tickets.filter((ticket) => ticket.workerId === user.id).length;
    }

    return this.tickets.filter((ticket) => ticket.userId === user.id).length;
  }

  get accounts() {
    return this.users.filter((user) => user.role === this.managedRole);
  }

  get filteredAccounts() {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.accounts;
    }

    return this.accounts.filter((user) =>
      [
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.mobile,
        user.address,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }

  get linkedTicketCount() {
    const ids = new Set(this.accounts.map((user) => user.id));
    if (this.managedRole === 'worker') {
      return this.tickets.filter((ticket) => ticket.workerId !== null && ids.has(ticket.workerId)).length;
    }

    return this.tickets.filter((ticket) => ids.has(ticket.userId)).length;
  }

  get incompleteProfiles() {
    return this.accounts.filter((user) => {
      const mobile = String(user.mobile ?? '').trim();
      const address = String(user.address ?? '').trim().toLowerCase();
      return !mobile || /^0+$/.test(mobile) || !address || ['firebase auth user', 'google auth user'].includes(address);
    }).length;
  }

  hasActiveHireAssignments(worker: User) {
    if (this.managedRole !== 'worker') {
      return false;
    }
    return this.hireRequests.some(
      (request) => request.assignedWorkerId === worker.id && request.status === 'assigned',
    );
  }

  get pageTitle() {
    return this.managedRole === 'worker' ? 'Worker Management' : 'User Management';
  }

  get pageDescription() {
    return this.managedRole === 'worker'
      ? 'Manage field staff accounts, review linked tickets, and update worker access.'
      : 'Manage user accounts, review created ticket activity, and keep citizen records clean.';
  }

  get singularLabel() {
    return this.managedRole === 'worker' ? 'worker' : 'user';
  }

  get totalCountLabel() {
    return this.managedRole === 'worker' ? 'Total Workers' : 'Total Users';
  }

  get linkedTicketLabel() {
    return this.managedRole === 'worker' ? 'Assigned Tickets' : 'Created Tickets';
  }

  exportFilteredPdf() {
    const rows = this.filteredAccounts.map((u) => [
      u.id,
      `${u.firstName} ${u.lastName}`,
      u.email,
      u.mobile,
      u.address,
      new Date(u.createdAt).toLocaleString(),
    ]);

    const title =
      this.managedRole === 'worker' ? 'Worker Accounts Report' : 'User Accounts Report';

    const doc = new jsPDF();
    doc.text(`Smart Waste - ${title}`, 14, 14);

    autoTable(doc, {
      startY: 20,
      head: [['ID', 'Name', 'Email', 'Mobile', 'Address', 'Created']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 113, 227] },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 40 },
        2: { cellWidth: 48 },
        3: { cellWidth: 26 },
        4: { cellWidth: 50 },
      },
    });

    const filename = this.managedRole === 'worker' ? 'workers-report.pdf' : 'users-report.pdf';
    doc.save(filename);
  }

  exportUserPdf(user: User) {
    const doc = new jsPDF();
    const title = `${user.firstName} ${user.lastName}`.trim() || `User #${user.id}`;
    const isWorker = user.role === 'worker';

    const userTickets = isWorker
      ? this.tickets.filter((t) => t.workerId === user.id)
      : this.tickets.filter((t) => t.userId === user.id);
    const resolvedCount = isWorker
      ? userTickets.filter((t) => t.status === 'completed').length
      : null;

    doc.text(`Smart Waste - ${title}`, 14, 14);
    doc.text(`Role: ${user.role}`, 14, 22);
    doc.text(`Email: ${user.email}`, 14, 30);
    doc.text(`Mobile: ${user.mobile}`, 14, 38);
    doc.text(`Address: ${user.address}`, 14, 46);
    doc.text(`Created: ${new Date(user.createdAt).toLocaleString()}`, 14, 54);
    doc.text(`Total Tickets: ${userTickets.length}`, 14, 62);
    const tableStartY = isWorker ? 78 : 70;
    if (isWorker) {
      doc.text(`Resolved Tickets: ${resolvedCount}`, 14, 70);
    }

    if (userTickets.length) {
      autoTable(doc, {
        startY: tableStartY,
        head: [['Ticket', 'Waste', 'Status', 'Priority', 'Updated']],
        body: userTickets.map((t) => [
          t.ticketCode,
          t.wasteType,
          t.status,
          t.priority,
          new Date(t.updatedAt).toLocaleString(),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 113, 227] },
      });
    }

    doc.save(`user-${user.id}.pdf`);
  }
}
