import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let auth: { login: jest.Mock };
  let returnUrl: string | null;

  beforeEach(async () => {
    auth = { login: jest.fn() };
    returnUrl = null;

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}),
            },
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function fill(email: string, password: string): void {
    const emailInput = el().querySelector<HTMLInputElement>('#email');
    const passwordInput = el().querySelector<HTMLInputElement>('#password');
    if (!emailInput || !passwordInput) throw new Error('inputs not rendered');
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    el().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('shows validation errors and does not call the API for an empty form', () => {
    submit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Email is required');
    expect(el().textContent).toContain('Password is required');
  });

  it('signs in and navigates home', () => {
    auth.login.mockReturnValue(of({ id: 'user-1' }));
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    fill('ann@example.com', 'secret-password');
    submit();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'ann@example.com',
      password: 'secret-password',
    });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows a generic message for wrong credentials', () => {
    auth.login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );

    fill('ann@example.com', 'wrong-password');
    submit();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password.',
    );
  });

  it('tells the user to slow down when rate limited', () => {
    auth.login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429 })),
    );

    fill('ann@example.com', 'any-password');
    submit();

    expect(el().textContent).toContain('Too many attempts');
  });
});
