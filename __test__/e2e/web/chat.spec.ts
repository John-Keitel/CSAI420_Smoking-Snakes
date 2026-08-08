import { expect, test } from '@playwright/test';

// WEBTEST-06: browser navigation to /chat asserts the chat panel, initial
// assistant message, and composer render.

test.describe('chat page (WEBTEST-06)', () => {
    test('renders the chat panel with the initial assistant message', async ({ page }) => {
        await page.goto('/chat');

        await expect(page.getByRole('heading', { name: /let.s take this one question at a time/i })).toBeVisible();
        await expect(page.getByText(/I'd be happy to help! What's your name\?/i)).toBeVisible();
    });

    test('renders the composer input and send button', async ({ page }) => {
        await page.goto('/chat');

        await expect(page.getByLabel('your name')).toBeVisible();
        await expect(page.getByRole('button', { name: /send reply/i })).toBeVisible();
    });

    test('renders the step progress indicator', async ({ page }) => {
        await page.goto('/chat');

        await expect(page.getByLabel('Step 1 / 5')).toBeVisible();
    });

    test('renders a link to standard signup', async ({ page }) => {
        await page.goto('/chat');

        await expect(page.getByRole('link', { name: /prefer a form\? use standard signup/i })).toHaveAttribute('href', '/signup');
    });
});
