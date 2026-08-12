import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:events:telemetry');

type OnboardingMethod = 'chat' | 'voice' | 'form';

export function recordOnboardingDuration(durationSeconds: number, method: OnboardingMethod): void {
    logger.info('onboarding-duration metric method=%s durationSeconds=%d', method, Math.max(0, Math.round(durationSeconds)));
}

export function recordOnboardingOutcome(success: boolean, method: OnboardingMethod): void {
    logger.info('onboarding-outcome metric method=%s success=%s', method, success ? 'true' : 'false');
}
