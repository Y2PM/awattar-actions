/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: true,
  displayName: 'widgets',
  rootDir: '../',
  roots: ['<rootDir>/actions'],
  testMatch: ['**/*.widget.test.tsx'],
  setupFiles: [
    '@dynatrace-sdk/user-preferences/testing',
    '@dynatrace-sdk/navigation/testing',
    '@dynatrace-sdk/app-environment/testing',
  ],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(t|j)sx$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/actions/tsconfig.widget.test.json',
        isolatedModules: true,
      },
    ],
  },
};
