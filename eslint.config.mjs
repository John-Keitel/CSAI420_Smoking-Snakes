import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: [...nextCoreWebVitals, ...compat.extends("plugin:prettier/recommended")],

    plugins: {
        "simple-import-sort": simpleImportSort,
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
    },

    rules: {
        "react-hooks/exhaustive-deps": "off",
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        "react/no-unescaped-entities": "off",

        "prettier/prettier": ["error", {}, {
            usePrettierrc: true,
        }],

        "@typescript-eslint/no-unused-vars": ["error", {
            args: "all",
            argsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            destructuredArrayIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            ignoreRestSiblings: true,
        }],
    },
}]);