// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "tools/.venv", "tools/raw", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
    },
  },
  {
    files: ["src/physics/**/*.ts"],
    rules: {
      // src/physics is pure functions only (SPEC §4.3.3): no React, no DOM.
      "no-restricted-imports": ["error", { patterns: ["react", "react-dom", "react/*"] }],
    },
  },
  {
    files: ["*.config.{js,ts}", "tools/**/*.mjs", "tests/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
);
