import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../../../core/services/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
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

  readonly registerForm = this.fb.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['user', [Validators.required]]
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

    const res = await this.authService.register(email, password, displayName, role);
    this.isLoading.set(false);

    if (res.success) {
      if (res.isLocal) {
        this.successMessage.set('Compte créé avec succès en mode local (pas de validation e-mail requise) ! Vous allez être redirigé vers la page de connexion.');
      } else {
        this.successMessage.set('Compte créé avec succès ! Un e-mail de confirmation peut être envoyé selon vos paramètres Supabase. Vous allez être redirigé vers la page de connexion.');
      }
      this.registerForm.reset({ role: 'user' });
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3500);
    } else {
      this.errorMessage.set(res.error || "Une erreur est survenue lors de l'inscription.");
    }
  }
}
