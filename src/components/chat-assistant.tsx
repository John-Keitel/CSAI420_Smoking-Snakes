'use client';

import Link from 'next/link';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import { SiteHeader } from '@/components/site-header';
import { TypingIndicator } from '@/components/typing-indicator';

type ChatStep =
    | 'initial_greeting'
    | 'name_provided'
    | 'email_collection'
    | 'phone_collection'
    | 'birth_date_collection'
    | 'password_collection'
    | 'completion';

type ChatMessage = {
    role: 'assistant' | 'user';
    message: string;
};

type CollectedFields = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    password?: string;
};

const INITIAL_MESSAGE = "I'd be happy to help! What's your name?";
const STEP_ORDER: ChatStep[] = [
    'initial_greeting',
    'name_provided',
    'email_collection',
    'phone_collection',
    'birth_date_collection',
    'password_collection',
    'completion',
];

const STEP_COPY: Record<ChatStep, { label: string; placeholder: string; type?: string; autoComplete?: string }> = {
    initial_greeting: { label: 'Your name', placeholder: 'Alex Johnson…', autoComplete: 'name' },
    name_provided: { label: 'Your name', placeholder: 'Alex Johnson…', autoComplete: 'name' },
    email_collection: { label: 'Email address', placeholder: 'you@example.com…', type: 'email', autoComplete: 'email' },
    phone_collection: { label: 'Phone number', placeholder: '+18015550123…', type: 'tel', autoComplete: 'tel' },
    birth_date_collection: { label: 'Date of birth', placeholder: 'YYYY-MM-DD…', type: 'text', autoComplete: 'bday' },
    password_collection: { label: 'Create a password', placeholder: '8+ characters…', type: 'password', autoComplete: 'new-password' },
    completion: { label: 'Complete', placeholder: '' },
};

function makeSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `web-session-${Date.now()}`;
}

function collectAnswer(step: ChatStep, value: string, previous: CollectedFields): CollectedFields {
    if (step === 'name_provided') {
        const [firstName = 'User', ...lastNameParts] = value.trim().split(/\s+/);
        return { ...previous, firstName, lastName: lastNameParts.join(' ') || firstName };
    }

    if (step === 'email_collection') return { ...previous, email: value.trim().toLowerCase() };
    if (step === 'phone_collection') return { ...previous, phone: value.trim() };
    if (step === 'birth_date_collection') return { ...previous, birthDate: value.trim() };
    if (step === 'password_collection') return { ...previous, password: value };

    return previous;
}

function errorMessage(payload: Record<string, unknown>): string {
    if (typeof payload.error === 'string') return payload.error;
    if (typeof payload.message === 'string') return payload.message;

    if (payload.errors && typeof payload.errors === 'object') {
        const first = Object.values(payload.errors as Record<string, unknown>).flatMap((value) => (Array.isArray(value) ? value : [value]))[0];
        if (typeof first === 'string') return first;
    }

    return 'Something interrupted the guided signup. Check your answer and try again.';
}

export default function ChatAssistant() {
    const sessionIdRef = useRef<string>(makeSessionId());
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', message: INITIAL_MESSAGE }]);
    const [currentStep, setCurrentStep] = useState<ChatStep>('name_provided');
    const [collected, setCollected] = useState<CollectedFields>({});
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [complete, setComplete] = useState(false);

    const stepInfo = STEP_COPY[currentStep];
    const stepNumber = Math.min(Math.max(STEP_ORDER.indexOf(currentStep), 1), STEP_ORDER.length - 2);
    const progress = useMemo(() => `${stepNumber} / 5`, [stepNumber]);

    const submitRegistration = async (fields: CollectedFields, transcript: ChatMessage[]) => {
        const response = await fetch('/user/chat-assisted', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: fields,
                chatSessionId: sessionIdRef.current,
                conversationLog: transcript,
                lastActivity: new Date().toISOString(),
                locale: 'en-US',
            }),
        });
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (!response.ok) throw new Error(errorMessage(payload));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = currentStep === 'password_collection' ? draft : draft.trim();

        if (pending || complete) return;
        if (!value) {
            setFeedback('Add a reply so we know how to continue.');
            return;
        }

        const submittedStep = currentStep;
        const safeMessage = submittedStep === 'password_collection' ? '••••••••' : value;
        const userMessage: ChatMessage = { role: 'user', message: safeMessage };
        const transcriptWithUser = [...messages, userMessage];
        const nextFields = collectAnswer(submittedStep, value, collected);

        setDraft('');
        setFeedback(null);
        setPending(true);
        setMessages(transcriptWithUser);
        setCollected(nextFields);

        try {
            const response = await fetch('/chat/continue-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatSessionId: sessionIdRef.current,
                    message: value,
                    context: submittedStep,
                }),
            });
            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

            if (!response.ok || typeof payload.response !== 'string' || typeof payload.nextStep !== 'string') {
                throw new Error(errorMessage(payload));
            }

            const nextStep = payload.nextStep as ChatStep;
            const assistantMessage: ChatMessage = { role: 'assistant', message: payload.response };
            const nextTranscript = [...transcriptWithUser, assistantMessage];

            setMessages(nextTranscript);
            setCurrentStep(nextStep);

            if (nextStep === 'completion') {
                await submitRegistration(nextFields, nextTranscript);
                setComplete(true);
            }
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="site-frame">
            <SiteHeader />
            <div className="chat-layout shell">
                <section className="chat-intro" aria-labelledby="chat-title">
                    <p className="eyebrow">Guided signup / 05 minutes</p>
                    <h1 id="chat-title">Let’s take this one question at a time.</h1>
                    <p>Share only what you’re ready to share. The assistant will keep the path short and the next step clear.</p>
                    <div className="chat-aside-note">
                        <span className="note-mark" aria-hidden="true">
                            01
                        </span>
                        <span>Your password is masked and never added to the conversation record.</span>
                    </div>
                    <Link className="text-link" href="/signup">
                        Prefer a form? Use standard signup <span aria-hidden="true">→</span>
                    </Link>
                </section>

                <section className="chat-panel" aria-labelledby="chat-panel-title">
                    <div className="chat-toolbar">
                        <div>
                            <p className="form-index">STEDI / GUIDE</p>
                            <h2 id="chat-panel-title">Your signup guide</h2>
                        </div>
                        <span className="chat-progress" aria-label={`Step ${progress}`}>
                            {progress}
                        </span>
                    </div>

                    <div className="chat-messages" role="log" aria-live="polite" aria-label="Signup conversation">
                        {messages.map((message, index) => (
                            <div className={`chat-message chat-message-${message.role}`} key={`${message.role}-${index}`}>
                                <span className="chat-message-label">{message.role === 'assistant' ? 'STEDI guide' : 'You'}</span>
                                <p>{message.message}</p>
                            </div>
                        ))}
                        {pending ? <TypingIndicator /> : null}
                    </div>

                    {feedback ? (
                        <div className="status-message status-error" role="alert">
                            {feedback}
                        </div>
                    ) : null}
                    {complete ? (
                        <div className="success-banner" role="status" aria-live="polite">
                            <span className="success-mark" aria-hidden="true">
                                ✓
                            </span>
                            <div>
                                <strong>Your account is ready.</strong>
                                <p>That’s it for now. Sign in when you want to continue.</p>
                            </div>
                            <Link className="text-link" href="/signin">
                                Sign in →
                            </Link>
                        </div>
                    ) : (
                        <form className="chat-composer" onSubmit={handleSubmit}>
                            <label className="field" htmlFor="chat-draft">
                                <span className="field-label">{stepInfo.label}</span>
                                <input
                                    id="chat-draft"
                                    className="input chat-input"
                                    name="chat-draft"
                                    type={stepInfo.type ?? 'text'}
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    autoComplete={stepInfo.autoComplete}
                                    spellCheck={stepInfo.type !== 'password'}
                                    placeholder={stepInfo.placeholder}
                                    disabled={pending}
                                    required
                                />
                            </label>
                            <button className="button button-primary button-submit" type="submit" disabled={pending}>
                                {pending ? 'Sending…' : currentStep === 'password_collection' ? 'Finish signup' : 'Send reply'}
                                <span aria-hidden="true">↗</span>
                            </button>
                        </form>
                    )}
                </section>
            </div>
            <footer className="site-footer shell">
                <span>STEDI / your answers stay close to the work</span>
                <Link href="/">Back to home →</Link>
            </footer>
        </div>
    );
}
