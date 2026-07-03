#!/bin/bash
# force error if any command fails
set -e

# Load .env.docker file if it exists
if [ -f .env.docker ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Ignore lines starting with # and empty lines
        if [[ ! "$line" =~ ^\s*# ]] && [[ -n "$line" ]]; then
            # shellcheck disable=SC2163
            export "$line"
        fi
    done < .env.docker
fi

# Database details
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="${POSTGRES_USER:-stedi}"
DB_PASSWORD="${POSTGRES_PASSWORD:-stedipassword}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Function to run psql commands
run_psql() {
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p "$DB_PORT" -U "$DB_USER" -c "$1"
}

# Drop the database
echo "Dropping database $DB_NAME..."
run_psql "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE);"

# Create the database
echo "Creating database $DB_NAME..."
run_psql "CREATE DATABASE $DB_NAME;"

# remove existing migrations
echo "Removing existing migrations..."
rm -rf prisma/migrations/*

# Create the initial migration
npx prisma migrate dev --name init

# Run migrations
prisma migrate deploy

# Generate Prisma client
npm run db:generate

# Seed the database
echo "Seeding the database..."
npm run db:seed

echo "Database reset complete."
