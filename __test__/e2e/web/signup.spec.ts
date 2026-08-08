import { expect, test } from '@playwright/test';

// WEBTEST-05: browser navigation to /signin and /signup asserts the forms render.
// WEBTEST-07: submitting the signup form shows feedback.

test.describe('signin page (WEBTEST-05)', () => {
    test('renders the signin form with email and password', async ({ page }) => {
        await page.goto('/signin');

        await expect(page.getByRole('heading', { name: /good to see you again/i })).toBeVisible();
        await expect(page.getByLabel('email address')).toBeVisible();
        await expect(page.getByLabel('password')).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('renders a link to create an account', async ({ page }) => {
        await page.goto('/signin');

        await expect(page.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/signup');
    });
});

test.describe('signup page (WEBTEST-05, WEBTEST-07)', () => {
    test('renders the signup form with all fields', async ({ page }) => {
        await page.goto('/signup');

        await expect(page.getByRole('heading', { name: /a steadier day starts here/i })).toBeVisible();
        await expect(page.getByLabel('first name')).toBeVisible();
        await expect(page.getByLabel('last name')).toBeVisible();
        await expect(page.getByLabel('email address')).toBeVisible();
        await expect(page.getByLabel('phone')).toBeVisible();
        await expect(page.getByLabel('date of birth')).toBeVisible();
        await expect(page.getByLabel('password')).toBeVisible();
        await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('submitting the signup form shows feedback', async ({ page }) => {
        await page.goto('/signup');

        await page.getByLabel('first name').fill('Alex');
        await page.getByLabel('last name').fill('Johnson');
        await page.getByLabel('email address').fill('alex@example.com');
        await page.getByLabel('phone').fill('8015550123');
        await page.getByLabel('date of birth').fill('1990-01-01');
        await page.getByLabel('password').fill('Str0ngP@ss!');
        await page.getByLabel('terms of service').check();
        await page.getByLabel('privacy policy').check();
        await page.getByLabel('cookies').check();
        await page.getByLabel('text messages').check();
        await page.getByRole('button', { name: /create account/i }).click();

        // The form posts to /auth/signup; against a running server this
        // surfaces either the success or error feedback banner.
        await expect(page.locator('.status-message')).toBeVisible();
    });
});
