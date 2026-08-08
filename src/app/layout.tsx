import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'STEDI — A steadier next step',
    description: 'A calmer way to move through your care journey.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" data-scroll-behavior="smooth">
            <body>{children}</body>
        </html>
    );
}
