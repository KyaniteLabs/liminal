const fs = require('fs');
const path = require('path');

const eslintConfigPath = path.join(__dirname, '.eslintrc.cjs');
const eslintConfig = require(eslintConfigPath);

// Add pattern to ignore files with spaces
eslintConfig.ignorePatterns.push('**/* 2.*');

fs.writeFileSync(eslintConfigPath, `/* eslint-env node */
'use strict';

module.exports = ${JSON.stringify(eslintConfig, null, 2)};
`);

console.log('Updated ESLint config to ignore files with spaces');
