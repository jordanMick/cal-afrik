const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
    console.log('🚀 Tentative d\'ajout de la colonne coach_advices_today...');
    
    // On passe par un RPC si disponible, sinon on utilise une ruse via un filtre sur une colonne inexistante 
    // Mais le plus simple avec Supabase JS est de tenter un select sur la colonne pour voir si elle existe
    const { error: checkError } = await supabase
        .from('user_profiles')
        .select('coach_advices_today')
        .limit(1);

    if (!checkError) {
        console.log('✅ La colonne existe déjà.');
        return;
    }

    console.log('📝 Ajout de la colonne via SQL...');
    // Note: Supabase JS ne permet pas d'exécuter du DDL direct sans extension. 
    // Je vais essayer de passer par une fonction RPC générique si elle existe, 
    // sinon je vais devoir te demander de l'ajouter manuellement dans le SQL Editor de Supabase.
    
    console.log('⚠️  Note : Si ce script échoue, merci d\'exécuter ceci dans ton SQL Editor Supabase :');
    console.log('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coach_advices_today INTEGER DEFAULT 0;');
}

addColumn();
