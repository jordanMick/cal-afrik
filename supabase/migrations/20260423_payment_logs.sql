-- ============================================================
-- TABLE : payment_logs
-- Rôle  : Source unique de vérité pour les paiements Maketou.
--         Chaque cart_id ne peut apparaître qu'UNE seule fois
--         avec status='processed' (idempotence garantie).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         TEXT NOT NULL UNIQUE,          -- ID panier Maketou (clé d'idempotence)
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier            TEXT NOT NULL,                 -- 'premium' | 'pro' | 'scan' | 'suggestion'
    status          TEXT NOT NULL DEFAULT 'processed', -- 'processed' | 'failed' | ...
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les lookups rapides par user et par cart
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id  ON public.payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_cart_id  ON public.payment_logs(cart_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Le service role (webhook, verify) peut tout faire
-- Les utilisateurs ne peuvent lire QUE leurs propres logs
CREATE POLICY "Users can read own payment logs"
    ON public.payment_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Seul le service role peut insérer/mettre à jour (le webhook tourne avec supabaseAdmin)
-- Pas de policy INSERT/UPDATE pour les users → sécurité renforcée

COMMENT ON TABLE public.payment_logs IS
    'Audit trail des paiements Maketou traités. cart_id UNIQUE garantit l''idempotence.';
