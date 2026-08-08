// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AuthForm from '@/components/auth-form';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
});

describe('AuthForm (WEBTEST-01)', () => {
    describe('signin mode', () => {
        it('renders email and password fields', () => {
            render(<AuthForm mode="signin" />);

            expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        });

        it('does not render signup-only fields', () => {
            render(<AuthForm mode="signin" />);

            expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
        });

        it('shows an error on a failed signin', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Invalid credentials' }) }))
            );

            render(<AuthForm mode="signin" />);

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bad@test.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
            });
        });

        it('stores the token on a successful signin', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ token: 'abc123' }) }))
            );

            render(<AuthForm mode="signin" />);

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'good@test.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(window.localStorage.getItem('stedi-token')).toBe('abc123');
            });
        });
    });

    describe('signup mode', () => {
        it('renders all signup fields including consent checkboxes', () => {
            render(<AuthForm mode="signup" />);

            expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/terms of service/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/privacy policy/i)).toBeInTheDocument();
        });

        it('shows a success message after a successful signup', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
            );

            render(<AuthForm mode="signup" />);

            fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alex' } });
            fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Johnson' } });
            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alex@test.com' } });
            fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '8015550123' } });
            fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-01' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Str0ngP@ss!' } });
            fireEvent.click(screen.getByLabelText(/terms of service/i));
            fireEvent.click(screen.getByLabelText(/privacy policy/i));
            fireEvent.click(screen.getByLabelText(/cookies/i));
            fireEvent.click(screen.getByLabelText(/text messages/i));
            fireEvent.click(screen.getByRole('button', { name: /create account/i }));

            await waitFor(() => {
                expect(screen.getByText(/your account is ready/i)).toBeInTheDocument();
            });
        });
    });
});
