# Firebase security (epms-web)

Deployable rules live in the **qepms** repo (`src/server/firestore.rules` and `storage.rules`).

## Deploy

```bash
cd /Users/eugene.vankampen/Projects/qepms/src/server
firebase deploy --only firestore:rules,storage
```

## Admin claim

Admins have `{ "admin": true }` (or `role: "admin"`) in Firebase Auth custom claims.
Set with:

```bash
cd functions
npm run set-admin -- you@example.com
```

Then sign in again in epms-web.

## Firestore — epms-web

| Collection | Read | Write |
|------------|------|-------|
| `system` | Signed in | Admin only |
| `userSettings` | Own record (+ admin all) | Own profile fields (+ admin all) |
| Other CRM collections | Signed in | Signed in (legacy qepms) |

## Storage

| Path | Read | Write |
|------|------|-------|
| `avatars/{uid}/*` | Signed in | Own uid |
| `companies/*` | Signed in | Signed in |

The frontend hides admin UI, but real security is enforced in these rules.

## Algolia index sync

epms-web writes directly to Firestore; Algolia is updated by Cloud Functions (see [ALGOLIA_SYNC.md](./ALGOLIA_SYNC.md)).
