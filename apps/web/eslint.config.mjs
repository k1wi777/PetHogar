import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import base from '../../eslint.config.mjs';
import globals from 'globals';

const config = [
  ...base,
  ...nextVitals,
  ...nextTs,
  { ignores: ['e2e/.resultados/**'] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
];

export default config;
