import type { APIRequestContext } from '@playwright/test';

export async function asDeveloper(request: APIRequestContext) {
    return signIn(request, 'developer@stedi.com', '@123Change');
}

export async function asProvider(request: APIRequestContext) {
    return signIn(request, 'provider@email.com', '@123Change');
}

export async function asStandardUser(request: APIRequestContext) {
    return signIn(request, 'provider@email.com', '@123Change');
}

export async function signIn(request: APIRequestContext, email: string, password: string) {
    const response = await request.post('/auth/signin', {
        data: {
            email,
            password,
        },
    });

    if (response.status() !== 200) {
        throw new Error(`Failed to authenticate: ${response.status()} ${await response.text()}`);
    }

    return response;
}
