module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'middleware/**/*.ts',
    'service/**/*.ts',
    'utils/**/*.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
