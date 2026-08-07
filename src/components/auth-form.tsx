'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { SiteHeader } from '@/components/site-header';

type AuthMode = 'signin' | 'signup';

type FormValues = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    cookiesAccepted: boolean;
    textMessagesAccepted: boolean;
};

const initialValues: FormValues = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    termsAccepted: false,
    privacyAccepted: false,
    cookiesAccepted: false,
    textMessagesAccepted: false,
};

function getErrorMessage(payload: Record<string, unknown>, fallback: string): string {
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.error === 'string') return payload.error;

    if (payload.errors && typeof payload.errors === 'object') {
        const firstError = Object.values(payload.errors as Record<string, unknown>).flatMap((value) =>
            Array.isArray(value) ? value : [value]
        )[0];

        if (typeof firstError === 'string') return firstError;
    }

    return fallback;
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
    const isSignup = mode === 'signup';
    const [values, setValues] = useState<FormValues>(initialValues);
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);

    const updateValue = (key: keyof FormValues, value: string | boolean) => {
        setValues((current) => ({ ...current, [key]: value }));
        setFeedback(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPending(true);
        setFeedback(null);

        const endpoint = isSignup ? '/auth/signup' : '/auth/signin';
        const body = isSignup ? values : { email: values.email, password: values.password };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

            if (!response.ok) {
                setFeedback({
                    kind: 'error',
                    message: getErrorMessage(payload, 'We could not complete that request. Check your details and try again.'),
                });
                return;
            }

            if (!isSignup && typeof payload.token === 'string') {
                window.localStorage.setItem('stedi-token', payload.token);
            }

            setFeedback({
                kind: 'success',
                message: isSignup
                    ? 'Your account is ready. Sign in whenever you are ready to continue.'
                    : 'You’re signed in. Your next step is ready.',
            });

            if (isSignup) setValues(initialValues);
        } catch {
            setFeedback({ kind: 'error', message: 'We could not reach STEDI. Check your connection and try again.' });
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="site-frame">
            <SiteHeader />
            <div className="auth-layout shell">
                <section className="auth-intro" aria-labelledby="auth-title">
                    <p className="eyebrow">{isSignup ? 'Start with the basics' : 'Welcome back'}</p>
                    <h1 id="auth-title">{isSignup ? 'A steadier day starts here.' : 'Good to see you again.'}</h1>
                    <p>
                        {isSignup
                            ? 'Create your STEDI account in a few minutes. You can always add more detail later.'
                            : 'Sign in to pick up where you left off and keep your next step in view.'}
                    </p>
                    <div className="auth-aside-note">
                        <span className="note-mark" aria-hidden="true">
                            ✳
                        </span>
                        <span>{isSignup ? 'Your information stays yours.' : 'Your progress is waiting for you.'}</span>
                    </div>
                </section>

                <section className="form-panel" aria-labelledby="form-title">
                    <div className="form-heading">
                        <p className="form-index">{isSignup ? '01 / CREATE' : '02 / RETURN'}</p>
                        <h2 id="form-title">{isSignup ? 'Create your account' : 'Sign in to STEDI'}</h2>
                        <p>{isSignup ? 'Use an email you check regularly.' : 'Use the email and password connected to your account.'}</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {isSignup ? (
                            <div className="form-grid form-grid-two">
                                <label className="field">
                                    <span className="field-label">First name</span>
                                    <input
                                        className="input"
                                        name="firstName"
                                        value={values.firstName}
                                        onChange={(event) => updateValue('firstName', event.target.value)}
                                        autoComplete="given-name"
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label">Last name</span>
                                    <input
                                        className="input"
                                        name="lastName"
                                        value={values.lastName}
                                        onChange={(event) => updateValue('lastName', event.target.value)}
                                        autoComplete="family-name"
                                        required
                                    />
                                </label>
                            </div>
                        ) : null}

                        <label className="field">
                            <span className="field-label">Email address</span>
                            <input
                                className="input"
                                name="email"
                                type="email"
                                value={values.email}
                                onChange={(event) => updateValue('email', event.target.value)}
                                autoComplete="email"
                                spellCheck={false}
                                placeholder="you@example.com…"
                                required
                            />
                        </label>

                        {isSignup ? (
                            <div className="form-grid form-grid-two">
                                <label className="field">
                                    <span className="field-label">Phone</span>
                                    <input
                                        className="input"
                                        name="phone"
                                        type="tel"
                                        value={values.phone}
                                        onChange={(event) => updateValue('phone', event.target.value)}
                                        autoComplete="tel"
                                        inputMode="tel"
                                        placeholder="+18015550123…"
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label">Date of birth</span>
                                    <input
                                        className="input"
                                        name="dateOfBirth"
                                        type="date"
                                        value={values.dateOfBirth}
                                        onChange={(event) => updateValue('dateOfBirth', event.target.value)}
                                        autoComplete="bday"
                                        required
                                    />
                                </label>
                            </div>
                        ) : null}

                        <label className="field">
                            <span className="field-label">Password</span>
                            <input
                                className="input"
                                name="password"
                                type="password"
                                value={values.password}
                                onChange={(event) => updateValue('password', event.target.value)}
                                autoComplete={isSignup ? 'new-password' : 'current-password'}
                                minLength={isSignup ? 8 : 1}
                                required
                            />
                            {isSignup ? <span className="field-help">8+ characters with upper, lower, number, and symbol.</span> : null}
                        </label>

                        {isSignup ? (
                            <fieldset className="checkbox-list">
                                <legend className="field-label">Permissions</legend>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="termsAccepted"
                                        checked={values.termsAccepted}
                                        onChange={(event) => updateValue('termsAccepted', event.target.checked)}
                                        required
                                    />
                                    <span>I agree to the terms of service.</span>
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="privacyAccepted"
                                        checked={values.privacyAccepted}
                                        onChange={(event) => updateValue('privacyAccepted', event.target.checked)}
                                        required
                                    />
                                    <span>I agree to the privacy policy.</span>
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="cookiesAccepted"
                                        checked={values.cookiesAccepted}
                                        onChange={(event) => updateValue('cookiesAccepted', event.target.checked)}
                                        required
                                    />
                                    <span>I understand that STEDI uses cookies to keep the service secure.</span>
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="textMessagesAccepted"
                                        checked={values.textMessagesAccepted}
                                        onChange={(event) => updateValue('textMessagesAccepted', event.target.checked)}
                                        required
                                    />
                                    <span>I agree to receive helpful text messages from STEDI.</span>
                                </label>
                            </fieldset>
                        ) : null}

                        {feedback ? (
                            <div
                                className={`status-message status-${feedback.kind}`}
                                role={feedback.kind === 'error' ? 'alert' : 'status'}
                                aria-live="polite"
                            >
                                {feedback.message}
                            </div>
                        ) : null}

                        <div className="form-submit-row">
                            <button className="button button-primary button-submit" type="submit" disabled={pending}>
                                {pending ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
                                <span aria-hidden="true">↗</span>
                            </button>
                            <p className="form-switch">
                                {isSignup ? 'Already have an account?' : 'New to STEDI?'}{' '}
                                <Link href={isSignup ? '/signin' : '/signup'}>{isSignup ? 'Sign in' : 'Create one'}</Link>
                            </p>
                        </div>
                    </form>
                </section>
            </div>
            <footer className="site-footer shell">
                <span>STEDI / built for steadier days</span>
                <Link href="/chat">Need a guided start? →</Link>
            </footer>
        </div>
    );
}
