const {
    CHAT_STEPS,
    fieldForStep,
    inputPropsForStep,
    splitName,
    toUserData,
    validate,
} = require('../app/lib/stepRules');

describe('fieldForStep - the step-to-field mapping', () => {
    it('matches the server step order', () => {
        expect(CHAT_STEPS).toEqual([
            'initial_greeting',
            'name_provided',
            'email_collection',
            'phone_collection',
            'birth_date_collection',
            'password_collection',
            'completion',
        ]);
    });

    it.each([
        ['name_provided', 'name'],
        ['email_collection', 'email'],
        ['phone_collection', 'phone'],
        ['birth_date_collection', 'birthDate'],
        ['password_collection', 'password'],
    ])('a message sent at %s fills %s', (step, field) => {
        expect(fieldForStep(step)).toBe(field);
    });

    it('collects nothing at the opener or at completion', () => {
        expect(fieldForStep('initial_greeting')).toBeNull();
        expect(fieldForStep('completion')).toBeNull();
    });

    it('collects nothing for an unrecognised step', () => {
        expect(fieldForStep('not_a_step')).toBeNull();
    });
});

describe('validate - mirrors ChatAssistedRegistrationSchema', () => {
    it('rejects an empty or whitespace-only reply at any step', () => {
        expect(validate('email_collection', '   ').valid).toBe(false);
        expect(validate('name_provided', '').valid).toBe(false);
    });

    describe('email (INPUT-06)', () => {
        it('accepts a well-formed address', () => {
            expect(validate('email_collection', 'valid.email@example.com').valid).toBe(true);
        });

        it.each(['invalid-email', 'missing-at-symbol.com', '@missing-local-part.com', 'spaces in@email.com'])(
            'rejects %s',
            (value) => {
                expect(validate('email_collection', value).valid).toBe(false);
            }
        );
    });

    describe('password (INPUT-07)', () => {
        it('accepts a password meeting every rule', () => {
            expect(validate('password_collection', 'Str0ngP@ssw0rd!').valid).toBe(true);
        });

        it.each([
            ['weak', 'at least 8 characters'],
            ['12345678', 'uppercase'],
            ['NOLOWER1!', 'lowercase'],
            ['NoNumbers!', 'number'],
            ['NoSpecial123', 'special character'],
        ])('rejects %s', (value, expectedFragment) => {
            const result = validate('password_collection', value);

            expect(result.valid).toBe(false);
            expect(result.error).toContain(expectedFragment);
        });

        it('rejects a password longer than 128 characters', () => {
            expect(validate('password_collection', `A1!${'a'.repeat(130)}`).valid).toBe(false);
        });
    });

    describe('birth date (INPUT-08)', () => {
        it('accepts a real calendar date', () => {
            expect(validate('birth_date_collection', '1990-06-15').valid).toBe(true);
        });

        it.each(['15-06-1990', '1990/06/15', 'yesterday'])('rejects the malformed value %s', (value) => {
            expect(validate('birth_date_collection', value).valid).toBe(false);
        });

        it('rejects a well-formed value that is not a real date', () => {
            const result = validate('birth_date_collection', '1990-02-31');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a real date');
        });
    });

    describe('phone (INPUT-09)', () => {
        it.each(['8014567890', '+15551234567'])('accepts %s', (value) => {
            expect(validate('phone_collection', value).valid).toBe(true);
        });

        it.each(['invalid-phone', '12345', '+1234567890123456'])('rejects %s', (value) => {
            expect(validate('phone_collection', value).valid).toBe(false);
        });
    });

    describe('name (INPUT-10)', () => {
        it('accepts an ordinary full name', () => {
            expect(validate('name_provided', 'Alex Johnson').valid).toBe(true);
        });

        it('accepts international characters', () => {
            expect(validate('name_provided', 'José María García-López').valid).toBe(true);
        });

        it('accepts a single word, because the missing part is defaulted', () => {
            expect(validate('name_provided', 'Alex').valid).toBe(true);
        });

        it.each(['<script>alert(1)</script>', 'Robert; DROP TABLE users', 'Bobby -- Tables'])('rejects %s', (value) => {
            expect(validate('name_provided', value).valid).toBe(false);
        });

        it('rejects a name part longer than 64 characters', () => {
            expect(validate('name_provided', `${'a'.repeat(65)} Johnson`).valid).toBe(false);
        });
    });

    it('accepts anything at a step that collects nothing', () => {
        expect(validate('initial_greeting', 'I need help signing up').valid).toBe(true);
    });
});

describe('splitName', () => {
    it('splits a two-part name', () => {
        expect(splitName('Alex Johnson')).toEqual({ firstName: 'Alex', lastName: 'Johnson' });
    });

    it('keeps every remaining token as the last name', () => {
        expect(splitName('José María García-López')).toEqual({
            firstName: 'José',
            lastName: 'María García-López',
        });
    });

    it('defaults the missing part of a one-word name so the API does not 400', () => {
        expect(splitName('Alex')).toEqual({ firstName: 'Alex', lastName: 'User' });
    });

    it('collapses repeated whitespace', () => {
        expect(splitName('  Alex   Johnson  ')).toEqual({ firstName: 'Alex', lastName: 'Johnson' });
    });
});

describe('inputPropsForStep (INPUT-04)', () => {
    it('uses an email keyboard with autocapitalisation disabled', () => {
        const props = inputPropsForStep('email_collection');

        expect(props.keyboardType).toBe('email-address');
        expect(props.autoCapitalize).toBe('none');
        expect(props.secureTextEntry).toBe(false);
    });

    it('uses a phone keypad', () => {
        expect(inputPropsForStep('phone_collection').keyboardType).toBe('phone-pad');
    });

    it('uses a numeric keypad for the birth date', () => {
        // 'numbers-and-punctuation' is the iOS numeric pad that keeps the hyphens
        // YYYY-MM-DD needs; Android has no such key type and uses 'numeric'.
        expect(['numeric', 'numbers-and-punctuation']).toContain(inputPropsForStep('birth_date_collection').keyboardType);
    });

    it('masks the password step', () => {
        expect(inputPropsForStep('password_collection').secureTextEntry).toBe(true);
    });

    it('falls back to sensible defaults for an unknown step', () => {
        expect(inputPropsForStep('completion')).toMatchObject({ keyboardType: 'default', secureTextEntry: false });
    });
});

describe('toUserData', () => {
    const collected = {
        name: 'Alex Johnson',
        email: '  Alex@Example.COM ',
        phone: '8014567890',
        birthDate: '1990-06-15',
        password: 'Str0ngP@ssw0rd!',
    };

    it('maps the accumulator onto the API payload', () => {
        expect(toUserData(collected)).toEqual({
            email: 'alex@example.com',
            password: 'Str0ngP@ssw0rd!',
            birthDate: '1990-06-15',
            phone: '8014567890',
            firstName: 'Alex',
            lastName: 'Johnson',
        });
    });

    it('omits phone entirely when it was never answered, so the route can store N/A', () => {
        expect(toUserData({ ...collected, phone: '' })).not.toHaveProperty('phone');
    });
});
