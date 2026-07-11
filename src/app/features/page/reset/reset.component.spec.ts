import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { ResetComponent } from './reset.component';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { provideRouter, RouterLink } from '@angular/router';

describe('ResetComponent', () => {
  let component: ResetComponent;
  let fixture: ComponentFixture<ResetComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['resetPassword', 'updatePassword']);
    const rotSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ResetComponent, ReactiveFormsModule, RouterLink],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: rotSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResetComponent);
    component = fixture.componentInstance;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.requestForm.get('email');
    expect(emailControl?.valid).toBeFalsy();

    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTruthy();

    emailControl?.setValue('john.doe@port.gov');
    expect(emailControl?.valid).toBeTruthy();
  });

  it('should require a minimum length for password', () => {
    const passwordControl = component.updateForm.get('password');
    expect(passwordControl?.valid).toBeFalsy();

    passwordControl?.setValue('123');
    expect(passwordControl?.hasError('minlength')).toBeTruthy();

    passwordControl?.setValue('123456');
    expect(passwordControl?.valid).toBeTruthy();
  });

  it('should check if passwords match', () => {
    const passwordControl = component.updateForm.get('password');
    const confirmPasswordControl = component.updateForm.get('confirmPassword');

    passwordControl?.setValue('password123');
    confirmPasswordControl?.setValue('different123');

    expect(component.updateForm.errors?.['mismatch']).toBeTruthy();

    confirmPasswordControl?.setValue('password123');
    expect(component.updateForm.errors).toBeNull();
  });

  it('should call resetPassword on request submit', async () => {
    authServiceSpy.resetPassword.and.returnValue(Promise.resolve({ success: true }));

    component.requestForm.get('email')?.setValue('john.doe@port.gov');
    await component.onRequestSubmit();

    expect(authServiceSpy.resetPassword).toHaveBeenCalledWith('john.doe@port.gov');
    expect(component.successMessage()).toBe('Un e-mail de réinitialisation de mot de passe a été envoyé. Veuillez vérifier votre boîte de réception.');
  });

  it('should call updatePassword on update submit and navigate to login', fakeAsync(() => {
    authServiceSpy.updatePassword.and.returnValue(Promise.resolve({ success: true }));

    component.updateForm.get('password')?.setValue('newpassword123');
    component.updateForm.get('confirmPassword')?.setValue('newpassword123');

    component.onUpdateSubmit();
    tick();

    expect(authServiceSpy.updatePassword).toHaveBeenCalledWith('newpassword123');
    expect(component.successMessage()).toContain('Votre mot de passe a été mis à jour avec succès');

    tick(3500);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  }));
});
