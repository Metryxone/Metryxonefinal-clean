---
name: career_seeker_profiles schema
description: Primary key is user_id (not id), data column is JSONB, no id column at all.
---

## Rule
`career_seeker_profiles` uses `user_id` (VARCHAR) as its primary key — there is **no `id` column**.

Every SELECT, JOIN, and INSERT against this table must use `user_id`:
```sql
SELECT data FROM career_seeker_profiles WHERE user_id = $1
```

## Why
The table was created with `user_id` as the PK (foreign-keyed to `users.id`). Scripts and services that assumed `id` will get a `column "id" does not exist` error at runtime. This burned a backfill run in P-R6 and required an immediate hotfix.

## How to apply
- Any new service that reads career profiles → always use `WHERE user_id = $1`
- Any backfill/script → always `SELECT DISTINCT user_id FROM career_seeker_profiles`
- The `data` column is JSONB with profile payload; `completeness` (integer 0-100) and timestamps are top-level cols
