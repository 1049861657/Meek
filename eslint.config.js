// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const tsFiles = ['**/*.{ts,tsx,mts,cts}'];
const jsFiles = ['**/*.{js,mjs,cjs}'];
const reactFiles = ['apps/web/**/*.{tsx,jsx}'];
const untypedFiles = ['eslint.config.js', '**/*.config.{js,mjs,cjs,ts}'];

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/src/generated/**',
  ]),
  {
    name: 'meek/javascript',
    files: jsFiles,
    extends: [js.configs.recommended],
  },
  {
    name: 'meek/typescript',
    files: tsFiles,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    name: 'meek/react-hooks',
    files: reactFiles,
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    name: 'meek/untyped-config',
    files: untypedFiles,
    extends: [tseslint.configs.disableTypeChecked],
  },
);
