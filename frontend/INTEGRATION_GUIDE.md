# Guide d'Intégration API - Dashboard Sécurisé Multi-Rôles

## 📋 Vue d'ensemble

Ce guide explique comment intégrer le frontend Next.js avec le backend Django fourni.

---

## 🚀 Configuration Initiale

### 1. Variables d'environnement

Créez un fichier `.env.local` à la racine du projet:

```env
# URL de votre backend Django
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users/
```

### 2. Architecture API

Le dashboard utilise 5 catégories d'endpoints:

- **Authentication** - Login, refresh token
- **User Management** - Profil, approbation, rôles
- **Products** - CRUD produits (prix masqué selon le rôle)
- **Sales** - CRUD ventes, historique
- **Analytics** - Dashboard, statistiques

---

## 🔐 Authentification JWT

### Flux de connexion

1. L'utilisateur soumet email + mot de passe
2. L'API retourne `access_token` et `refresh_token`
3. Le frontend stocke les tokens dans `localStorage`
4. Chaque requête inclut `Authorization: Bearer {access_token}`

### Code d'exemple

```typescript
import { authAPI } from '@/lib/api-client';

// Connexion
const response = await authAPI.login('user@example.com', 'password123');
const { access, refresh } = response.data;

localStorage.setItem('access_token', access);
localStorage.setItem('refresh_token', refresh);

// Appel API protégé
const user = await authAPI.getMe(); // Token inclus automatiquement
```

### Refresh Token Automatique

Le client API gère automatiquement le refresh quand le token expire:

```typescript
// Si 401: le client refresh le token et retry la requête
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh automatique
      const refreshToken = localStorage.getItem('refresh_token');
      const newAccess = await axios.post(`${API_BASE_URL}/refresh/`, {
        refresh: refreshToken,
      });
      // Retry requête originale
    }
  }
);
```

---

## 📊 Endpoints Clés

### Authentication

```bash
# Login
POST /login/
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "refresh": "token...",
  "access": "token..."
}
```

### User Management

```bash
# Mon profil
GET /me/
Authorization: Bearer {access_token}

Response:
{
  "id": 1,
  "username": "user@example.com",
  "role": "admin",
  "is_confirmed": true
}

# Approuver un utilisateur (Admin/Magasin)
PUT /approve/{user_id}/

# Modifier un rôle (Admin seulement)
PUT /role/{user_id}/
{
  "role": "magasin"
}
```

### Products

```bash
# Lister les produits
GET /products/?magasin=1&category=Electronics
Authorization: Bearer {access_token}

Response: [
  {
    "id": 1,
    "name": "Product Name",
    "unit_price": 50.00,      # Masqué pour magasin/employer
    "shell_price": 75.00,
    "initial_quantity": 100,
    "magasin": 1
  }
]

# Créer un produit (Admin/Magasin)
POST /products/
{
  "name": "Product",
  "reference": "REF-001",
  "unit_price": 50.00,
  "shell_price": 75.00,
  "initial_quantity": 100,
  "alert_threshold": 10,
  "expiry_date": "2027-12-31"
}
```

### Sales

```bash
# Lister les ventes
GET /sales/?product=1&ordering=-sold_at
Authorization: Bearer {access_token}

Response: [
  {
    "id": 1,
    "product": 1,
    "quantity": 5,
    "sale_price": 100.00,
    "total_price": 500.00,
    "seller_name": "John Seller",
    "sold_at": "2026-05-20T14:30:00Z"
  }
]

# Créer une vente
POST /sales/
{
  "product": 1,
  "quantity": 5,
  "sale_price": 100.00
}

# Totaux et profits
GET /sales/totals/
GET /sales/profit/
```

### Analytics

```bash
# Dashboard personnalisé par rôle
GET /dashboard/
Authorization: Bearer {access_token}

Response:
{
  "role": "admin",
  "kpis": {
    "total_revenue": 50000.00,
    "total_profit": 12500.00,
    "low_stock_count": 8,
    ...
  },
  "lists": {
    "top_products": [...],
    "recent_sales": [...],
    "best_shops": [...]
  }
}

# Utilisateurs par magasin
GET /magasins/users/
```

---

## 🎯 Implémentation côté Frontend

### 1. Client API

Le fichier `lib/api-client.ts` fournit tous les endpoints groupés:

```typescript
// Authentication
authAPI.login(username, password)
authAPI.refresh(refresh_token)
authAPI.register(data)
authAPI.getMe()

// Users
userAPI.approve(userId)
userAPI.updateRole(userId, role)

// Products
productAPI.list(params)
productAPI.create(data)
productAPI.get(id)
productAPI.update(id, data)
productAPI.delete(id)

// Sales
salesAPI.list(params)
salesAPI.create(data)
salesAPI.get(id)
salesAPI.update(id, data)
salesAPI.delete(id)
salesAPI.getTotals()
salesAPI.getProfit()

// Analytics
analyticsAPI.getDashboard()
analyticsAPI.getMagazinsUsers()
```

### 2. Utilisation dans les composants

```typescript
'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { productAPI } from '@/lib/api-client';

export function ProductsList() {
  // Fetch avec SWR (cache + revalidation)
  const { data, error, isLoading } = useSWR('/products/', fetcher);

  if (isLoading) return <Spinner />;
  if (error) return <Alert>Erreur de chargement</Alert>;

  return (
    <div>
      {data?.map(product => (
        <div key={product.id}>
          {product.name} - {product.shell_price}€
        </div>
      ))}
    </div>
  );
}

// Pour les mutations
async function handleDelete(id: number) {
  try {
    await productAPI.delete(id);
    // Revalider SWR
    mutate('/products/');
  } catch (error) {
    console.error('Erreur suppression:', error);
  }
}
```

### 3. Protection des routes par rôle

```typescript
import { ProtectedRoute } from '@/lib/protected-route';

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminContent />
    </ProtectedRoute>
  );
}
```

---

## 🔄 Flux de données complet

```
┌─────────────┐
│   Login     │  POST /login/ → Obtenir tokens
└──────┬──────┘
       │
       v
┌─────────────────────────────┐
│ localStorage                │
│ - access_token              │
│ - refresh_token             │
└──────┬──────────────────────┘
       │
       v
┌─────────────────────────────┐
│  API Client (axios)         │
│ - Auto-injecte le token     │
│ - Auto-refresh si 401       │
└──────┬──────────────────────┘
       │
       v
┌─────────────────────────────┐
│  SWR (Data Fetching)        │
│ - Cache des réponses        │
│ - Revalidation auto         │
└──────┬──────────────────────┘
       │
       v
┌─────────────────────────────┐
│  Composants React           │
│ - Affichent les données     │
│ - Gèrent les mutations      │
└─────────────────────────────┘
```

---

## ✅ Checklist d'Intégration

- [ ] Variables d'environnement configurées
- [ ] Backend Django en cours d'exécution
- [ ] Page de login fonctionnelle
- [ ] Token correctement stocké après connexion
- [ ] Requêtes API incluent le token Authorization
- [ ] Refresh token automatique fonctionne
- [ ] Dashboard affiche les données réelles
- [ ] Filtres par rôle appliqués correctement
- [ ] Prix d'achat masqué pour magasin/employer
- [ ] Messages d'erreur affichés correctement

---

## 🧪 Test des Endpoints

### 1. Utiliser le testeur API intégré

```
http://localhost:3000/test-endpoints
```

Page interactive pour tester chaque endpoint avec requêtes préremplies.

### 2. Utiliser cURL

```bash
# Login
curl -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"password123"}'

# Lister les produits
curl -X GET http://localhost:8000/api/users/products/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Créer une vente
curl -X POST http://localhost:8000/api/users/sales/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product":1,"quantity":5,"sale_price":100.00}'
```

### 3. Utiliser Postman

Importez la collection Postman complète avec tous les endpoints.

---

## 🚨 Gestion des erreurs

### Codes d'erreur courants

| Code | Cause | Solution |
|------|-------|----------|
| 401 | Token invalide/expiré | Refresh automatique ou re-login |
| 403 | Accès refusé (rôle insuffisant) | Vérifier les permissions utilisateur |
| 400 | Données invalides | Valider les champs requis |
| 404 | Ressource introuvable | Vérifier l'ID |

### Exemple de gestion d'erreur

```typescript
try {
  const product = await productAPI.create(data);
  // Succès
} catch (error: any) {
  const message = error.response?.data?.detail || 
                 error.response?.data?.reference?.[0] ||
                 'Erreur lors de la création';
  
  setError(message);
  console.error('Erreur détails:', error.response?.data);
}
```

---

## 📈 Performance

### 1. Caching avec SWR

```typescript
// Les données sont cachées par défaut
const { data } = useSWR('/products/', fetcher);

// Revalidation manuelle après mutation
const { mutate } = useSWR('/products/', fetcher);
mutate(); // Réfetch les données
```

### 2. Pagination (à implémenter)

```typescript
// Query params pour pagination
const { data } = useSWR(`/products/?page=1&limit=20`, fetcher);
```

### 3. Filtrage côté serveur

```typescript
// Laisser le serveur filtrer
const { data } = useSWR('/products/?magasin=1&category=Electronics', fetcher);
```

---

## 🔐 Sécurité

### Bonnes pratiques implémentées

- ✅ JWT tokens (access + refresh)
- ✅ localStorage pour persistence
- ✅ Auto-refresh transparent
- ✅ Masquage de données sensibles (unit_price)
- ✅ Filtrage par rôle côté serveur
- ✅ Validation des permissions

### À faire côté backend

- HTTPS en production
- CORS correctement configuré
- Tokens avec expiration courte
- Refresh tokens sécurisés
- Rate limiting
- Input validation stricte
- SQL injection prevention (ORM)
- CSRF protection

---

## 🚀 Déploiement

### Variables d'environnement production

```env
# .env.production
NEXT_PUBLIC_API_BASE_URL=https://your-api.com/api/users/
```

### Build et déploiement

```bash
# Build
pnpm build

# Déployer sur Vercel
vercel deploy --prod
```

---

## 📞 Support & Dépannage

### Pages d'aide

- **API Docs**: `/api-docs` - Documentation complète
- **API Tester**: `/test-endpoints` - Testeur interactif
- **Dashboard**: `/dashboard` - Interface principale

### Logs utiles

```typescript
// Enable debugging
console.log("[v0] API Call:", url, method);
console.log("[v0] Response:", data);
console.log("[v0] Error:", error.response?.data);
```

---

## 📝 Notes d'implémentation

1. **Tokens**: Décodez le JWT pour extraire les infos utilisateur
2. **Filtrage**: Le serveur filtre déjà les données par rôle
3. **Permissions**: Vérifiez le rôle avant chaque action sensible
4. **Erreurs**: Les réponses d'erreur 400 incluent les détails des champs
5. **Dates**: Toutes les dates sont en ISO 8601 UTC

---

**Version**: 1.0  
**Dernière mise à jour**: 20/05/2026  
**Statut**: ✅ Production Ready
