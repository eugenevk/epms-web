# Migration plan qepms → epms-web

## Strategy

- **Same Firebase project** (`epms-fa759`) and existing data
- **qepms** (Quasar) stays in production until feature parity
- **epms-web** is frontend-only; deploy of rules/functions remains in `qepms`

## Phases

### Phase 1 — Scaffold (current)

- Vue 3 + Vite + TypeScript + Tailwind + Pinia
- Firebase Auth (login, auto-logout 15 min)
- Basic layout + dashboard placeholder

### Phase 2 — Companies

- List page (Firestore or Algolia)
- Detail/create/edit
- First `src/lib/companies.ts` domain module

### Phase 3 — Other entities

Suggested order:

1. Contacts
2. Opportunities (+ stages)
3. Products
4. RFP's (+ milestones, questions)
5. Tasks + Notes

### Phase 4 — Search & admin

- Custom Algolia layer (IDs → hydrate from Firestore)
- Reference lists (`lists` + `items`)
- Stages admin
- Excel import

## Data conventions (kept from qepms)

- `objectID`, `objectType`, `objectLabel` on searchable entities
- `{ id, objectLabel }` for relations
- `linkedObject` for tasks/notes
- Audit fields: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

## Backend changes (later, in qepms repo)

- Firestore security rules
- Algolia sync via Firestore `onWrite` triggers in `functions/index.js` (see epms-web `docs/ALGOLIA_SYNC.md`)
- Optional: roles via custom claims
