---
name: Entitlement gate scope isolation
description: gateSessionEntitlement defined inside one exported function is not in scope for sibling exported functions in the same file.
---

# Entitlement Gate Scope Isolation

## Rule
`gateSessionEntitlement` is defined as a `const` inside `registerCapadexRoutes`. Any sibling exported function in the same file (e.g. `registerCapadexRecommendationsRoute`) that references it will throw `ReferenceError: gateSessionEntitlement is not defined` at startup.

## Fix
Each exported function that needs an entitlement gate must create its own local instance:
```typescript
export function registerCapadexRecommendationsRoute(app: Express, pool: Pool) {
  const gateSessionEntitlement = requireEntitlement(pool, { sessionParam: 'id' });
  // ...
}
```

**Why:** JavaScript module scope — a `const` inside a function body is not a module-level export; sibling functions have no access to it. The gate is a factory call (`requireEntitlement(pool, opts)`) so calling it a second time is safe — it returns the same middleware shape with the same pool and options.

**How to apply:** Any time you add an entitlement gate to a function that is NOT `registerCapadexRoutes`, add the local factory call at the top of that function.
