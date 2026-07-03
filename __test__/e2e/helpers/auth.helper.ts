import { APIRequestContext } from 'playwright-core';

export async function asDeveloper(request: APIRequestContext) {
    return getAuthHeaders(request, 'developer@stedi.com', '@123Change');
}

export async function asProvider(request: APIRequestContext) {
    return getAuthHeaders(request, 'provider@email.com', '@123Change');
}

export async function asStandardUser(request: APIRequestContext) {
    return getAuthHeaders(request, 'provider@email.com', '@123Change');
}

export async function getAuthHeaders(request: APIRequestContext, email: string, password: string) {
    const response = await request.post('/auth/signin', {
        data: {
            email,
            password,
        },
    });

    if (response.status() !== 200) {
        throw new Error(`Failed to authenticate: ${response.status()} ${await response.text()}`);
    }

    const { token } = await response.json();

    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}
