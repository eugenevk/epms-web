# epms-web

New frontend for **Eus Presales Management System** (Vue 3, TypeScript, Tailwind).  
The existing [qepms](https://github.com/eugenevk/qepms) Quasar app remains in production; this repo will be built out step by step.

## Requirements

- Node.js 18+
- Firebase project `epms-fa759` (same as qepms v1)

## Quick start

```bash
cp .env.example .env
# Add Firebase keys (.env is in .gitignore)

npm install
npm run dev
```

Open http://localhost:5174 — sign in with your existing Firebase user.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |

## Roadmap

1. **Phase 1** — Login + layout (current scaffold)
2. **Phase 2** — Companies (list + detail)
3. **Phase 3** — Other entities (contacts, opportunities, rfps, …)
4. **Phase 4** — Algolia search layer + admin (lists, stages)

See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).
