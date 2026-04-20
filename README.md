# Cal-Afrik

Cal-Afrik est une application web innovante de suivi nutritionnel et de planification de repas intégrant une intelligence artificielle ("Coach Yao") avec une spécialisation sur les habitudes alimentaires et les produits locaux ou africains (bien que très flexible).

Le projet utilise les dernières technologies web pour offrir une expérience utilisateur fluide, magnifique et réactive : un tableau de bord intuitif, des statistiques détaillées, et un coaching personnalisé basé sur l'IA.

## Fonctionnalités Principales

- **Dashboard & Journal Intégrés** : Suivi des calories quotidiennes avec un affichage clair (balance calorique). Gamification de l'expérience avec un système de flamme "Jours consécutifs" (streak).
- **Scanner Intelligent & "Coach Yao"** : Un assistant IA qui analyse vos repas, suggère des menus selon l'inventaire ("Pantry") et fournit des conseils diététiques précis. Les menus suggérés s'affichent via une interface en accordéon pour les différents moments de la journée.
- **Suivi du Poids (Weekly Chart)** : Visualisation hebdomadaire de la progression pour garder l'utilisateur motivé, avec invitations régulières à mettre à jour les données.
- **Notifications Push & Smart Alerts** : Notifications synchronisées (Heure UTC) au début de chaque repas pour rappeler de scanner, avec des alertes intelligentes conservées dynamiquement dans un centre de notifications.
- **Abonnement Premium (FedaPay)** : Intégration transparente pour des paiements directs et sécurisés via FedaPay. L'abonnement Premium débloque la génération de menus complets hebdomadaires et augmente les quotas de messages de l'IA (Pay-Per-Scan / Subscription model).
- **Profil & Sécurité** : Flux sécurisés via OTP pour le changement d'adresse e-mail ou via confirmation par code pour les paramètres sensibles (mot de passe).

## Stack Technique

- **Framework** : [Next.js](https://nextjs.org/) (Version 16 via l'App Router)
- **Styling** : [Tailwind CSS v4](https://tailwindcss.com/) & [Clsx](https://github.com/lukeed/clsx) / [Tailwind Merge](https://github.com/dcastil/tailwind-merge)
- **Animations & Icônes** : [Framer Motion](https://www.framer.com/motion/) et [Lucide React](https://lucide.dev/)
- **Gestion d'État** : [Zustand](https://zustand-demo.pmnd.rs/)
- **Base de données & Auth** : [Supabase](https://supabase.com/) & `@supabase/ssr`
- **Paiements** : [FedaPay API](https://fedapay.com/) (`fedapay` npm package)
- **IA (Coach Yao)** : Google Generative AI (Gemini) et SDK Anthropic (modèles hybrides ou fallback)
- **Scan & Autre** : `html5-qrcode` pour le fonctionnement de la caméra/scan, Web-Push pour les notifications.

## Prérequis

- **Node.js** (v18+ recommandé)
- Un compte **Supabase** (URL Base de données & Anon Key configurés en variables d'environnement)
- API Keys pour **Google Gemini** et/ou **Anthropic** (pour le module Coach Yao)
- Comptes pour **FedaPay** (Test et Live Keys)

## Installation & Lancement

1. **Cloner le projet ou installer les dépendances :**
   ```bash
   npm install
   ```

2. **Créer un fichier de configuration `.env.local`** à la racine et le remplir avec vos clés (voir `.env.example` si disponible) :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   GOOGLE_API_KEY=...
   FEDAPAY_SECRET_KEY=...
   NEXT_PUBLIC_FEDAPAY_PUBLIC_KEY=...
   # ... autres clés requises ...
   ```

3. **Lancer le serveur de développement :**
   ```bash
   npm run dev
   ```
   L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## Scripts Disponibles

- `npm run dev` : Lance le serveur en environnement de développement avec Hot-Reloading.
- `npm run build` : Compile l'application pour la production (optimisations de Next.js incluses).
- `npm run start` : Démarre l'application en mode production (requiert un `build` préalable).
- `npm run lint` : Exécute ESLint pour vérifier la propreté du code.

## Architecture

```text
/src
  /app        # Next.js App Router (pages: dashboard, scan, journal, profile, api routes)
  /components # Composants UI réutilisables (BottomNav, Modals, Charts, Coach)
  /lib        # Utilitaires (client Supabase, fonctions d'IA, formatage)
  ...
```

## Maintenance & Déploiement

Le déploiement est optimisé pour des plateformes comme **Vercel** ou **Netlify**, car c'est une application Next.js Full Stack. N'oubliez pas d'inclure toutes vos variables d'environnement, d'entrer vos clés publiques pour le service web-push (VAPID Keys) et de programmer les webhooks FedaPay si votre environnement change.
