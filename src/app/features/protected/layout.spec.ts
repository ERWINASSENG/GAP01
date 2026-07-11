import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProtectedLayout } from './layout';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../core/services/auth.service';
import { signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

describe('ProtectedLayout', () => {
  let component: ProtectedLayout;
  let fixture: ComponentFixture<ProtectedLayout>;
  let authServiceMock: { currentUser: ReturnType<typeof signal>; logout: jasmine.Spy };
  let routerMock: { navigate: jasmine.Spy };

  beforeEach(async () => {
    authServiceMock = {
      currentUser: signal({
        id: 'usr-1',
        email: 'admin@port.gov',
        username: 'admin_port',
        displayName: 'Directrice Générale',
        role: 'admin',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
        assignedSiteId: 'site-1',
        assignedSiteName: 'Terminal à Conteneurs A'
      }),
      logout: jasmine.createSpy('logout')
    };

    routerMock = {
      navigate: jasmine.createSpy('navigate')
    };

    await TestBed.configureTestingModule({
      imports: [ProtectedLayout, RouterTestingModule, MatIconModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProtectedLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the layout component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle sidebar status', () => {
    expect(component.isSidebarOpen()).toBeFalse();
    component.toggleSidebar();
    expect(component.isSidebarOpen()).toBeTrue();
    component.closeSidebar();
    expect(component.isSidebarOpen()).toBeFalse();
  });

  it('should logout and redirect to login', () => {
    component.onLogout();
    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
  });
});
