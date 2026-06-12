# epms-web

Nieuwe frontend voor **Eus Presales Management System** (Vue 3, TypeScript, Tailwind).  
De bestaande [qepms](https://github.com/eugenevk/qepms) Quasar-app blijft productie; deze repo wordt stap voor stap uitgebouwd.

## Vereisten

- Node.js 18+
- Firebase-project `epms-fa759` (zelfde als qepms v1)

## Snel starten

```bash
cp .env.example .env
# Vul Firebase-keys in (.env staat in .gitignore)

npm install
npm run dev
```

Open http://localhost:5173 — log in met je bestaande Firebase-gebruiker.

## Scripts

| Commando | Beschrijving |
|----------|--------------|
| `npm run dev` | Ontwikkelserver |
| `npm run build` | Productie-build |
| `npm run preview` | Build lokaal testen |

## Roadmap

1. **Fase 1** — Login + layout (huidige scaffold)
2. **Fase 2** — Companies (lijst + detail)
3. **Fase 3** — Overige entiteiten (contacts, opportunities, rfps, …)
4. **Fase 4** — Algolia-zoeklaag + admin (lists, stages)

Zie [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).
