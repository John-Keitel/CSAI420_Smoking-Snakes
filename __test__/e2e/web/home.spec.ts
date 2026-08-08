import { expect, test } from '@playwright/test';

// WEBTEST-04: browser navigation to / asserts the hero, nav, and CTAs render.
// These specs exercise the actual rendered Next.js pages (not API route.ts),
// which the repo's existing e2e suite never did.

test.describe('home page (WEBTEST-04)', () => {
    test('renders the hero section with the primary CTA', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('heading', { name: /move through care with a little more certainty/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible();
    });

    test('renders the site header with navigation', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('link', { name: /STEDI home/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /how it works/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /guided signup/i })).toBeVisible();
    });

    test('renders the sign in and start here header actions', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /start here/i })).toBeVisible();
    });

    test('renders the how-it-works and closing sections', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('heading', { name: /support that meets you in the middle/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /simple by design/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /let.s make the next one clearer/i })).toBeVisible();
    });

    test('exposes a skip link to main content', async ({ page }) => {
        await page.goto('/');

        const skip = page.getByRole('link', { name: /skip to content/i });
        await expect(skip).toHaveAttribute('href', '#main-content');
    });
});
