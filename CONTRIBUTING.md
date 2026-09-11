# Contributing

Before opening a pull request:

```sh
npm test
npm run check
```

New mutations must include a postcondition test. New external-effect paths must define their receipt, reconciliation, cleanup, retry, and secret-redaction behavior before implementation.
