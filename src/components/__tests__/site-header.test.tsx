// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SiteHeader } from '@/components/site-header';

afterEach(cleanup);

describe('SiteHeader (WEBTEST-03)', () => {
    it('renders the STEDI wordmark linking home', () => {
        render(<SiteHeader />);

        const wordmark = screen.getByRole('link', { name: /STEDI home/i });
        expect(wordmark).toHaveAttribute('href', '/');
        expect(wordmark).toHaveTextContent('STEDI');
    });

    it('renders the primary navigation links', () => {
        render(<SiteHeader />);

        const howItWorks = screen.getAllByRole('link', { name: /how it works/i })[0];
        expect(howItWorks).toHaveAttribute('href', '/#how-it-works');
        expect(screen.getByRole('link', { name: /guided signup/i })).toHaveAttribute('href', '/chat');
    });

    it('renders the sign in and start here actions', () => {
        render(<SiteHeader />);

        expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
        expect(screen.getByRole('link', { name: /start here/i })).toHaveAttribute('href', '/signup');
    });

    it('renders a skip link to main content for accessibility', () => {
        render(<SiteHeader />);

        const skip = screen.getByRole('link', { name: /skip to content/i });
        expect(skip).toHaveAttribute('href', '#main-content');
    });
});
