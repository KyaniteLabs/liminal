# Launch Warning Budget

Current budget target: zero launch-blocking lint errors, explicit ownership for warnings.

Public-demo disposition: demo-mitigated. The launch blocker is lint errors, not tracked warnings; warnings remain owned hardening debt and must not be described as fully cleaned up.

Current observed warning classes:

| Rule | Count | Owner | Launch Disposition |
| --- | ---: | --- | --- |
| `no-console` | 82 | Ledger CLI | Allowed only for CLI command output; convert to a scoped ESLint override or logger before tightening global budget. |
| `@typescript-eslint/require-await` | 11 | Module owners | Harden after launch unless tied to a user-visible async contract. |

Release gate remains `pnpm lint`: zero errors required. Warnings are tracked as hardening debt until the warning budget is formalized in ESLint config.
