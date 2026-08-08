import Link from 'next/link';

export function SiteHeader() {
    return (
        <>
            <a className="skip-link" href="#main-content">
                Skip to content
            </a>
            <header className="site-header">
                <div className="shell header-inner">
                    <Link className="wordmark" href="/" aria-label="STEDI home">
                        <span className="wordmark-mark" aria-hidden="true">
                            ✳
                        </span>
                        STEDI
                    </Link>

                    <nav className="header-nav" aria-label="Primary navigation">
                        <Link href="/#how-it-works">How it works</Link>
                        <Link href="/chat">Guided signup</Link>
                    </nav>

                    <div className="header-actions">
                        <Link className="header-link" href="/signin">
                            Sign in
                        </Link>
                        <Link className="button button-small" href="/signup">
                            Start here
                        </Link>
                    </div>
                </div>
            </header>
        </>
    );
}
