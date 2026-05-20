# Dashboard Sécurisé Multi-Rôles - Documentation

## 🎯 Vue d'ensemble

Ce projet est un **système de gestion de stock multi-rôles** avec authentification JWT et des pages protégées par rôle. Chaque utilisateur voit uniquement les données et fonctionnalités autorisées selon son rôle.

## 🔐 Sécurité et Architecture

### Système d'authentification

- **JWT (JSON Web Tokens)** : Authentification basée sur tokens
- **Tokens persistants** : Stockés dans localStorage avec refresh automatique
- **Validation côté client** : Protection des routes avec ProtectedRoute
- **Interception API** : Ajout automatique du token aux requêtes

### Rôles et Permissions

#### 👤 Admin
- **Accès complet** à tous les dashboards et données
- **Gestion des produits** : CRUD complet
- **Gestion des utilisateurs** : Approbation et gestion des rôles
- **Gestion des magasins** : Vue d'ensemble de tous les magasins
- **Analytics** : Données globales et per-magasin
- **Données sensibles visibles** : Prix d'achat (unit_price), bénéfices globaux

**Endpoints accessibles:**
- `/dashboard/` - Vue d'ensemble globale
- `/dashboard/admin/analytics` - Analyses détaillées
- `/dashboard/admin/products` - Gestion complète des produits
- `/dashboard/admin/sales` - Toutes les ventes
- `/dashboard/admin/users` - Gestion des utilisateurs
- `/dashboard/admin/stores` - Gestion des magasins

#### 🏪 Magasin (Gérant)
- **Accès limité** aux données de son magasin uniquement
- **Gestion des produits** : Voir ses produits uniquement
- **Gestion des employés** : Approuver les employés
- **Gestion des ventes** : Voir les ventes de son magasin
- **Analytics** : Données limitées au magasin
- **Données sensibles cachées** : Prix d'achat masqués, pas d'accès aux profits globaux

**Endpoints accessibles:**
- `/dashboard/` - Vue d'ensemble du magasin
- `/dashboard/magasin/analytics` - Analyses du magasin
- `/dashboard/magasin/products` - Produits du magasin
- `/dashboard/magasin/sales` - Ventes du magasin
- `/dashboard/magasin/employees` - Gestion des employés

#### 👨‍💼 Employer (Vendeur)
- **Accès très limité** : Consultation uniquement
- **Voir les produits** : Catalogue de son magasin
- **Enregistrer les ventes** : Ses transactions personnelles
- **Aucune modification** : Read-only sur les produits
- **Données personnelles** : Uniquement ses propres ventes

**Endpoints accessibles:**
- `/dashboard/` - Vue d'ensemble personnelle
- `/dashboard/employer/products` - Catalogue (lecture seule)
- `/dashboard/employer/sales` - Ses ventes + formulaire de création

## 📁 Structure du Projet

```
app/
├── page.tsx                          # Redirection vers dashboard
├── login/
│   └── page.tsx                      # Page de connexion
└── dashboard/
    ├── layout.tsx                    # Layout du dashboard + AuthProvider
    ├── page.tsx                      # Redirection intelligente par rôle
    ├── admin/
    │   ├── page.tsx                  # Dashboard admin
    │   ├── analytics/page.tsx         # Analyses détaillées
    │   ├── products/page.tsx          # Gestion des produits
    │   ├── sales/page.tsx            # Historique des ventes
    │   ├── users/page.tsx            # Gestion des utilisateurs
    │   └── stores/page.tsx           # Gestion des magasins
    ├── magasin/
    │   ├── page.tsx                  # Dashboard magasin
    │   ├── analytics/page.tsx         # Analyses du magasin
    │   ├── products/page.tsx          # Produits du magasin
    │   ├── sales/page.tsx            # Ventes du magasin
    │   └── employees/page.tsx        # Gestion des employés
    └── employer/
        ├── page.tsx                  # Dashboard employé
        ├── products/page.tsx         # Catalogue (lecture)
        └── sales/page.tsx            # Mes ventes + création

lib/
├── auth-context.tsx                  # Context d'authentification
├── protected-route.tsx               # Composant de protection des routes
└── api-client.ts                     # Client API avec intercepteurs

components/
├── dashboard-nav.tsx                 # Navigation dynamique par rôle
└── ui/                               # Composants shadcn/ui

.env.local                            # Configuration API
```

## 🔒 Mécanismes de Sécurité

### 1. **ProtectedRoute Component**
```tsx
<ProtectedRoute requiredRoles={['admin']}>
  <AdminDashboardContent />
</ProtectedRoute>
```
- Vérifie l'authentification avant de rendre le contenu
- Valide les rôles requis
- Redirige vers `/login` si non authentifié
- Redirige vers `/dashboard` si rôle insuffisant

### 2. **Auth Context**
- Gère l'état d'authentification globalement
- Stocke les tokens JWT dans localStorage
- Fournit les méthodes `login()`, `logout()`, `hasRole()`
- Hook `useAuth()` pour accéder à l'authentification

### 3. **API Client avec Intercepteurs**
- Ajoute automatiquement le token JWT à chaque requête
- Gère le renouvellement du token (refresh)
- Supprime les credentials en cas d'erreur 401

### 4. **Filtrage des Données Backend**
- L'API backend filtre également les données par rôle
- Les endpoints retournent uniquement les données autorisées
- Le prix d'achat (unit_price) est automatiquement masqué pour magasin/employer

## 🎨 Navigation Dynamique

La barre de navigation (DashboardNav) change selon le rôle:

**Admin:** 
- Accueil, Analyses, Produits, Ventes, Utilisateurs, Magasins

**Magasin:** 
- Accueil, Analyses, Produits, Ventes, Employés

**Employer:** 
- Accueil, Mes ventes, Produits

## 📊 Données et KPIs

### Dashboard Admin
- Chiffre d'affaires total
- Bénéfices totaux
- Valeur du stock (prix d'achat)
- Nombre de magasins, employés, produits, ventes
- Graphiques de ventes et bénéfices
- Top produits et magasins

### Dashboard Magasin
- Ventes du jour (montant)
- Profit du jour
- Valeur du stock (sa boutique uniquement)
- Nombre de produits et ventes
- Produits en stock faible et expirés
- Meilleurs vendeurs
- Graphiques ventes semaine

### Dashboard Employer
- Mes ventes du jour (compteur)
- Montant total vendu
- Nombre de produits vendus
- Liste des dernières ventes

## 🚀 Mise en Route

### Configuration
1. Définir `NEXT_PUBLIC_API_BASE_URL` dans `.env.local`
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users
```

2. Installer les dépendances:
```bash
pnpm install
```

3. Lancer le serveur de développement:
```bash
pnpm dev
```

### Flux de connexion
1. Utilisateur accède `/` → Redirigé vers `/login`
2. Entre ses identifiants (email/mot de passe)
3. Reçoit JWT tokens (access + refresh)
4. Redirigé vers `/dashboard` qui le renvoie à sa page spécifique selon rôle
5. Peut naviguer via la barre de navigation
6. Peut se déconnecter via le menu utilisateur

## 🔑 Fichiers Clés

### `lib/auth-context.tsx`
Gère l'état d'authentification avec:
- `AuthProvider` : Wrapper pour l'app
- `useAuth()` : Hook pour accéder à l'auth
- `User` interface : Structure de l'utilisateur

### `lib/protected-route.tsx`
Composant wrapper pour protéger les routes:
- Vérifie l'authentification
- Valide les rôles requis
- Affiche spinner pendant le chargement
- Redirige automatiquement

### `lib/api-client.ts`
Client Axios avec:
- Configuration de base URL
- Intercepteurs pour tokens
- Gestion du refresh token
- Fetcher pour SWR

### `components/dashboard-nav.tsx`
Navigation intelligente:
- Menu différent selon rôle
- Responsive (mobile + desktop)
- Menu utilisateur avec déconnexion
- Affiche le rôle de l'utilisateur

## 🛡️ Bonnes Pratiques Implémentées

✅ **JWT pour l'authentification** - Standard sécurisé  
✅ **Tokens dans localStorage** - Persistance entre sessions  
✅ **Intercepteurs API** - Injection automatique du token  
✅ **ProtectedRoute** - Validation côté client  
✅ **Filtrage backend** - Double protection  
✅ **Masquage des données sensibles** - Données confidentielles cachées  
✅ **Gestion d'erreurs** - Gestion des 401/403  
✅ **Responsive design** - Mobile-friendly  
✅ **SWR pour data fetching** - Cache et revalidation  
✅ **Navigation contextuelle** - Menu adapté au rôle  

## 🐛 Dépannage

### "Accès refusé" malgré les bons identifiants
- Vérifier que le compte est approuvé (`is_confirmed=true`)
- Vérifier le rôle de l'utilisateur
- Vérifier que l'endpoint API existe

### Tokens non envoyés
- Vérifier que localStorage contient `access_token`
- Vérifier la console pour les erreurs de requête
- Vérifier que `NEXT_PUBLIC_API_BASE_URL` est correct

### Redirection infinie
- Vérifier que l'API retourne l'utilisateur au login
- Vérifier que le token est valide
- Vérifier les logs backend

## 📝 Variables d'Environnement

```bash
# URL de l'API backend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users
```

## 🎓 Points Clés de Sécurité

1. **Jamais faire confiance au client seul** - L'API valide aussi les permissions
2. **Tokens sécurisés** - JWT avec expiration courte
3. **Masquage d'informations** - Données sensibles ne sont pas envoyées
4. **Gestion d'erreurs** - Pas de détails sensibles en cas d'erreur
5. **Déconnexion propre** - Suppression des tokens et redirection

---

**Créé avec ❤️ pour la gestion de stock sécurisée**
