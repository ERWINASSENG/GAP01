import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../../../core/services/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''] // Facultatif pour les comptes démo
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const email = this.loginForm.value.email ?? '';
    const password = this.loginForm.value.password ?? '';
    
    // Simulation réseau ultra-rapide et fluide
    setTimeout(async () => {
      const res = await this.authService.login(email, password || undefined);
      this.isLoading.set(false);

      if (res.success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage.set(res.error || 'Utilisateur introuvable avec cette adresse email. Utilisez les profils rapides ci-dessous.');
      }
    }, 600);
  }

  useDemoAccount(email: string): void {
    this.loginForm.patchValue({ email, password: 'demouser123' });
    this.onSubmit();
  }
}
