// Copyright 2025 The MathWorks, Inc.

import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import nodePlugin from 'eslint-plugin-node';
import vitestPlugin from 'eslint-plugin-vitest';
import fs from 'fs';

const eslintrcJson = JSON.parse(fs.readFileSync('./.eslintrc.json', 'utf8'));


function cleanGlobals(globalsObject) {
    return Object.fromEntries(
        Object.entries(globalsObject).map(([key, value]) => [key.trim(), value])
    );
}

export default [
    { ignores: ['build'] },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...cleanGlobals(globals.browser),
                ...eslintrcJson.env
            },
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
        },
        settings: eslintrcJson.settings,
        plugins: {
            ...Object.fromEntries(eslintrcJson.plugins.map(plugin => [plugin, import(`eslint-plugin-${plugin}`)])),
            react,
            node: nodePlugin,
            vitest: vitestPlugin,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            'react/jsx-no-target-blank': 'off',
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            ...eslintrcJson.rules,
        },
    },
];
