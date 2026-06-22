# OIS v1 Primitives

Phase 3C introduces reusable, token-backed primitives under `src/app/components/ois`:

- `OisCard`
- `OisStatusBadge`
- `OisDrawer`
- `OisListItem`
- `OisComposer`

They are presentational only: they do not fetch data, own routes, call Oyi, or encode product-specific business behavior. Import from the local `ois` barrel.

No Consumer screen is migrated in Phase 3C. Phase 3D migrates approved Facility components; Phase 3E migrates approved Consumer components.
