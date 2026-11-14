# Local fixture accounts

These are intentionally documented development credentials, not runtime secrets or production accounts. Inspect current fixtures before login; use ordinary email/password login rather than Firebase sign-in. Never seed/reset a shared database just to restore a login.

| Email | Role | Password |
| --- | --- | --- |
| admin1@gmail.com | System Administrator | p@ssword01 |
| user1@gmail.com through user5@gmail.com | customer | p@ssword01 |
| customer1@example.test through customer10@example.test | customer | p@ssword01 |
| demo.admin@clemora.example.test | System Administrator | p@ssword01 |
| demo.ana@clemora.example.test | customer | p@ssword01 |
| demo.ben@clemora.example.test | customer | p@ssword01 |
| demo.camille@clemora.example.test | customer | p@ssword01 |
| demo.daniel@clemora.example.test | customer | p@ssword01 |
| demo.ella@clemora.example.test | customer | p@ssword01 |
| scenario.user001@clemora.example.test through scenario.user004@clemora.example.test | System Administrator | p@ssword01 |
| scenario.user005@clemora.example.test through scenario.user100@clemora.example.test | customer | p@ssword01 |

The session helper accepts only the `admin1`/`user1`–`user5` and `customer1`–`customer10` fixture addresses. Other documented fixtures can use normal local login. Read [database seed](../../../../docs/SEED.md) for current coverage, collisions, and insert-only rerun semantics; this account list does not establish current database contents.
