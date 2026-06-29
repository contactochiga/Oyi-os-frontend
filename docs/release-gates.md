# Consumer Release Gates

## Before Staging

- lint, typecheck, build
- backend compatibility verified
- `npm run validate:release`

## Before Production

- staging smoke complete
- auth/session verified
- runtime-backed home and devices flows verified

## Blockers

- failing build or typecheck
- broken auth/session handling
- broken device sync or notification boot path
