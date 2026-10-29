import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint: correctness, not formatting (the client and server have different, consistent styles;
 * formatting would be Prettier's job). Existing debt that isn't a bug (any, non-null assertions,
 * console calls) is reported as warnings so it stays visible without blocking; errors fail CI.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'server/dist/**', 'node_modules/**', 'server/node_modules/**', 'coverage/**', 'test-results/**', 'playwright-report/**', '.tmp/**', '.temp/**', 'public/**', 'scripts/**', '**/*.js', '**/*.cjs', '**/*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'server/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // The server logs to its console on purpose (it has no other output)
    files: ['server/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
