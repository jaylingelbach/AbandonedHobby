module.exports = {
  plugins: ['import'],
  extends: [
    'next',
    'next/core-web-vitals',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  rules: {
    // Sort imports into groups
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',   // Node "fs", "path", etc
          'external',  // React, Next.js, etc
          'internal',  // Your aliases (like @/lib)
          ['parent', 'sibling', 'index'], // Relative imports
          'object',
          'type'
        ],
        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal'
          }
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        },
        'newlines-between': 'always'
      }
    ]
  }
};
