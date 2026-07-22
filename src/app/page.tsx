import Link from 'next/link';

import { ModeToggle } from '@/components/mode-toggle';
import { buttonVariants } from '@/components/ui/button';

export default function Page() {
    return (
        <main className="flex min-h-screen items-center justify-center p-6">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="space-y-2">
                    <h1 className="font-[var(--font-fraunces)] text-4xl text-foreground">STEDI</h1>
                    <p className="text-sm text-muted-foreground">Sign in to access your dashboard.</p>
                </div>
                <Link href="/login" className={buttonVariants({ size: 'lg' })}>
                    Login
                </Link>
            </div>
        </main>
    );
}
