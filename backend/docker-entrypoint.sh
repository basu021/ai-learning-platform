#!/bin/sh
set -e

echo "Syncing database schema with Prisma..."
npx prisma db push --accept-data-loss

echo "Starting application..."
exec "$@"
