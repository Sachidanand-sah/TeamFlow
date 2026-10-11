import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@teamflow/shared';
import { ButtonComponent, FormFieldComponent } from '@teamflow/ui';
import { safeReturnUrl } from '../../../core/auth/auth.guards';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http-error-message';

/** Smart component: owns the form state and talks to AuthService. */
@Component({
  selector: 'tf-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
  ],
  templateUrl: './login.page.html',
  styleUrl: '../auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(EMAIL_MAX_LENGTH),
      ],
    ],
    password: [
      '',
      [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)],
    ],
  });
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected fieldError(name: 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return name === 'email' ? 'Email is required' : 'Password is required';
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address';
    }
    return 'Value is too long';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(safeReturnUrl(returnUrl));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverError.set(
          httpErrorMessage(error, { 401: 'Invalid email or password.' }),
        );
      },
    });
  }
}
