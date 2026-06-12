# Migratieplan qepms → epms-web

## Strategie

- **Zelfde Firebase-project** (`epms-fa759`) en bestaande data
- **qepms** (Quasar) blijft productie tot feature-parity
- **epms-web** is frontend-only; deploy van rules/functions blijft in `qepms`

## Fasen

### Fase 1 — Scaffold (huidig)

- Vue 3 + Vite + TypeScript + Tailwind + Pinia
- Firebase Auth (login, auto-logout 15 min)
- Basis layout + dashboard placeholder

### Fase 2 — Companies

- Lijstpagina (Firestore of Algolia)
- Detail/create/edit
- Eerste `src/lib/companies.ts` domeinmodule

### Fase 3 — Overige entiteiten

Volgorde voorstel:

1. Contacts
2. Opportunities (+ stages)
3. Products
4. RFP's (+ milestones, questions)
5. Tasks + Notes

### Fase 4 — Zoeken & admin

- Custom Algolia-laag (IDs → hydrate uit Firestore)
- Reference lists (`lists` + `items`)
- Stages admin
- Excel import

## Dataconventies (behouden uit qepms)

- `objectID`, `objectType`, `objectLabel` op zoekbare entiteiten
- `{ id, objectLabel }` voor relaties
- `linkedObject` voor tasks/notes
- Auditvelden: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

## Backend-wijzigingen (later, in qepms-repo)

- Firestore security rules
- Algolia sync via `onWrite` triggers i.p.v. open REST proxy
- Optioneel: rollen via custom claims
