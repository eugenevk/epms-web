# Algolia sync (epms-web + Firebase)

## Why search can look stale

**epms-web** writes directly to Firestore. Search grids and global search read **Algolia**. If an index is out of date, results look wrong even though Firestore is correct.

Sync is **not** done from epms-web or from application code. It runs through the Firebase extension **Search Firestore with Algolia** (`firestore-algolia-search`) — one extension instance per Firestore collection.

## Setup: extension per collection

Install (or duplicate) the extension for each collection that epms-web searches. Index names must match the code.

| Firestore collection | Algolia index name | epms-web usage |
|----------------------|-------------------|----------------|
| `companies` | `companies` | Companies grid, global search |
| `contacts` | `contacts` | Contacts grid, global search |
| `notes` | `notes` | Notes grid, global search |
| `opportunities` | `opportunities` | Opportunities grid, global search |
| `rfps` | `rfps` | RFPs grid, global search |
| `tasks` | `tasks` | Tasks grid, global search |
| `products` | `products` | Products & Services → **Offered** |
| `productsInUse` | `productsInUse` | Products & Services → **In use**, global search |

### Install `products` and `productsInUse`

1. Firebase Console → **Extensions** → **Search Firestore with Algolia** → **Install** (twice — one instance per collection).
2. Use a **short instance ID** (≤ ~33 characters), e.g. `algolia-products` and `algolia-products-in-use`.
3. Per instance, set:

| Setting | `products` | `productsInUse` |
|---------|------------|-----------------|
| **Collection path** | `products` | `productsInUse` |
| **Index name** | `products` | `productsInUse` |
| **Algolia App ID** | Same as `VITE_ALGOLIA_APP_ID` | Same |
| **Algolia API key** | **Write** key (not the frontend search-only key) | Same |
| **Full index existing documents** | `true` on first install | `true` on first install |

4. Leave **Fields** empty (or default) so nested fields like `company.objectLabel` and `supplierCompany.objectLabel` are indexed.
5. After install, check **Extensions → instance → Logs** and Algolia → **Monitoring → API logs**.

### Algolia search-only API key (frontend)

In Algolia → **API Keys** → the key used as `VITE_ALGOLIA_SEARCH_KEY`, ensure these indices are **allowed** (in addition to your existing ones):

- `products`
- `productsInUse`

## Common issues

| Check | Details |
|-------|---------|
| **API key** | Extension needs a **write** key (`addObject`, `deleteObject`, …). Never put that key in epms-web `.env`. |
| **App ID** | Must match `VITE_ALGOLIA_APP_ID`. |
| **Collection path** | Exactly `products` or `productsInUse` — no leading slash. |
| **Index name** | Must match the table above. |
| **Instance ID length** | Long IDs break Cloud Tasks queue names. |
| **Database** | Extension only syncs the **(default)** Firestore database. |
| **Double indexing** | Do not also run Cloud Function `algoliaSync_*` triggers for the same collection — pick extension **or** functions, not both. |
| **Force Data Sync** | Enable in extension config if updates look delayed. |
| **Record size** | Large `description` fields may hit Algolia limits; check extension/API logs for 400 errors. |

## epms-web behaviour

- **Writes**: Firestore only (no Algolia calls from the browser).
- **Reads**: Algolia when `VITE_ALGOLIA_*` is set; falls back to Firestore when the index is empty and there is no active query/filter.
- A **non-empty but stale** index still wins over fresh Firestore — keep extensions healthy.

## Verify sync

1. Create or edit an offering in epms-web (**Products & Services → Offered**).
2. Firebase Console → **Extensions** → `algolia-products` → **View logs** (no errors).
3. Algolia dashboard → **Indices** → `products` → confirm the record.
4. Repeat for **In use** (`productsInUse` extension + index).

## Full re-index

Extensions only auto-sync **new writes** after install unless you run a full index.

1. Firebase Console → **Extensions** → open the instance.
2. **Reconfigure** → set **Full index existing documents** to `true` → save.
3. Or Google Cloud Console → **Cloud Tasks** → queue `ext-firestore-algolia-search-…-executeFullIndexOperation` → **Force a task run**.

To remove stale Algolia records that no longer exist in Firestore: clear that index in the Algolia dashboard, then run a full index again.

### Optional: Admin re-index UI / CLI

epms-web **Admin → Algolia re-index** and the qepms `reindex-algolia` script call a Cloud Function that writes directly to Algolia. Use that only if you rely on that path for other collections; if you use extensions everywhere, prefer extension full index instead.

## Products & Services — indexed fields

Documents written by epms-web include fields the search UI expects:

**`products` (offered):** `name`, `objectLabel`, `description`, `kind`, `objectType`, `company.id`, `company.objectLabel`

**`productsInUse`:** `name`, `objectLabel`, `description`, `version`, `kind`, `company`, `supplierCompany`

No extra mapping is required in epms-web; the extension mirrors Firestore documents to Algolia.
