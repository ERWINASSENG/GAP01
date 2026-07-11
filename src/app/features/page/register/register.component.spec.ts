import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['register']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form', () => {
    expect(component.registerForm.valid).toBeFalse();
  });

  it('should validate form constraints', () => {
    const displayNameControl = component.registerForm.get('displayName');
    const emailControl = component.registerForm.get('email');
    const passwordControl = component.registerForm.get('password');

    displayNameControl?.setValue('Jean Dupont');
    emailControl?.setValue('jean@port.gov');
    passwordControl?.setValue('123'); // Trop court
    expect(component.registerForm.valid).toBeFalse();

    passwordControl?.setValue('123456'); // Correct
    expect(component.registerForm.valid).toBeTrue();
  });
});
