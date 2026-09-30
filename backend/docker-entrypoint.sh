#!/bin/sh
set -e

echo "Syncing database schema with Prisma..."
npx prisma db push

echo "Starting application..."
exec "$@"
