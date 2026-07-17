import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../../core/services/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly sites = ['SCMC', 'TUSCANI', 'AFISA', 'AUTRE'];

  readonly registerForm = this.fb.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['user', [Validators.required]],
    assignedSiteName: ['']
  });

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const displayName = this.registerForm.value.displayName ?? '';
    const email = this.registerForm.value.email ?? '';
    const password = this.registerForm.value.password ?? '';
    const role = (this.registerForm.value.role as 'admin' | 'user') ?? 'user';
    const assignedSiteName = this.registerForm.value.assignedSiteName ?? undefined;

    const res = await this.authService.register(email, password, displayName, role, assignedSiteName);
    this.isLoading.set(false);

    if (res.success) {
      this.successMessage.set('Compte de collaborateur créé avec succès dans Supabase !');
      this.registerForm.reset({ role: 'user', assignedSiteName: '' });
      setTimeout(() => {
        this.successMessage.set('');
      }, 6000);
    } else {
      this.errorMessage.set(res.error || "Une erreur est survenue lors de l'inscription.");
    }
  }
}
