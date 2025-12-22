#!/bin/bash
# Apply schema update to production database
# Use this if you are getting "function increment_wins does not exist" errors

# Setup
export PGHOST=202.171.184.108
export PGUSER=postgres
export PGPASSWORD=your_password_here
export PGDATABASE=connect5

echo "Applying schema..."
psql -f postgres-schema.sql

echo "Done!"
