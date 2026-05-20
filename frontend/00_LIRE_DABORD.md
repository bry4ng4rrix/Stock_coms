# 🎉 VêteMart - Système de Gestion des Stocks de Vêtements

## ⚡ Démarrage en 3 minutes

### Étape 1: Créer un projet Supabase gratuit
https://app.supabase.com → Créer un nouveau projet (attendre 10 min)

### Étape 2: Copier les clés Supabase
```
Settings → API
├─ Project URL → NEXT_PUBLIC_SUPABASE_URL
├─ Anon key → NEXT_PUBLIC_SUPABASE_ANON_KEY
└─ Service Role Key → SUPABASE_SERVICE_ROLE_KEY
```

### Étape 3: Créer `.env.local` et lancer
```bash
# Créer .env.local avec vos 3 clés Supabase

pnpm install         # Installer les dépendances
pnpm db:migrate      # Créer les tables
pnpm dev             # Lancer le serveur

# Ouvrir: http://localhost:3000
```

---

## ✨ Qu'est-ce que VêteMart?

Un **système complet de gestion de stocks** spécialisé pour les **vêtements**, avec:

✅ Gestion des produits (Hommes, Femmes, Enfants)  
✅ Tailles (S, M, XL, XXL)  
✅ **Images avec QR codes uniques** par produit  
✅ **Scanner QR codes** pour identification rapide  
✅ **Dashboard** avec 4 graphiques analytiques  
✅ **Alertes** de stock bas en temps réel  
✅ **Rapports** exportables (Excel/PDF)  
✅ Historique complet des mouvements  
✅ Gestion des fournisseurs  
✅ Gestion des utilisateurs  
✅ Notifications  

**Total: 50+ fonctionnalités** prêtes à l'emploi!

---

## 📚 Documentation Complète

| Document | Durée | Contenu |
|----------|-------|---------|
| **DEMARRAGE.txt** | 5 min | Guide de démarrage avec ASCII art |
| **INSTALLATION.md** | 10 min | Installation détaillée + dépannage |
| **FEATURES.md** | 15 min | Liste complète des 50+ features |
| **GUIDE_COMPLET.md** | 30 min | Guide utilisateur complet |
| **PROJECT_STRUCTURE.md** | 15 min | Architecture du projet |
| **TECH_CHANGES.md** | 20 min | Tous les changements techniquement |
| **DOCUMENTATION_INDEX.md** | 5 min | Index complet de la doc |

👉 **Commencer par:** DEMARRAGE.txt

---

## 🔑 Variables d'environnement obligatoires

Créer un fichier `.env.local` avec:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_anon_xxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Où les trouver:** Supabase Dashboard → Settings → API

⚠️ **NE JAMAIS** committer `.env.local` en git!

---

## 🛠️ Commandes essentielles

```bash
# Démarrage
pnpm install              # Installer dépendances
pnpm db:migrate          # Créer tables
pnpm dev                 # Serveur de développement
pnpm build               # Construire pour prod
pnpm start               # Lancer en production

# Base de données
pnpm db:migrate:status   # Voir statut migrations
pnpm db:seed             # Charger données d'exemple
pnpm db:reset            # Réinitialiser tout
```

---

## 📦 Stack technique

- **Frontend**: Next.js 14 + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)
- **QR Codes**: qrcode library
- **Charts**: Recharts
- **Excel**: xlsx library
- **Package Manager**: pnpm
- **Node**: 18+ LTS

---

## 🎯 Fonctionnalités principales

### Dashboard
- 4 graphiques analytiques
- Statistiques principales
- Alertes en temps réel

### Gestion des Vêtements
- Ajouter/modifier/supprimer
- Catégories: Homme, Femme, Enfant
- Tailles: S, M, XL, XXL
- **Images multiples par produit**
- **QR code unique par image**
- Historique des modifications

### Images et QR Codes
- Upload d'images
- Génération QR code automatique
- Scanner QR code (avec téléphone)
- Téléchargement QR codes
- Impression possible

### Alertes de Stock
- Seuil configurable
- Liste avec filtres
- Notifications en temps réel
- Export des alertes

### Rapports
1. Inventaire complet
2. Mouvements mensuels
3. Analyse de catégories
4. Fournisseurs
5. Stock par taille

Tous exportables en **Excel/PDF**

### Autres
- Mouvements de stock
- Fournisseurs
- Utilisateurs
- Notifications
- Paramètres

---

## 📊 Aperçu du projet

```
VêteMart
├── Dashboard (statistiques + charts)
├── Vêtements (gestion produits + images)
├── Alertes (stock bas)
├── Rapports (5 types d'exports)
├── Mouvements (historique)
├── Fournisseurs
├── Utilisateurs
├── Notifications
└── Paramètres
```

---

## 🚀 Déploiement

### Option 1: Vercel (Recommandé - gratuit)
1. Push sur GitHub
2. Connecter GitHub à Vercel
3. Ajouter les 3 variables d'env
4. Deploy! ✨

### Option 2: Autre plateforme
1. Construire: `pnpm build`
2. Lancer: `pnpm start`
3. Ajouter variables d'env

---

## ❓ Besoin d'aide?

### Installation
→ Consultez **INSTALLATION.md**

### Comment utiliser?
→ Consultez **GUIDE_COMPLET.md**

### Architecture technique?
→ Consultez **PROJECT_STRUCTURE.md**

### Liste complète des features?
→ Consultez **FEATURES.md**

### Tous les changements?
→ Consultez **TECH_CHANGES.md**

---

## ✅ Checklist

- [ ] Créer projet Supabase
- [ ] Copier les 3 clés API
- [ ] Créer .env.local
- [ ] Exécuter `pnpm install`
- [ ] Exécuter `pnpm db:migrate`
- [ ] Exécuter `pnpm dev`
- [ ] Ouvrir http://localhost:3000
- [ ] Tester l'application
- [ ] Ajouter vos premiers vêtements
- [ ] Scanner un QR code
- [ ] Exporter un rapport

---

## 🎁 Qu'est-ce que vous obtenez?

✅ Application complète et prête à l'emploi  
✅ Code source complet (Next.js + TypeScript)  
✅ Documentation exhaustive  
✅ Migrations SQL inclusos  
✅ Composants réutilisables  
✅ Design responsive (mobile/tablette/PC)  
✅ 50+ fonctionnalités  
✅ Authentification sécurisée  
✅ Base de données PostgreSQL  
✅ QR codes pour chaque image  
✅ Rapports exportables  
✅ Dashboard avec graphiques  

---

## 📞 Support

Tous vos besoins sont couverts dans la documentation:

- Installation → INSTALLATION.md
- Utilisation → GUIDE_COMPLET.md
- Développement → TECH_CHANGES.md
- Architecture → PROJECT_STRUCTURE.md
- Features → FEATURES.md

---

## 🎯 Prochaines étapes

1. **Maintenant**: Lire DEMARRAGE.txt
2. **5 min**: Créer projet Supabase
3. **10 min**: Configurer .env.local
4. **5 min**: Exécuter pnpm install && pnpm db:migrate && pnpm dev
5. **Puis**: Commencer à utiliser!

---

## 📝 Version

- **Projet**: VêteMart v1.0.0
- **Stack**: Next.js 14 + Supabase + shadcn/ui
- **État**: Production-ready ✅
- **License**: MIT

---

## 🎉 Bienvenue!

Vous avez maintenant un système complet de gestion de stocks de vêtements.

**Commencez maintenant:**
1. Lire DEMARRAGE.txt
2. Créer .env.local
3. Exécuter pnpm install
4. Exécuter pnpm db:migrate
5. Exécuter pnpm dev
6. Ouvrir http://localhost:3000

**Bon travail!** 🚀

---

*Besoin de clarifications? Consultez DOCUMENTATION_INDEX.md*
