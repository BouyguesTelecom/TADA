module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    globalSetup: '<rootDir>/setupTests.ts',
    globalTeardown: '<rootDir>/teardownTests.ts',
    testTimeout: 30000
};
