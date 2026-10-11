import { HttpErrorResponse } from '@angular/common/http';

/** Turns an API error into a message that is safe and useful to show to the user. */
export function httpErrorMessage(
  error: unknown,
  overrides: Partial<Record<number, string>> = {},
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Please try again.';
  }
  const override = overrides[error.status];
  if (override) {
    return override;
  }
  switch (error.status) {
    case 0:
      return 'Cannot reach the server. Check your connection.';
    case 429:
      return 'Too many attempts. Please wait a minute and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
