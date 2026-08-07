// transformIgnorePatterns is deliberately not overridden: the jest-expo preset
// already ships the correct pattern for this SDK, and a hand-written one leaves
// React Native internals untransformed.
module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
