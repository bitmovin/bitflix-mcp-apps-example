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
    // Discover's views and components follow the full recommended hooks preset.
    files: ['src/views/components/discover/**/*.tsx', 'src/views/{discover,film,reel}.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    // Discover's views receive films in tool results. Importing its catalogue,
    // search or screen modules would ship server code and data to the browser;
    // src/discover/model.ts (types and pure helpers) is the only bridge.
    files: ['src/views/**/*.ts', 'src/views/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/discover/catalog.js', '**/discover/search.js', '**/discover/screens.js', '**/server.js'],
              allowTypeImports: true,
              message:
                'Discover views get films from tool results. Import shared types and helpers from discover/model.js.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      curly: ['error', 'all'],

      // Async handlers on void-returning JSX attributes (onClick etc.) are
      // idiomatic; the returned promise is deliberately dropped.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // node:test's describe/it return promises the runner itself tracks;
      // awaiting or voiding every call would only add noise.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
