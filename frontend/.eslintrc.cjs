module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: false,
  },
  globals: {
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    fetch: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    FileReader: 'readonly',
    navigator: 'readonly',
    alert: 'readonly',
    window: 'readonly',
    document: 'readonly',
    console: 'readonly',
    Blob: 'readonly',
    URL: 'readonly',
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'off', // Browser globals are handled by globals config
  },
}

