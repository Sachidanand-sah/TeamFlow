import { expect, test } from '@playwright/test';

// These flows do not need a database. Full register -> login -> logout coverage
// against a real API + Postgres comes once docker-compose runs in CI.

test.describe('auth screens', () => {
  test('a signed-out visitor is sent to the sign-in page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Sign in to TeamFlow' }),
    ).toBeVisible();
  });

  test('unknown routes fall back to sign-in for visitors', async ({ page }) => {
    await page.goto('/does-not-exist');

    // '**' redirects to '/', which requires sign-in.
    await expect(page).toHaveURL(/\/login/);
  });

  test('empty sign-in shows field errors without calling the API', async ({
    page,
  }) => {
    let loginCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) loginCalls++;
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    expect(loginCalls).toBe(0);
  });

  test('register enforces the shared password policy', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('Name').fill('Ann');
    await page.getByLabel('Email').fill('ann@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Use at least 12 characters')).toBeVisible();
  });

  test('wrong credentials show a generic error', async ({ page }) => {
    // Stub the API so the test does not depend on a running database.
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 401,
          message: 'Invalid email or password',
        }),
      }),
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill('ann@example.com');
    await page.getByLabel('Password').fill('not-my-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Invalid email or password.',
    );
  });
});
