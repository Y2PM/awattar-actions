

const { stratoPreset } = require('@dynatrace/strato-components-preview/testing/jest');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  ...stratoPreset,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: true,
  displayName: 'widgets',
  rootDir: '../',
  roots: ['<rootDir>/actions'],
  testMatch: ['**/*.widget.test.tsx'],
  setupFiles: [
    '@dynatrace/strato-components-preview/testing',
    '@dynatrace-sdk/user-preferences/testing',
    '@dynatrace-sdk/navigation/testing',
    '@dynatrace-sdk/app-environment/testing'
  ],
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
