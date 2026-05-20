# 📊 Stock Manager - Dashboard Multi-Rôles Sécurisé

Un système de gestion de stock **professionnel** avec **authentification JWT** et **contrôle d'accès granulaire** par rôle. Chaque utilisateur voit uniquement les données et fonctionnalités autorisées.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.2-blue?logo=tailwind-css)

---

## 🎯 Caractéristiques Principales

### 🔐 Sécurité
- ✅ Authentification JWT avec tokens
- ✅ Contrôle d'accès basé sur les rôles (RBAC)
- ✅ Protection des routes par rôle
- ✅ Filtrage des données par endpoint
- ✅ Masquage des données sensibles
- ✅ Refresh token automatique

### 👥 3 Rôles Distincts
1. **Admin** - Accès complet, gestion globale
2. **Magasin** - Gestion de son magasin uniquement
3. **Employer** - Consultation et ventes personnelles

### 📊 Dashboards Spécialisés
Chaque rôle a son propre dashboard avec des KPIs et visualisations adaptées

### 🎨 UI/UX Moderne
- Design responsive (mobile, tablet, desktop)
- Navigation intelligente par rôle
- Graphiques et visualisations Recharts
- Composants shadcn/ui
- Mode sombre/clair compatible

### 💾 Intégration API Complète
- Communication avec backend Django REST
- Gestion automatique des tokens
- Intercepteurs pour requêtes
- Caching avec SWR
- Gestion d'erreurs robuste

---

## 🏗️ Architecture

```
Dashboard Frontend (Next.js 16)
    ↓
Auth Context (JWT)
    ↓
Protected Routes (RBAC)
    ↓
API Client (Axios + Interceptors)
    ↓
Backend API (Django REST)
```

### Structure des Fichiers
```
app/
├── page.tsx                          # Redirection intelligente
├── login/                            # Authentification
└── dashboard/                        # Pages protégées
    ├── admin/                        # Dashboard Admin
    ├── magasin/                      # Dashboard Magasin
    └── employer/                     # Dashboard Employer

lib/
├── auth-context.tsx                  # Gestion authentification
├── protected-route.tsx               # Validation des rôles
└── api-client.ts                     # Client API

components/
├── dashboard-nav.tsx                 # Navigation adaptée
└── ui/                               # Composants shadcn
```

---

## 🚀 Démarrage Rapide

### Installation

```bash
# Cloner le projet
git clone <repository>
cd stock-manager

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec votre URL API
```

### Configuration

Éditer `.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users
```

### Lancer en développement

```bash
pnpm dev
```

Accéder à http://localhost:3000

### Build pour production

```bash
pnpm build
pnpm start
```

---

## 📋 Pages et Routes

### Public
- `/` - Redirection automatique
- `/login` - Formulaire de connexion

### Admin (`/dashboard/admin/...`)
- `/` - Dashboard global
- `/analytics` - Analyses détaillées
- `/products` - Gestion des produits (CRUD)
- `/sales` - Historique complet des ventes
- `/users` - Gestion des utilisateurs
- `/stores` - Gestion des magasins

### Magasin (`/dashboard/magasin/...`)
- `/` - Dashboard du magasin
- `/analytics` - Analyses du magasin
- `/products` - Produits du magasin
- `/sales` - Ventes du magasin
- `/employees` - Gestion des employés

### Employer (`/dashboard/employer/...`)
- `/` - Dashboard personnel
- `/products` - Catalogue (lecture)
- `/sales` - Mes ventes + création

---

## 🔒 Sécurité Implémentée

### Protection des Routes
```tsx
<ProtectedRoute requiredRoles={['admin']}>
  <AdminDashboard />
</ProtectedRoute>
```

### Authentification
- JWT dans localStorage
- Refresh token automatique
- Gestion des erreurs 401/403
- Déconnexion propre

### Sécurité des Données
- Filtrage backend + frontend
- Masquage du `unit_price` (prix d'achat)
- Isolation des données par magasin
- Validation des permissions à chaque requête

---

## 📊 KPIs par Rôle

### Admin
- Chiffre d'affaires total & du jour
- Bénéfices (visibles)
- Stock total & par magasin
- Nombre de magasins/employés/produits
- Alertes stock faible & expiration

### Magasin
- Ventes du jour (montant)
- Profit du jour (magasin)
- Valeur du stock (magasin)
- Meilleurs vendeurs
- Produits populaires & stock faible

### Employer
- Mes ventes du jour (compteur)
- Montant total vendu
- Nombre de produits vendus
- Dernières transactions

---

## 🛠️ Technologies

### Frontend
- **Next.js 16** - Framework React
- **React 19** - Librairie UI
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Composants
- **Recharts** - Graphiques
- **SWR** - Data fetching
- **Axios** - HTTP client

### Backend (Required)
- Django REST Framework
- JWT Authentication
- CORS Configuration
- Row-Level Security

---

## 🔧 Configuration Backend Requise

Le backend doit avoir:

### Authentification
- `POST /api/users/login/` - Retourne access + refresh tokens
- `POST /api/users/refresh/` - Renouvelle le token
- `GET /api/users/me/` - Profil utilisateur

### Dashboard
- `GET /api/users/dashboard/` - Données dynamiques par rôle

### Produits
- `GET/POST /api/users/products/`
- Filtrés par rôle (admin voit tout, magasin/employer voient leur magasin)
- `unit_price` masqué pour magasin/employer

### Ventes
- `GET/POST /api/users/sales/`
- Filtrées par magasin selon le rôle

### Utilisateurs
- `GET /api/users/magasins/users/` - Groupés par magasin
- `PUT /api/users/approve/{id}/` - Approbation

### CORS
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://yourdomain.vercel.app",
]
```

---

## 📚 Documentation Complète

- 📖 [Dashboard Documentation](./DASHBOARD_DOCUMENTATION.md) - Architecture & sécurité
- ✨ [Features](./FEATURES.md) - Fonctionnalités détaillées
- 🚀 [Deployment](./DEPLOYMENT.md) - Guide de déploiement

---

## 🧪 Tests

### Test de Sécurité
1. Accédez à `/dashboard/admin` sans token → Redirection vers `/login` ✅
2. Connectez-vous avec Magasin → Accès limité au magasin ✅
3. Vérifiez que les prix d'achat ne s'affichent pas ✅

### Test de Fonctionnalités
1. Admin : CRUD complet sur produits
2. Magasin : Approbation des employés
3. Employer : Enregistrement d'une vente

---

## 🚀 Déploiement

### Sur Vercel (Recommandé)
```bash
vercel deploy
```

Variables d'environnement à configurer:
```
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/users
```

Voir [Deployment Guide](./DEPLOYMENT.md) pour plus de détails.

---

## 📞 Dépannage

### "Accès refusé" malgré les bons identifiants
→ Vérifier que le compte est approuvé (`is_confirmed=true`)

### API non accessible
→ Vérifier CORS configuration et l'URL API dans `.env.local`

### Tokens non envoyés
→ Vérifier localStorage contient `access_token`

Voir [Documentation](./DASHBOARD_DOCUMENTATION.md) pour plus de solutions.

---

## 📝 Exemple de Flux Utilisateur

1. **Utilisateur se connecte**
   ```
   /login → Email + Password → JWT Tokens
   ```

2. **Redirection intelligente**
   ```
   /dashboard → Vérifier rôle → /dashboard/admin (ou magasin/employer)
   ```

3. **Navigation adapté au rôle**
   ```
   Admin voit: Analyses, Produits, Ventes, Utilisateurs, Magasins
   Magasin voit: Analyses, Produits, Ventes, Employés
   Employer voit: Mes ventes, Produits
   ```

4. **Voir les données protégées**
   ```
   Frontend → ProtectedRoute ✓ → API Client + JWT → Backend → Données filtrées
   ```

5. **Déconnexion**
   ```
   Clic Déconnexion → Suppression tokens → Redirection /login
   ```

---

## ✅ Checklist de Mise en Production

- [ ] Backend API déployé et testé
- [ ] CORS configuré correctement
- [ ] Variables d'environnement définies
- [ ] Tests des 3 rôles effectués
- [ ] Sécurité validée (pas d'accès non-autorisé)
- [ ] Formulaires testés
- [ ] Responsive design testé
- [ ] Gestion d'erreurs testée
- [ ] SSL/HTTPS activé
- [ ] Monitoring en place

---

## 📄 Licence

MIT

---

## 👨‍💻 Développement

Créé avec ❤️ pour la gestion de stock sécurisée.

**Contributions bienvenues !** 🚀

---

## 📧 Support

Besoin d'aide ? Vérifiez:
1. [Dashboard Documentation](./DASHBOARD_DOCUMENTATION.md)
2. [Features Guide](./FEATURES.md)
3. [Deployment Guide](./DEPLOYMENT.md)

---

**Prêt à gérer votre stock de manière sécurisée ?** 🎯

```bash
pnpm dev
```

😊 Bon développement !
