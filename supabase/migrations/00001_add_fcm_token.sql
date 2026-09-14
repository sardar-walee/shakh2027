-- Add fcm_token to profiles safely
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

