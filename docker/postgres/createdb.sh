#!/bin/bash
export PGPASSWORD="${POSTGRES_PASSWORD:=stedi}"

# create a new database and a table for soketi
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:=postgres}" --dbname postgres <<-EOSQL
    SELECT 'CREATE DATABASE soketi'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'soketi')\gexec

    \c soketi;

    CREATE TABLE IF NOT EXISTS apps (
        id varchar(255) PRIMARY KEY,
        "key" varchar(255) NOT NULL,
        secret varchar(255) NOT NULL,
        max_connections integer NOT NULL,
        enable_client_messages smallint NOT NULL,
        "enabled" smallint NOT NULL,
        max_backend_events_per_sec integer NOT NULL,
        max_client_events_per_sec integer NOT NULL,
        max_read_req_per_sec integer NOT NULL,
        max_presence_members_per_channel integer DEFAULT NULL,
        max_presence_member_size_in_kb integer DEFAULT NULL,
        max_channel_name_length integer DEFAULT NULL,
        max_event_channels_at_once integer DEFAULT NULL,
        max_event_name_length integer DEFAULT NULL,
        max_event_payload_in_kb integer DEFAULT NULL,
        max_event_batch_size integer DEFAULT NULL,
        webhooks json,
        enable_user_authentication smallint NOT NULL
    );

    insert into apps (id, "key", secret, max_connections, enable_client_messages, enabled, max_backend_events_per_sec, max_client_events_per_sec,
                      max_read_req_per_sec, max_presence_members_per_channel, max_presence_member_size_in_kb, max_channel_name_length,
                      max_event_channels_at_once, max_event_name_length, max_event_payload_in_kb, max_event_batch_size, webhooks,
                      enable_user_authentication)
    values ('local', 'local_NcHSxk2PPwcxPYAT', 'local_DqvyFec+0rpF1hXUZ6gPVG4uyXAx4W7b', 1024, 1, 1, 1024, 128, 128, 1024, 4, 256, 1024, 256, 8, 8, '[]', 0)
    on conflict (id) do nothing;
EOSQL
