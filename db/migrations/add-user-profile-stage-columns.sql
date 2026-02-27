-- Run once if existing users table is missing the new profile stage columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_color_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_profile_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS style_recommendation_completed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET personal_color_completed = FALSE
WHERE personal_color_completed IS NULL;

UPDATE users
SET chat_profile_completed = FALSE
WHERE chat_profile_completed IS NULL;

UPDATE users
SET style_recommendation_completed = FALSE
WHERE style_recommendation_completed IS NULL;
