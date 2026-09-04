#!/bin/sh
set -e

# Migrate + seed are idempotent, so re-running them on every container start
# (even one per run-mode replica) is safe.
npm run db:migrate
npm run seed

exec npm start -- "$@"
