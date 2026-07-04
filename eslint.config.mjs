import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const eslintConfig = [
    ...nextVitals,
    ...nextTs,
    prettier,
    {
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            'react-hooks/exhaustive-deps': 'off',
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'react/no-unescaped-entities': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            '.agents/**',
            '.specs/**',
            'out/**',
            'build/**',
            'next-env.d.ts',
            'prisma/**',
            'bruno_collection/**',
        ],
    },
];

export default eslintConfig;
