/**
 * Test quality lint rules for liminal.
 *
 * These rules enforce patterns discovered during the test quality audit (Apr 2026).
 * Register them in .eslintrc.cjs via the `rulesdir` plugin.
 */
'use strict';

const path = require('path');

const requireViHoisted = require('./require-vi-hoisted');
const noWeakTestAssertions = require('./no-weak-test-assertions');

module.exports = {
  rules: {
    'require-vi-hoisted': requireViHoisted,
    'no-weak-test-assertions': noWeakTestAssertions,
  },
};
