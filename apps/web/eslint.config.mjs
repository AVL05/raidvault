import tseslint from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'error',
      'no-prototype-builtins': 'error',
      'no-empty': 'error',
      'no-loss-of-precision': 'error',
      'no-constant-condition': 'error',
      'no-fallthrough': 'error',
      'no-extra-bind': 'error',
      'no-floating-decimal': 'error',
      'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
      'react/react-in-jsx-scope': 'off',
      'react/jsx-no-comment-textnodes': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-target-blank': 'off',
      'react/jsx-no-useless-fragment': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': 'error' },
  },
  {
    ignores: ['node_modules', '.next', 'dist', 'out'],
  },
];
