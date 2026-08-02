const { createChatSessionId, MAX_CHAT_SESSION_ID_LENGTH } = require('../app/lib/session');

describe('createChatSessionId (FND-06)', () => {
    it('returns a non-empty id', () => {
        expect(createChatSessionId().length).toBeGreaterThan(0);
    });

    it('returns a distinct id on every call', () => {
        const ids = new Set([createChatSessionId(), createChatSessionId(), createChatSessionId()]);

        expect(ids.size).toBe(3);
    });

    it('never exceeds the length the API accepts', () => {
        expect(createChatSessionId().length).toBeLessThanOrEqual(MAX_CHAT_SESSION_ID_LENGTH);
    });
});
