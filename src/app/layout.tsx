import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono, Inter } from 'next/font/google';

import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const fraunces = Fraunces({
    variable: '--font-fraunces',
    subsets: ['latin'],
    display: 'swap',
    axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
    title: 'STEDI',
    description: 'STEDI',
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f8faf9' },
        { media: '(prefers-color-scheme: dark)', color: '#1c2422' },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn('h-full', 'antialiased', geistSans.variable, geistMono.variable, fraunces.variable, 'font-sans', inter.variable)}
        >
            <body className="flex min-h-full flex-col">
                <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
