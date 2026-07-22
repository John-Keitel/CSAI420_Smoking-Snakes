import { ModeToggle } from '@/components/mode-toggle';

export default function Page() {
    return (
        <main className="flex min-h-screen items-center justify-center p-6">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            <div className="text-sm text-muted-foreground">Page Content</div>
        </main>
    );
}
