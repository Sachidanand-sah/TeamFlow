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
import { Router, RouterLink } from '@angular/router';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@teamflow/shared';
import {
  ButtonComponent,
  FormFieldComponent,
  IconComponent,
} from '@teamflow/ui';
import { AuthLayout } from '../auth-layout';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http-error-message';

type Field = 'name' | 'email' | 'password';

@Component({
  selector: 'tf-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    AuthLayout,
  ],
  templateUrl: './register.page.html',
  styleUrl: '../auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  // Same limits as the API DTO (both come from @teamflow/shared), so the user sees
  // problems before submitting. The API still validates: client checks are UX only.
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
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
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
  });
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected fieldError(name: Field): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required';
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address';
    }
    if (control.hasError('minlength')) {
      return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
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

    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverError.set(
          httpErrorMessage(error, {
            409: 'An account with this email already exists.',
            400: 'Please check the form and try again.',
          }),
        );
      },
    });
  }
}
