import Link from 'next/link';

import { SiteHeader } from '@/components/site-header';

export default function HomePage() {
    return (
        <div className="site-frame">
            <SiteHeader />
            <main id="main-content">
                <section className="hero shell" aria-labelledby="hero-title">
                    <div className="hero-copy reveal reveal-one">
                        <p className="eyebrow">A steadier way forward</p>
                        <h1 id="hero-title">Move through care with a little more certainty.</h1>
                        <p className="hero-lede">
                            STEDI brings your next step into focus — from the first question to the small habits that help you feel more in
                            control.
                        </p>
                        <div className="hero-actions">
                            <Link className="button button-primary" href="/signup">
                                Create an account <span aria-hidden="true">↗</span>
                            </Link>
                            <Link className="text-link" href="/chat">
                                Try guided signup <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                        <p className="quiet-note">
                            <span className="quiet-dot" aria-hidden="true" /> No app download needed to begin.
                        </p>
                    </div>

                    <div className="hero-visual reveal reveal-two" aria-label="A preview of the STEDI care journey">
                        <div className="orbit orbit-one" aria-hidden="true" />
                        <div className="orbit orbit-two" aria-hidden="true" />
                        <div className="journal-card">
                            <div className="card-topline">
                                <span>STEDI / FIELD NOTE</span>
                                <span>01 — 03</span>
                            </div>
                            <p className="card-kicker">Today’s orientation</p>
                            <h2>A calmer next step starts with a good question.</h2>
                            <p className="card-copy">Tell us what you need. We’ll help turn the unknown into something you can act on.</p>
                            <div className="signal-list" aria-label="Three parts of the STEDI approach">
                                <div className="signal-row">
                                    <span className="signal-number">01</span>
                                    <span>Listen first</span>
                                    <span className="signal-mark" aria-hidden="true">
                                        ↗
                                    </span>
                                </div>
                                <div className="signal-row">
                                    <span className="signal-number">02</span>
                                    <span>Make it clear</span>
                                    <span className="signal-mark" aria-hidden="true">
                                        ↗
                                    </span>
                                </div>
                                <div className="signal-row">
                                    <span className="signal-number">03</span>
                                    <span>Keep moving</span>
                                    <span className="signal-mark" aria-hidden="true">
                                        ↗
                                    </span>
                                </div>
                            </div>
                        </div>
                        <span className="visual-caption">A little more clarity, one step at a time.</span>
                    </div>
                </section>

                <section className="intro-strip shell" id="how-it-works" aria-labelledby="intro-title">
                    <p className="eyebrow">Start where you are</p>
                    <div>
                        <h2 id="intro-title">Support that meets you in the middle.</h2>
                        <p>
                            No jargon maze. No giant setup. Just a clear place to begin, with tools that get more useful as you make STEDI
                            yours.
                        </p>
                    </div>
                </section>

                <section className="service-section shell" aria-labelledby="service-title">
                    <div className="section-heading">
                        <p className="eyebrow">The first three moves</p>
                        <h2 id="service-title">Simple by design.</h2>
                    </div>
                    <div className="service-list">
                        <article className="service-item">
                            <span className="service-index">01</span>
                            <div>
                                <h3>Get oriented</h3>
                                <p>Set up your account and tell us what kind of support would make today easier.</p>
                            </div>
                            <span className="service-arrow" aria-hidden="true">
                                ↗
                            </span>
                        </article>
                        <article className="service-item">
                            <span className="service-index">02</span>
                            <div>
                                <h3>Ask the next question</h3>
                                <p>Use guided signup when you want a little help moving from “I’m not sure” to “I know what to do.”</p>
                            </div>
                            <span className="service-arrow" aria-hidden="true">
                                ↗
                            </span>
                        </article>
                        <article className="service-item">
                            <span className="service-index">03</span>
                            <div>
                                <h3>Keep your rhythm</h3>
                                <p>Return to a growing record of your progress, your questions, and the moments worth noticing.</p>
                            </div>
                            <span className="service-arrow" aria-hidden="true">
                                ↗
                            </span>
                        </article>
                    </div>
                </section>

                <section className="closing-section shell" aria-labelledby="closing-title">
                    <div className="closing-mark" aria-hidden="true">
                        ✳
                    </div>
                    <div>
                        <p className="eyebrow">Your first step is enough</p>
                        <h2 id="closing-title">Let’s make the next one clearer.</h2>
                    </div>
                    <Link className="button button-dark" href="/signup">
                        Begin with STEDI <span aria-hidden="true">↗</span>
                    </Link>
                </section>
            </main>
            <footer className="site-footer shell">
                <span>STEDI / built for steadier days</span>
                <span>© {new Date().getFullYear()} STEDI</span>
            </footer>
        </div>
    );
}
