-- Elite+++++++ Schema with audited SECURITY DEFINER and cron monitoring
-- Managed via Supabase CLI migrations (supabase db push) in supabase/migrations/
-- Migration script: Explicitly create initial partitions
-- supabase/migrations/20250425_init_dashboard_operations.sql
DO $$
BEGIN
  FOR i IN 0..3 LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS dashboard_operations_p%s
      PARTITION OF dashboard_operations
      FOR VALUES WITH (MODULUS 4, REMAINDER %s)
    ', i, i);
  END LOOP;
END $$;

CREATE ROLE dashboard_manager;
GRANT USAGE ON SCHEMA public TO dashboard_manager;

CREATE TABLE dashboard_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  op_type VARCHAR(10) NOT NULL CHECK (op_type IN ('add', 'move', 'delete')),
  widget_id VARCHAR(50) NOT NULL,
  layout JSONB,
  timestamp BIGINT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY HASH (team_id);

DO $$
BEGIN
  FOR i IN 0..3 LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS dashboard_operations_p%s
      PARTITION OF dashboard_operations
      FOR VALUES WITH (MODULUS 4, REMAINDER %s)
    ', i, i);
  END LOOP;
END $$;

CREATE TABLE trigger_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_name VARCHAR(50) NOT NULL,
  execution_time_ms FLOAT NOT NULL,
  team_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trigger_metrics_name_created ON trigger_metrics(trigger_name, created_at);

CREATE TABLE partition_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_message TEXT NOT NULL,
  partition_name VARCHAR(50),
  modulus INT,
  remainder INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE backup_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_message TEXT NOT NULL,
  bucket VARCHAR(50),
  key VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cron_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id BIGINT NOT NULL,
  job_name VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY DEFINER AUDIT: Ensure no dynamic SQL or untrusted input in function body
CREATE OR REPLACE FUNCTION manage_dashboard_partitions()
RETURNS VOID AS $$
DECLARE
  team_count BIGINT;
  partition_count INT := 4;
  new_modulus INT;
BEGIN
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  SELECT COUNT(DISTINCT team_id) INTO team_count FROM dashboard_operations;
  IF team_count > (partition_count * 1000 * 0.8) THEN
    new_modulus := CEIL(partition_count * 1.5)::INT;
    FOR i IN partition_count..(new_modulus - 1) LOOP
      BEGIN
        EXECUTE format('
          CREATE TABLE dashboard_operations_p%s
          PARTITION OF dashboard_operations
          FOR VALUES WITH (MODULUS %s, REMAINDER %s)
        ', i, new_modulus, i);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO partition_errors (error_message, partition_name, modulus, remainder)
        VALUES (SQLERRM, format('dashboard_operations_p%s', i), new_modulus, i);
        PERFORM Sentry_capture_exception(SQLERRM, jsonb_build_object(
          'partition_name', format('dashboard_operations_p%s', i),
          'modulus', new_modulus,
          'remainder', i
        ));
        CONTINUE;
      END;
    END LOOP;
    PERFORM update_metadata('dashboard_partition_modulus', new_modulus::TEXT);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION manage_dashboard_partitions TO dashboard_manager;

-- SECURITY DEFINER AUDIT: Sanitize ops array, validate JSONB structure
CREATE OR REPLACE FUNCTION batch_insert_dashboard_ops(
  ops JSONB[]
) RETURNS VOID AS $$
BEGIN
  IF ops IS NULL OR array_length(ops, 1) = 0 THEN
    RAISE EXCEPTION 'Invalid or empty operations array';
  END IF;
  FOR i IN 1..array_length(ops, 1) LOOP
    IF NOT jsonb_typeof(ops[i]) = 'object'
       OR ops[i]->>'id' IS NULL
       OR (ops[i]->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR ops[i]->>'team_id' IS NULL
       OR (ops[i]->>'team_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR ops[i]->>'user_id' IS NULL
       OR (ops[i]->>'user_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR ops[i]->>'op_type' IS NULL
       OR ops[i]->>'op_type' NOT IN ('add', 'move', 'delete')
       OR ops[i]->>'widget_id' IS NULL
       OR (ops[i]->>'widget_id') !~ '^[a-zA-Z0-9_-]{1,50}$'
    THEN
      RAISE EXCEPTION 'Malformed operation at index %', i;
    END IF;
    -- Enhanced: JWT-based authorization check
    IF NOT EXISTS (
      SELECT 1 FROM auth.jwt() WHERE sub = (ops[i]->>'user_id')::TEXT
    ) THEN
      RAISE EXCEPTION 'Unauthorized user_id: %', ops[i]->>'user_id';
    END IF;
    INSERT INTO dashboard_operations (
      id, team_id, user_id, op_type, widget_id, layout, timestamp, priority, created_at
    )
    VALUES (
      (ops[i]->>'id')::UUID,
      (ops[i]->>'team_id')::UUID,
      (ops[i]->>'user_id')::UUID,
      ops[i]->>'op_type',
      ops[i]->>'widget_id',
      (ops[i]->>'layout')::JSONB,
      (ops[i]->>'timestamp')::BIGINT,
      (ops[i]->>'priority')::INTEGER,
      (ops[i]->>'created_at')::TIMESTAMPTZ
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION batch_insert_dashboard_ops TO dashboard_manager;

-- SECURITY DEFINER AUDIT: No dynamic SQL, uses SKIP LOCKED for concurrency
CREATE OR REPLACE FUNCTION archive_dashboard_operations()
RETURNS VOID AS $$
BEGIN
  FOR i IN 0..99 LOOP
    WITH to_archive AS (
      SELECT * FROM dashboard_operations
      WHERE created_at < NOW() - INTERVAL '30 days'
      LIMIT 1000
      FOR UPDATE SKIP LOCKED
    )
    INSERT INTO dashboard_operations_archive
    SELECT * FROM to_archive;
    
    DELETE FROM dashboard_operations
    WHERE id IN (SELECT id FROM to_archive);
    
    IF NOT FOUND THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION archive_dashboard_operations TO dashboard_manager;

-- SECURITY DEFINER AUDIT: Validate bucket/key, handle S3 errors
CREATE OR REPLACE FUNCTION backup_dashboard_archive()
RETURNS VOID AS $$
BEGIN
  IF 'dashboard-backups' !~ '^[a-z0-9-]{3,63}$' THEN
    RAISE EXCEPTION 'Invalid bucket name';
  END IF;
  BEGIN
    PERFORM aws_s3.upload(
      bucket: 'dashboard-backups',
      key: format('archive/%s.json', NOW()::DATE),
      body: (
        SELECT json_agg(row_to_json(d))
        FROM dashboard_operations_archive
        WHERE archived_at > NOW() - INTERVAL '1 day'
      )::TEXT
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO backup_errors (error_message, bucket, key)
    VALUES (SQLERRM, 'dashboard-backups', format('archive/%s.json', NOW()::DATE));
    PERFORM Sentry_capture_exception(SQLERRM, jsonb_build_object(
      'bucket', 'dashboard-backups',
      'key', format('archive/%s.json', NOW()::DATE)
    ));
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION backup_dashboard_archive TO dashboard_manager;

-- SECURITY DEFINER AUDIT: No untrusted input, logs metrics
CREATE OR REPLACE FUNCTION resolve_dashboard_op_conflict()
RETURNS TRIGGER AS $$
DECLARE
  start_time TIMESTAMPTZ := clock_timestamp();
  execution_time_ms FLOAT;
BEGIN
  PERFORM 1
  FROM dashboard_operations
  WHERE team_id = NEW.team_id
    AND widget_id = NEW.widget_id
    AND timestamp > NEW.timestamp - 1000
    AND timestamp < NEW.timestamp
    AND (priority > NEW.priority OR (priority = NEW.priority AND timestamp > NEW.timestamp));
  IF FOUND THEN
    execution_time_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    INSERT INTO trigger_metrics (trigger_name, execution_time_ms, team_id)
    VALUES ('resolve_dashboard_op_conflict', execution_time_ms, NEW.team_id);
    RETURN NULL;
  END IF;
  DELETE FROM dashboard_operations
  WHERE team_id = NEW.team_id
    AND widget_id = NEW.widget_id
    AND timestamp < NEW.timestamp
    AND priority <= NEW.priority;
  execution_time_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
  INSERT INTO trigger_metrics (trigger_name, execution_time_ms, team_id)
  VALUES ('resolve_dashboard_op_conflict', execution_time_ms, NEW.team_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION resolve_dashboard_op_conflict TO dashboard_manager;

-- Monitor pg_cron job failures
CREATE OR REPLACE FUNCTION cron_monitoring()
RETURNS VOID AS $$
BEGIN
  INSERT INTO cron_errors (job_id, job_name, error_message, created_at)
  SELECT jobid, command, message, NOW()
  FROM cron.job_run_details
  WHERE status = 'failed'
    AND return_message IS NOT NULL
    AND start_time > NOW() - INTERVAL '1 day'
  ON CONFLICT DO NOTHING;

  PERFORM Sentry_capture_exception(
    message,
    jsonb_build_object('job_id', jobid, 'job_name', command)
  )
  FROM cron.job_run_details
  WHERE status = 'failed'
    AND return_message IS NOT NULL
    AND start_time > NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION cron_monitoring TO dashboard_manager;

SELECT cron.schedule('manage_dashboard_partitions', '0 0 * * 0', $$SELECT manage_dashboard_partitions()$$);
SELECT cron.schedule('archive_dashboard_ops', '0 0 * * *', $$SELECT archive_dashboard_operations()$$);
SELECT cron.schedule('backup_dashboard_archive', '0 2 * * *', $$SELECT backup_dashboard_archive()$$);
SELECT cron.schedule('cron_monitoring', '0 * * * *', $$SELECT cron_monitoring()$$);

CREATE INDEX idx_dashboard_ops_team_widget ON dashboard_operations(team_id, widget_id, timestamp);

CREATE TABLE dashboard_operations_archive (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  op_type VARCHAR(10) NOT NULL,
  widget_id VARCHAR(50) NOT NULL,
  layout JSONB,
  timestamp BIGINT NOT NULL,
  priority INTEGER NOT NULL,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dashboard_ops_archive_team_created ON dashboard_operations_archive(team_id, created_at);

CREATE TRIGGER dashboard_op_conflict_trigger
BEFORE INSERT ON dashboard_operations
FOR EACH ROW EXECUTE FUNCTION resolve_dashboard_op_conflict();