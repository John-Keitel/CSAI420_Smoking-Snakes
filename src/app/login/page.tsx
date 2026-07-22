import { redirect } from 'next/navigation';

import { ModeToggle } from '@/components/mode-toggle';
import { getAuthenticatedSession } from '@/lib/auth';

import { LoginForm } from './login';

export default async function LoginPage() {
    const session = await getAuthenticatedSession();
    if (session) {
        redirect('/dashboard');
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(20,118,92,0.18),_transparent_35%),linear-gradient(180deg,_rgba(248,250,249,1)_0%,_rgba(231,241,237,1)_100%)] px-6 py-16 dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(180deg,_rgba(15,23,23,1)_0%,_rgba(20,30,28,1)_100%)]">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            <div className="w-full max-w-md rounded-[2rem] border border-border/70 bg-background/85 p-8 shadow-2xl shadow-black/10 backdrop-blur dark:shadow-black/30">
                <div className="mb-8 space-y-2">
                    <p className="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">STEDI Access</p>
                    <h1 className="font-[var(--font-fraunces)] text-4xl leading-tight text-foreground">Sign in to your dashboard</h1>
                    <p className="text-sm text-muted-foreground">Your STEDI session token stays on the server and is linked to your app session automatically.</p>
                </div>
                <LoginForm />
            </div>
        </main>
    );
}