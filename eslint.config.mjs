import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import astro from "eslint-plugin-astro";

const topLevelDeclaration = {
  selector:
    "Program > :matches(VariableDeclaration, FunctionDeclaration, ClassDeclaration, TSInterfaceDeclaration, TSTypeAliasDeclaration, TSEnumDeclaration, ExportNamedDeclaration[declaration], ExportDefaultDeclaration)",
};

const simpleVariable = {
  selector:
    "Program > :matches(VariableDeclaration, ExportNamedDeclaration[declaration.type='VariableDeclaration']):not(:has(:matches(ArrayExpression, ObjectExpression, ArrowFunctionExpression, FunctionExpression, CallExpression, NewExpression, AwaitExpression, ConditionalExpression, TemplateLiteral)))",
};

const callbackDeclaration = {
  selector:
    "VariableDeclaration:has(:matches(ArrowFunctionExpression, FunctionExpression))",
};

export default [
  {
    // Match the source-formatting exclusions in .prettierignore.
    ignores: [
      "**/node_modules/**",
      "**/.astro/**",
      "**/dist/**",
      "**/storybook-static/**",
      "**/coverage/**",
      "**/_generated/**",
      "**/generated/**",
      "**/*.generated.*",
      "apps/api/src/db/types.ts",
      "**/.env*",
      "**/.secrets/**",
      "**/.impeccable/**",
      ".scratch/**",
      ".room/**",
      ".agents/**",
      ".agent/**",
      ".claude/**",
      ".cursor/**",
      "apps/web/public/**",
      "apps/api/prisma/**",
      "sketches/**",
      "context-factory/**",
      "docs/**",
    ],
  },
  ...astro.configs["flat/base"],
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,astro}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "*", next: topLevelDeclaration },
        { blankLine: "always", prev: topLevelDeclaration, next: "*" },
        // Group simple values by syntax so Prettier wrapping cannot change the rule.
        {
          blankLine: "any",
          prev: simpleVariable,
          next: simpleVariable,
        },
        { blankLine: "always", prev: "*", next: callbackDeclaration },
        { blankLine: "always", prev: callbackDeclaration, next: "*" },
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "for", "while", "do", "switch", "try", "return"],
        },
        {
          blankLine: "always",
          prev: ["if", "for", "while", "do", "switch", "try"],
          next: "*",
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: { parser: tsParser },
  },
  {
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
];
