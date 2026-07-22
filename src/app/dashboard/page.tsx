import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getAuthenticatedSession } from '@/lib/auth';

export default async function DashboardPage() {
    const session = await getAuthenticatedSession();
    if (!session) {
        redirect('/login');
    }

    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(245,247,246,1)_0%,_rgba(228,238,234,1)_100%)] px-6 py-16 dark:bg-[linear-gradient(180deg,_rgba(15,23,23,1)_0%,_rgba(19,30,28,1)_100%)]">
            <div className="mx-auto max-w-4xl rounded-[2rem] border border-border/70 bg-background/85 p-8 shadow-xl backdrop-blur">
                <p className="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">Dashboard</p>
                <h1 className="mt-3 font-[var(--font-fraunces)] text-4xl text-foreground">Welcome back</h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">You are signed in with a Better Auth session cookie, and downstream STEDI access now resolves your linked STEDI token server-side.</p>

                <div className="mt-8 grid gap-4 rounded-[1.5rem] border border-border/70 bg-muted/40 p-5 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Session user</p>
                        <p className="mt-2 text-lg font-medium text-foreground">{session.user.name || session.user.email}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Email</p>
                        <p className="mt-2 text-lg font-medium text-foreground">{session.user.email}</p>
                    </div>
                </div>

                <form action="/api/auth/sign-out" method="POST" className="mt-8">
                    <Button type="submit" variant="outline">
                        Sign out
                    </Button>
                </form>
            </div>
        </main>
    );
}