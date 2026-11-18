# Plateforme Adjougbe

Site de l'écrivain Adjougbe : vente et lecture sécurisée des livres numériques, blog et punchline du jour, formations, formulaires et back-office.
Ce dépôt couvre le périmètre **V1.0 « Vendre et lire »** de la spécification fonctionnelle, avec une partie de V1.2 et V2.1 (avis, visuels de citation, offrir un livre, attestations vérifiables).

| Couche | Choix |
| --- | --- |
| API | Django 5.1 + Django REST Framework, sessions + CSRF, Argon2 |
| Front | React 19 + TypeScript + Vite + Tailwind CSS 4, React Router 7 |
| Base | PostgreSQL 16 (SQLite en développement local) |
| Paiement | CinetPay (Orange Money, MTN MoMo, Moov Money, Wave, carte) ; passerelle simulée en développement |
| Déploiement | Docker Compose : `db`, `backend` (Gunicorn), `scheduler`, `frontend` (Nginx) |

## Démarrer avec Docker

```bash
cp .env.example .env                 # mot de passe PostgreSQL, port HTTP
cp .env.docker.example .env.docker   # SECRET_KEY, CONTENT_ENCRYPTION_KEY, paiement, e-mails
docker compose up -d --build
docker compose exec backend python manage.py seed_demo      # données de démonstration (hors production)
# ou : docker compose exec backend python manage.py createsuperuser
```

Le site est alors sur http://localhost:8080 et le back-office sur http://localhost:8080/admin. À la première connexion, le back-office exige de configurer la double authentification (Google Authenticator ou équivalent).

Comptes de démonstration créés par `seed_demo` :
- administrateur : `admin@adjougbe.local` / `Adjougbe-Demo-2026!`
- lecteur : `lecteur@adjougbe.local` / `Lecteur-Demo-2026!`

> **Sauvegardez `CONTENT_ENCRYPTION_KEY`.** Le texte des livres est chiffré dans la base avec cette clé ; sans elle, il est illisible.

## Mettre en production (HTTPS)

Sur un serveur Linux avec Docker, une fois le nom de domaine pointé vers le serveur (ports 80 et 443 ouverts) :

```bash
cp .env.production.example .env          # puis séparer : variables compose dans .env, application dans .env.docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py load_content   # textes proposés (facultatif)
```

Caddy obtient et renouvelle automatiquement le certificat HTTPS. Le même fichier sert pour la recette (`ENVIRONMENT=staging`, paiement CinetPay en mode test) : le site de recette n'est pas indexé par les moteurs (`robots.txt`).

## Héberger sur Vercel

`vercel.json` déclare deux services dans un même projet : le front React (`frontend/`) et l'API Django (`backend/`), sur le même domaine. Différences avec Docker :

| Docker | Vercel |
|---|---|
| PostgreSQL dans un conteneur | Neon (Vercel Marketplace), `DATABASE_URL` ajoutée automatiquement |
| Fichiers sur disque | Fichiers en base (`FILE_STORAGE=database`, automatique sur Vercel), images servies par `/media/` et mises en cache par le CDN |
| Conteneur `scheduler` | GitHub Actions (`.github/workflows/scheduled.yml`) appelle `/api/cron/scheduled/` toutes les 10 min |
| Nginx sert les aperçus aux robots | Règle `user-agent` de `vercel.json` + `SharePreviewMiddleware` |
| Conteneur `backup` | Restauration à un instant donné de Neon |

Mise en place :
1. Vercel → **Storage** → créer une base **Neon** et la connecter au projet.
2. **Settings → Environment Variables** : copier les variables de `.env.vercel` (fichier local, non versionné) et renseigner `INITIAL_ADMIN_EMAIL`.
3. Redéployer. Le build (`backend/vercel_build.py`) applique les migrations, charge le catalogue et les textes de recette, et crée le compte administrateur : avec un envoi d'e-mails configuré (SMTP), un lien pour choisir le mot de passe est envoyé ; sinon, le mot de passe est pris dans la variable temporaire `DJANGO_SUPERUSER_PASSWORD`, à supprimer après le déploiement. Aucun lien ni mot de passe n'est écrit dans le journal du build.
4. GitHub → **Settings → Secrets and variables → Actions** : `SITE_URL` (ex. `https://adjougbe.vercel.app`) et `CRON_SECRET` (même valeur que sur Vercel).

Garde-fous : `PAYMENT_PROVIDER=simulated` est refusé quand `ENVIRONMENT=production` ; `seed_demo --catalog-only` ne crée aucun compte.

## Sauvegardes

Le conteneur `backup` sauvegarde chaque nuit à 3 h (heure d'Abidjan) la base, les médias et le contenu chiffré des livres dans `BACKUP_DIR` (par défaut `./backups`), avec 14 jours de rétention et des empreintes SHA-256.

```bash
docker compose exec backup sh /scripts/backup.sh                 # sauvegarde immédiate (avant chaque déploiement)
docker compose stop backend scheduler
docker compose run --rm backup sh /scripts/restore.sh 2026-11-18_0300
docker compose up -d backend scheduler
```

Copier régulièrement `BACKUP_DIR` hors du serveur (autre machine ou stockage objet), **avec** la clé `CONTENT_ENCRYPTION_KEY` conservée à part.

## Référencement et partage

- `sitemap.xml` et `robots.txt` sont générés par l'API.
- Quand un lien est partagé sur WhatsApp, Facebook, X ou Telegram, Nginx sert au robot une page d'aperçu avec le titre, la description et l'image de l'œuvre, de l'article ou de la formation (le visuel de la punchline pour une punchline du jour). Les œuvres portent des données structurées `Book`.

## Gestion du code

Branches `main` (production) et `develop` (intégration), une branche `feature/…` par fonctionnalité et `hotfix/…` pour les correctifs urgents. Chaque mise en production porte une étiquette (`v1.0.0`, `v1.1.0`…). L'intégration continue (`.github/workflows/ci.yml`) lance les tests de l'API, la compilation du front et la construction des images Docker.

## Documentation

- `docs/guide-studio.md` : guide d'utilisation du Studio pour Adjougbe.
- `docs/contenus-proposes.md` : textes proposés (biographie, œuvres, formations, articles, pages légales), à valider. Recharger avec `python manage.py load_content` ; régénérer le document avec `--export`.

## Développer sans Docker

```bash
# API (Python 3.11)
cd backend
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # DEBUG=1, PAYMENT_PROVIDER=simulated
.venv/bin/python manage.py migrate && .venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver

# Front (Node 22)
cd frontend
npm install && npm run dev    # http://localhost:5173, /api relayé vers :8000
```

Tests de l'API : `cd backend && .venv/bin/python manage.py test tests`.
En développement, les e-mails (vérification, reçus, rappels) s'affichent dans la console du serveur.

## Comment la lecture est protégée

1. Le texte des sections est **chiffré au repos** (Fernet) et n'est jamais envoyé au navigateur.
2. Le lecteur demande un **manifeste** : la liste des pages de la section, sous forme d'adresses **signées, valables 2 minutes et liées à la session**.
3. Chaque page est une **image WebP générée à la demande**, avec un **filigrane nominatif** (nom, e-mail, référence de commande) répété en diagonale, et un pied de page « Exemplaire personnel de… ».
4. Le front bloque sélection, clic droit, glisser-déposer, impression et raccourcis (Ctrl/Cmd + S, P, C) ; le contenu se floute quand l'onglet perd le focus.
5. **Deux appareils** au plus par compte : une nouvelle connexion ferme la plus ancienne.
6. Chaque page lue est journalisée (appareil, IP). Au-delà de 400 pages par heure, la lecture est suspendue et une alerte apparaît dans le back-office.

Comme le dit la spécification, une photo de l'écran reste possible : le but est de rendre la copie difficile, dissuasive et traçable.

## Paiement

- `PAYMENT_PROVIDER=simulated` : un écran permet de simuler un paiement réussi ou un échec. C'est la valeur pour le développement.
- `PAYMENT_PROVIDER=cinetpay` : renseigner `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` (mode test en recette, compte réel en production). L'URL de notification est `https://<domaine>/api/shop/payments/cinetpay/notify/`.
  L'accès n'est débloqué qu'après une **vérification côté serveur** auprès de CinetPay, jamais sur le simple retour du navigateur.

## Tâches planifiées

Le conteneur `scheduler` lance `manage.py run_scheduled` toutes les 10 minutes. Il envoie :
- une relance par e-mail pour chaque panier non payé depuis 24 h ;
- un rappel 24 h puis 1 h avant chaque session de formation.

## Import des livres

Dans le back-office, ouvrez **Œuvres → (une œuvre) → Contenu → Importer un fichier Word ou Excel**.
- Word ou texte : une section commence à chaque intertitre « Série 12 », « Série 12 : Titre » ou « Histoire 3 — Titre ».
- Excel : une ligne par section, avec les colonnes numéro, titre et texte.

Un aperçu du découpage s'affiche avant l'import. Corriger un texte crée une nouvelle édition, que tous les acheteurs voient aussitôt, sans perdre leur progression.

## Structure

```
backend/
  apps/accounts     comptes, 2FA, appareils, export et suppression des données
  apps/catalog      œuvres, sections chiffrées, packs, avis
  apps/shop         panier, commandes, codes promo, cadeaux, passerelles de paiement
  apps/reader       rendu des pages filigranées, progression, signets, journal d'accès
  apps/blog         articles, punchline du jour, commentaires, réactions, visuels de citation
  apps/trainings    formations, sessions, inscriptions, liste d'attente, attestations PDF
  apps/forms        générateur de formulaires et réponses
  apps/newsletter   abonnés, segments, envois
  apps/backoffice   API d'administration, exports CSV et Excel, import Word et Excel
  apps/core         paramètres du site, bannières, journal d'audit, chiffrement
frontend/src
  pages/            site public, bibliothèque, lecteur, compte
  admin/            back-office
```

## Design

L'interface suit les maquettes Claude Design du projet « Adjougbe » : le back-office « Studio » (fichiers *5 - Back-office v2* et *5b - Back-office v2 suite*), l'en-tête *Adj Nav* et le pied de page *Adj Footer2*.
- Couleurs : bleu `#2F68B7`, dégradé `#041C5C → #1560DC`, orange `#FF6B29`, encre `#0E0F13`, fond `#F5F7FA`.
- Polices : Poppins pour l'interface, Source Serif 4 pour la lecture et les punchlines. Les pages du lecteur et les visuels de partage sont rendus côté serveur avec les mêmes polices.
- Icônes : Flaticon UIcons (regular rounded).
- **Logos des moyens de paiement** : déposer les fichiers des maquettes (`assets/pay/*.png`) dans `frontend/public/pay/` sous les noms `orange_money.png`, `mtn_momo.png`, `moov_money.png`, `wave.png` et `card.png`. En leur absence, une pastille de couleur s'affiche.

Le site public suit les maquettes *1 - Accueil v4*, *2 - Pages publiques v2*, *3 - Compte et Achat v2* et *4 - Lecteur v2*, ainsi que les composants *Adj Header*, *Adj Page Hero* et *Adj Cover*.

Images de marque :
- `frontend/public/auteur-hero.webp` : photo détourée de l'auteur (1100 px de haut, 63 Ko), affichée sur l'accueil et la page À propos. L'original (1,6 Mo) est dans `docs/brand/auteur-original.png`. Pour la remplacer, réexporter une version WebP légère : le site vise moins de 3 s de chargement en 4G.
- `frontend/public/pay/<moyen>.png` : logos Orange Money, MTN MoMo, Moov Money, Wave et Visa.

## Points ouverts (spécification, section 24)

- Contenu réel des œuvres : les textes actuels sont des exemples de démonstration.
- Choix de la passerelle (CinetPay est intégré ; PayDunya et Paystack restent possibles) et ouverture du compte marchand.
- Prix définitifs, offres de lancement, CGU, politique de confidentialité et mentions légales (des textes provisoires sont en place, modifiables dans **Pages et bannières**).
- Service d'e-mails (Brevo ou Postmark : il suffit de renseigner les variables `EMAIL_*`).
- Connexion Google : définir `GOOGLE_CLIENT_ID`. L'API est prête, le bouton reste à ajouter côté front une fois l'identifiant obtenu.
