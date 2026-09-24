import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Existing UI effects predate React Compiler's stricter guidance; keep these visible without blocking the scaffold migration.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**']),
])
