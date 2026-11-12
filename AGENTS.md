# Project rules
- ERP domain rules (orders state machine, branch access `can`/`visibleBranchIds`) live as pure functions in src/lib/orders.ts and src/lib/erp.ts, tested in src/lib/*.test.ts; UI calls store wrappers only — so rules can move to a real backend later.
- Demo data is in-memory (src/lib/stock.ts, erp.ts, orders.ts, purchasing.ts); only the simulated user and branch filter persist in localStorage.
