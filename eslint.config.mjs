import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks v7 added set-state-in-effect, but it produces false
      // positives for two legitimate patterns used in this project:
      //   1. useEffect(() => { fetchData() }, [fetchData]) — async data loading
      //   2. useEffect(() => { setLocal(prop) }, [prop]) — controlled-input sync
      // Both are well-established React patterns that don't cause cascading renders.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
