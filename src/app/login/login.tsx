'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

import { type LoginActionState, loginAction } from './actions';

const initialState: LoginActionState = {};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign in'}
        </Button>
    );
}

export function LoginForm() {
    const [state, formAction] = useActionState(loginAction, initialState);

    return (
        <form action={formAction} className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                    Username
                </label>
                <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground/40"
                />
                {state.fieldErrors?.username ? <p className="text-sm text-destructive">{state.fieldErrors.username[0]}</p> : null}
            </div>

            <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground/40"
                />
                {state.fieldErrors?.password ? <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p> : null}
            </div>

            {state.formError ? <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p> : null}

            <SubmitButton />
        </form>
    );
}