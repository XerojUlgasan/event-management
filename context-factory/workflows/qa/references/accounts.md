# Local fixture accounts

These are intentionally documented development credentials, not runtime secrets or production accounts. Inspect current fixtures before login; use ordinary email/password login rather than Firebase sign-in. Never seed/reset a shared database just to restore a login.

| Email | Role | Password |
| --- | --- | --- |
| admin1@gmail.com | System Administrator | p@ssword01 |
| user1@gmail.com through user5@gmail.com | customer | p@ssword01 |
| customer1@example.test through customer10@example.test | customer | p@ssword01 |
| demo.admin@amac.example.test | System Administrator | p@ssword01 |
| demo.ana@amac.example.test | customer | p@ssword01 |
| demo.ben@amac.example.test | customer | p@ssword01 |
| demo.camille@amac.example.test | customer | p@ssword01 |
| demo.daniel@amac.example.test | customer | p@ssword01 |
| demo.ella@amac.example.test | customer | p@ssword01 |
| scenario.user001@amac.example.test through scenario.user004@amac.example.test | System Administrator | p@ssword01 |
| scenario.user005@amac.example.test through scenario.user100@amac.example.test | customer | p@ssword01 |

The session helper accepts only the `admin1`/`user1`–`user5` and `customer1`–`customer10` fixture addresses. Other documented fixtures can use normal local login. Read [database seed](../../../../docs/SEED.md) for current coverage, collisions, and insert-only rerun semantics; this account list does not establish current database contents.
