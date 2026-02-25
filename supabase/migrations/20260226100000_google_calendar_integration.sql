-- Google Calendar integration: store event IDs for synced records
ALTER TABLE lead_activities
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
