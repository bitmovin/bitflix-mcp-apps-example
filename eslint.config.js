import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', '.vercel/', '.skybridge/'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // vite.config.ts sits outside tsconfig's `include`, which covers only src.
        projectService: { allowDefaultProject: ['vite.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // This config file is plain JS and has no TypeScript program to check against.
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Cherry-picked instead of the recommended preset, whose React Compiler rules this app violates by design
      // with its ref-during-render and setState-in-effect patterns.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Async handlers on void-returning JSX attributes (onClick etc.) are
      // idiomatic; the returned promise is deliberately dropped.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
);
