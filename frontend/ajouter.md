# Intégration Backend Django - Guide de Mise en Œuvre

## Vue d'ensemble

Ce document détaille toutes les modifications nécessaires pour remplacer l'authentification et la gestion des données **Supabase** par le backend **Django** avec authentification **JWT**.

**Base URL du Django Backend:** `http://localhost:8000/api/users/`

---

## 📋 Fichiers à Créer/Modifier

### 1. Configuration et Initialisation

#### Créer: `lib/api/django-client.ts`
- Client HTTP centralisé pour les appels API Django
- Gestion automatique des tokens JWT (access/refresh)
- Interception des erreurs et renouvellement de tokens
- Gestion du stockage sécurisé des tokens (localStorage ou cookies)

#### Créer: `lib/api/endpoints.ts`
- Énumération de tous les endpoints Django
- Types TypeScript pour les réponses API
- Validations avec Zod pour les données reçues

#### Modifier: `.env.local`
- `NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api/users`
- Supprimer: `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### 2. Authentification et Utilisateurs

#### Créer: `lib/auth/django-auth.ts`
Remplacer la logique Supabase par Django JWT:

**Fonctionnalités:**
- `login(email: string, password: string)` → POST `/login/` avec JWT
- `register(userData: RegisterData)` → POST `/register/`
- `refreshToken(refreshToken: string)` → POST `/refresh/`
- `getCurrentUser()` → GET `/me/`
- `logout()` → Supprimer les tokens localement

**Gestion des tokens:**
- Stocker `access_token` et `refresh_token` (en localStorage ou sessionStorage)
- Renouveler automatiquement `access_token` avant expiration
- Inclure `Authorization: Bearer <access_token>` dans tous les appels protégés

#### Modifier: `lib/auth/useCurrentUser.ts`
Remplacer:
```typescript
// Avant (Supabase)
const { data: { user: authUser } } = await supabase.auth.getUser();

// Après (Django)
const response = await djangoClient.get('/me/');
const authUser = response.data;
```

**Structure de réponse Django:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "email": "user@example.com",
  "role": "admin|magasin|employer",
  "is_confirmed": true
}
```

---

### 3. Pages d'Authentification

#### Modifier: `app/login/page.tsx` et `components/auth/login-form.tsx`
Changements:
- Remplacer l'appel `supabase.auth.signInWithPassword()` par `djangoAuth.login()`
- Vérifier `is_confirmed` avant d'autoriser l'accès (comptes en attente d'approbation)
- Stocker les tokens JWT après succès

#### Modifier: `app/register/page.tsx` et `components/auth/register-form.tsx`
Changements:
- Remplacer `supabase.auth.signUp()` par `djangoAuth.register()`
- Adapter les champs du formulaire:
  - Admin: `full_name`, `email`, `password`, `phone`, `company_name`
  - Magasin: `full_name`, `email`, `password`, `phone`, `shop_name`, `admin_email`
  - Employer: `full_name`, `email`, `password`, `phone`, `position`, `admin_email`

**Rôles disponibles:** `admin`, `magasin`, `employer`

#### Créer: `app/pending-approval/page.tsx`
Afficher un message si l'utilisateur est connecté mais `is_confirmed === false`:
```
"Votre compte est en attente d'approbation. Veuillez contacter votre administrateur."
```

---

### 4. Gestion des Produits

#### Créer: `lib/services/products-service.ts`
Encapsuler les appels API produits:

**Méthodes:**
- `getProducts(filters?: ProductFilters)` → GET `/products/`
- `getProduct(id: number)` → GET `/products/<id>/`
- `createProduct(data: ProductData)` → POST `/products/`
- `updateProduct(id: number, data: Partial<ProductData>)` → PATCH `/products/<id>/`
- `deleteProduct(id: number)` → DELETE `/products/<id>/`

**Points importants:**
- `unit_price` est masqué pour les rôles `magasin` et `employer`
- Pour `magasin`, le champ `magasin` est défini automatiquement
- Filtrage automatique par rôle

#### Modifier: `app/(app)/products/page.tsx`
- Remplacer les requêtes Supabase par `productsService`
- Adapter l'affichage (masquer `unit_price` si nécessaire)

---

### 5. Ventes et Analytiques

#### Créer: `lib/services/sales-service.ts`
Encapsuler les appels API ventes:

**Méthodes:**
- `getSales(filters?: SalesFilters)` → GET `/sales/`
- `getSale(id: number)` → GET `/sales/<id>/`
- `createSale(data: SaleData)` → POST `/sales/`
- `getTotals()` → GET `/sales/totals/`
- `getProfit()` → GET `/sales/profit/`
- `getUsers()` → GET `/magasins/users/`

**Formule profit:**
```
Profit = Revenu Total - Coût Total
Profit = Σ(sale_price × quantity) - Σ(product.unit_price × quantity)
```

#### Créer: `lib/services/dashboard-service.ts`
Encapsuler l'endpoint Dashboard unifié:

**Méthode:**
- `getDashboard()` → GET `/dashboard/`

**Réponse pour Admin:**
```json
{
  "role": "admin",
  "kpis": {
    "total_revenue": 50000.00,
    "total_profit": 12500.00,
    "total_stock_value": 125000.00,
    "total_magasins": 5,
    "total_employers": 20,
    "total_products": 150,
    "total_sales": 350,
    "sales_today": 25,
    "profit_today": 625.00,
    "low_stock_count": 8,
    "expired_count": 2,
    "expiring_soon_count": 12
  },
  "lists": {
    "top_products": [...],
    "bottom_products": [...],
    "low_stock_products": [...],
    "expired_products": [...],
    "expiring_soon_products": [...],
    "recent_sales": [...],
    "best_employees": [...],
    "best_shops": [...]
  }
}
```

**Réponse pour Magasin:**
```json
{
  "role": "magasin",
  "kpis": {
    "sales_today": 10,
    "profit_today": 250.00,
    "stock_value": 25000.00,
    "total_products": 50,
    "total_sales": 120,
    "low_stock_count": 3,
    "expired_count": 1
  },
  "lists": {
    "top_products": [...],
    "bottom_products": [...],
    "low_stock_products": [...],
    "recent_sales": [...],
    "best_sellers": [...]
  }
}
```

**Réponse pour Employer:**
```json
{
  "role": "employer",
  "kpis": {
    "my_sales_today": 5,
    "total_amount_sold": 2500.00,
    "products_sold_count": 50,
    "clients_count": 45
  },
  "lists": {
    "recent_sales": [...]
  }
}
```

#### Modifier: `app/(app)/dashboard/page.tsx`
- Remplacer les requêtes Supabase par `dashboardService.getDashboard()`
- Utiliser les KPIs retournés par l'endpoint

---

### 6. Composants et Hooks

#### Créer: `hooks/useDjangoAuth.ts`
Hook personnalisé pour la gestion JWT:

```typescript
export function useDjangoAuth() {
  const [tokens, setTokens] = useState<{ access: string; refresh: string } | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // login(email, password)
  // register(userData)
  // logout()
  // refreshAccessToken()
  // getAuthHeader() → { Authorization: `Bearer ${access_token}` }
}
```

#### Modifier: `components/auth/admin-guard.tsx`
Adapter à Django:
```typescript
// Avant
if (user?.role !== 'admin') { /* bloquer */ }

// Après
if (!user || user.role !== 'admin') { /* bloquer */ }
```

---

### 7. Utilitaires et Services

#### Créer: `lib/utils/token-manager.ts`
Gestion centralisée des tokens JWT:

**Fonctionnalités:**
- `setTokens(access: string, refresh: string)` → Stocker en localStorage
- `getAccessToken()` → Récupérer le token d'accès
- `getRefreshToken()` → Récupérer le token de rafraîchissement
- `clearTokens()` → Supprimer les tokens
- `isTokenExpired(token: string)` → Vérifier si expiré
- `shouldRefreshToken()` → Vérifier si renouvellement nécessaire

#### Créer: `lib/utils/error-handler.ts`
Gestion centralisée des erreurs API:

**Codes d'erreur Django:**
- 400: Validation échouée
- 401: Non authentifié / Token expiré
- 403: Pas de permission
- 404: Ressource non trouvée
- 500: Erreur serveur

---

## 🔄 Flux d'Authentification

### Connexion
1. Utilisateur soumet email + password
2. POST `/login/` → Reçoit `access_token` et `refresh_token`
3. Stocker les tokens localement
4. Vérifier `is_confirmed`
5. Rediriger vers dashboard si approuvé, sinon vers pending-approval

### Inscription
1. Utilisateur remplit le formulaire (rôle, email, password, etc.)
2. POST `/register/` → Reçoit message de succès
3. Compte créé mais non confirmé (`is_confirmed=false`)
4. Admin/Magasin doit approuver via PUT `/approve/<user_id>/`

### Accès à une Ressource Protégée
1. Inclure `Authorization: Bearer <access_token>` dans l'en-tête
2. Si 401 (Unauthorized):
   - POST `/refresh/` avec `refresh_token`
   - Obtenir nouveau `access_token`
   - Réessayer la requête originale

### Déconnexion
1. Supprimer les tokens locaux
2. Rediriger vers la page de connexion
3. (Optionnel) Le backend n'a pas besoin de l'être notifié

---

## 🔐 Sécurité

### Points critiques
1. **Toujours utiliser HTTPS** en production
2. **Ne jamais stocker les tokens en plain text**
3. **Vérifier l'expiration du token** avant utilisation
4. **Renouveler automatiquement** le token avant expiration
5. **Valider les réponses API** avec Zod

### Stockage des tokens
- **localStorage:** Pratique mais vulnérable aux XSS
- **sessionStorage:** Plus sécurisé, mais perdu à la fermeture du navigateur
- **HttpOnly Cookies:** Meilleur choix (gestion par proxy/middleware)

**Recommandation:** Utiliser un proxy middleware qui gère les cookies HttpOnly

---

## 🛠️ Intégration Étape par Étape

### Phase 1: Configuration de base
1. ✅ Créer `lib/api/django-client.ts`
2. ✅ Créer `lib/api/endpoints.ts`
3. ✅ Créer `.env.local` avec `NEXT_PUBLIC_DJANGO_API_URL`

### Phase 2: Authentification
4. ✅ Créer `lib/auth/django-auth.ts`
5. ✅ Modifier `lib/auth/useCurrentUser.ts`
6. ✅ Modifier `app/login/page.tsx` et formulaire de connexion
7. ✅ Modifier `app/register/page.tsx` et formulaire d'inscription
8. ✅ Créer `app/pending-approval/page.tsx`

### Phase 3: Services métier
9. ✅ Créer `lib/services/products-service.ts`
10. ✅ Créer `lib/services/sales-service.ts`
11. ✅ Créer `lib/services/dashboard-service.ts`

### Phase 4: Pages et composants
12. ✅ Modifier `app/(app)/products/page.tsx`
13. ✅ Modifier `app/(app)/dashboard/page.tsx`
14. ✅ Adapter toutes les pages utilisant les données

### Phase 5: Tests
15. ✅ Tester la connexion/inscription
16. ✅ Tester le renouvellement de token
17. ✅ Tester les permissions par rôle
18. ✅ Tester les alertes (produits expirés, stock faible)

---

## 📝 Variables d'Environnement

```env
# Django Backend
NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api/users

# À supprimer (Supabase)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 🧪 Tests d'Intégration

### 1. Test de Connexion Admin
```bash
curl -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com", "password":"password123"}'
```

### 2. Test d'Accès Protégé
```bash
curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Bearer <access_token>"
```

### 3. Test de Renouvellement de Token
```bash
curl -X POST http://localhost:8000/api/users/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<refresh_token>"}'
```

### 4. Test de Dashboard
```bash
curl -X GET http://localhost:8000/api/users/dashboard/ \
  -H "Authorization: Bearer <access_token>"
```

---

## 📊 Correspondance Supabase → Django

| Supabase | Django |
|----------|--------|
| `supabase.auth.signInWithPassword()` | POST `/login/` |
| `supabase.auth.signUp()` | POST `/register/` |
| `supabase.auth.getUser()` | GET `/me/` |
| `supabase.auth.signOut()` | Supprimer tokens localement |
| Table `users` | Endpoint `/users/` |
| Table `products` | Endpoint `/products/` |
| Table `sales` | Endpoint `/sales/` |
| Table `stores` | Endpoint `/magasins/` |
| JWT (Supabase) | JWT (Django) |
| RLS Policies | Permissions par rôle (backend) |

---

## ✅ Checklist de Validation

- [ ] Client API Django configuré
- [ ] Authentification JWT fonctionnelle
- [ ] Pages de connexion/inscription adaptées
- [ ] Gestion des comptes en attente d'approbation
- [ ] Services métier intégrés
- [ ] Dashboard avec données Django
- [ ] Permissions par rôle appliquées
- [ ] Alertes et notifications fonctionnelles
- [ ] Gestion des erreurs implémentée
- [ ] Tests d'extrémité réalisés

---

## 🚀 Déploiement

### Variables d'environnement de production
```env
NEXT_PUBLIC_DJANGO_API_URL=https://api.votredomaine.com/api/users
```

### Considérations CORS
Le backend Django doit autoriser les requêtes CORS du domaine frontend:
```python
# Django settings.py
ALLOWED_HOSTS = ['frontend.votredomaine.com']
CORS_ALLOWED_ORIGINS = [
    'https://frontend.votredomaine.com'
]
```

---

## 📞 Support

Pour toute question sur l'intégration, consultez les fichiers de documentation:
- `django-backend-integration.md` - Documentation technique détaillée
- `endpoint-D5635.md` - Spécifications complètes des endpoints
- `fonctionalite-ktrk1.md` - Fonctionnalités de l'application

