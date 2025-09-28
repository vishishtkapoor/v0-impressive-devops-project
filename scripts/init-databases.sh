#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE users;
    CREATE DATABASE products;
    CREATE DATABASE orders;
    
    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE users TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE products TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE orders TO $POSTGRES_USER;
EOSQL

echo "Multiple databases created successfully!"
