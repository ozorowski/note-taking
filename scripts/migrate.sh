#!/bin/bash

# This script applies all migrations from the migrations/ directory
# Usage: bash scripts/migrate.sh

set -e

# Try to find psql in common locations
if ! command -v psql &> /dev/null; then
  if [ -f /opt/homebrew/opt/postgresql@15/bin/psql ]; then
    export PSQL=/opt/homebrew/opt/postgresql@15/bin/psql
  elif [ -f /usr/local/bin/psql ]; then
    export PSQL=/usr/local/bin/psql
  else
    echo "Error: psql not found. Please install PostgreSQL."
    exit 1
  fi
else
  export PSQL=psql
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set"
  exit 1
fi

echo "Running migrations..."
echo "Database: $DATABASE_URL"

# Apply each migration file
for file in migrations/*.sql; do
  if [ -f "$file" ]; then
    echo "Applying $file..."
    $PSQL "$DATABASE_URL" -f "$file"
  fi
done

echo "Migrations completed!"
