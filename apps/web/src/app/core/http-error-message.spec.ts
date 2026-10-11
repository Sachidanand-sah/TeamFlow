import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage } from './http-error-message';

describe('httpErrorMessage', () => {
  it('prefers a status-specific override', () => {
    const error = new HttpErrorResponse({ status: 409 });

    expect(httpErrorMessage(error, { 409: 'Taken' })).toBe('Taken');
  });

  it('explains network failures (status 0)', () => {
    expect(httpErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain(
      'Cannot reach the server',
    );
  });

  it('explains rate limiting', () => {
    expect(httpErrorMessage(new HttpErrorResponse({ status: 429 }))).toContain(
      'Too many attempts',
    );
  });

  it('falls back to a generic message without leaking server details', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { message: 'relation "users" does not exist' },
    });

    expect(httpErrorMessage(error)).toBe(
      'Something went wrong. Please try again.',
    );
    expect(httpErrorMessage(new Error('boom'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
