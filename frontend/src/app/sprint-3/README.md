# Sprint 3 File Structure

## Backend Structure
```
backend/
├── server-sprint3.js                    # Dedicated Sprint 3 backend server (port 4001)
├── lib/
│   └── sprint3/
│       ├── api.js                       # Sprint 3 API utilities
│       ├── resaleEngine.js             # Resale processing logic
│       ├── royaltyCalculator.js        # Royalty calculation engine
│       ├── blockchainMonitor.js        # Blockchain event monitoring
│       ├── marketplaceConnector.js     # External marketplace integrations
│       └── inheritanceManager.js       # Digital succession logic
└── database/
    └── migrations/
        └── sprint3/
            ├── 001_resale_events.sql
            ├── 002_royalty_distributions.sql
            ├── 003_blockchain_events.sql
            ├── 004_valuation_history.sql
            ├── 005_inheritance_plans.sql
            ├── 006_marketplace_integrations.sql
            ├── 007_webhook_logs.sql
            ├── 008_cashback_transactions.sql
            └── 009_proxy_assignments.sql
```

## Frontend Structure
```
frontend/src/app/sprint-3/
├── layout.tsx                           # Sprint 3 admin layout wrapper
├── metadata.ts                          # Global Sprint 3 metadata
│
├── resale-console/
│   ├── page.tsx                        # Main resale monitoring & actions
│   └── metadata.ts                     # Page metadata
│
├── royalty-engine/
│   ├── page.tsx                        # Royalty distribution management
│   └── metadata.ts                     # Page metadata
│
├── contract-logs/
│   ├── page.tsx                        # Blockchain event viewer
│   └── metadata.ts                     # Page metadata
│
├── external-marketplace/
│   ├── page.tsx                        # Third-party marketplace integrations
│   └── metadata.ts                     # Page metadata
│
├── product-valuation/
│   ├── page.tsx                        # Product value tracking & updates
│   └── metadata.ts                     # Page metadata
│
├── inheritance/
│   ├── page.tsx                        # Digital succession planning
│   └── metadata.ts                     # Page metadata
│
├── cashback-ledger/
│   ├── page.tsx                        # Cashback & rewards tracking
│   └── metadata.ts                     # Page metadata
│
├── proxy-tracker/
│   ├── page.tsx                        # Proxy assignments monitoring
│   └── metadata.ts                     # Page metadata
│
└── resale-traceability/
    ├── page.tsx                        # Full ownership history chain
    └── metadata.ts                     # Page metadata
```

## Frontend Library Structure
```
frontend/src/lib/
└── sprint3/
    ├── api.ts                          # Sprint 3 API client
    ├── types.ts                        # TypeScript interfaces
    ├── utils.ts                        # Utility functions
    └── constants.ts                    # Sprint 3 constants
```

## Key Points
- `server-sprint3.js` runs independently on port 4001
- All Sprint 3 backend utilities are isolated in `backend/lib/sprint3/`
- Each frontend module has its own folder with `page.tsx` and `metadata.ts`
- Database migrations are organized in `backend/database/migrations/sprint3/`
- Frontend utilities are separated in `frontend/src/lib/sprint3/`