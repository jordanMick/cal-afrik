-- Add promo_code to user_profiles for the referral/discount system
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS promo_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS dismissed_promo_date DATE;

-- Index for fast lookups on promo_code validation
CREATE INDEX IF NOT EXISTS idx_user_profiles_promo_code ON user_profiles (promo_code);
