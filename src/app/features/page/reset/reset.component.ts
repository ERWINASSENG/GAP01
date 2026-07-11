import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reset',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset.component.html',
  styleUrl: './reset.component.scss'
})
export class ResetComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly mode = signal<'request' | 'update'>('request');

  readonly requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly updateForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      const hasRecoveryToken = url.includes('type=recovery') || url.includes('access_token=') || this.router.url.includes('reset-password');
      if (hasRecoveryToken) {
        this.mode.set('update');
      } else {
        this.mode.set('request');
      }
    }
  }

  setMode(newMode: 'request' | 'update'): void {
    this.mode.set(newMode);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) return null;

    return password.value === confirmPassword.value ? null : { mismatch: true };
  }

  async onRequestSubmit(): Promise<void> {
    if (this.requestForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const email = this.requestForm.value.email ?? '';
    const res = await this.authService.resetPassword(email);
    this.isLoading.set(false);

    if (res.success) {
      this.successMessage.set('Un e-mail de réinitialisation de mot de passe a été envoyé. Veuillez vérifier votre boîte de réception.');
      this.requestForm.reset();
    } else {
      this.errorMessage.set(res.error || "Une erreur est survenue lors de l'envoi du lien de récupération.");
    }
  }

  async onUpdateSubmit(): Promise<void> {
    if (this.updateForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const password = this.updateForm.value.password ?? '';
    const res = await this.authService.updatePassword(password);
    this.isLoading.set(false);

    if (res.success) {
      this.successMessage.set('Votre mot de passe a été mis à jour avec succès ! Vous allez être redirigé vers la page de connexion.');
      this.updateForm.reset();
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3500);
    } else {
      this.errorMessage.set(res.error || "Une erreur est survenue lors de la mise à jour de votre mot de passe.");
    }
  }
}
