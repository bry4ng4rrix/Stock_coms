# Guide d'Intégration API

## 🔗 Architecture de Communication

```
Frontend (Next.js)
    ↓
Auth Context (JWT Storage)
    ↓
API Client (axios + interceptors)
    ↓
Backend (Django REST API)
    ↓
Database
```

## 🌐 Configuration API

### URL de Base
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/users'
```

### Headers Automatiques
- `Content-Type: application/json`
- `Authorization: Bearer {token}` (ajouté automatiquement si présent)

---

## 🔑 Authentification

### 1. Login
**Endpoint:** `POST /login/`

**Request:**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Code:**
```typescript
const { access, refresh } = await api.post('/login/', {
  username: email,
  password: password,
});

localStorage.setItem('access_token', access);
localStorage.setItem('refresh_token', refresh);
```

### 2. Refresh Token
**Endpoint:** `POST /refresh/`

**Request:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Automatique:** Géré par intercepteur en cas d'erreur 401

### 3. Get Current User
**Endpoint:** `GET /me/`

**Response:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "email": "user@example.com",
  "role": "admin",
  "is_confirmed": true,
  "full_name": "John Doe"
}
```

**Code:**
```typescript
const { data: user } = useAuth();
// ou
const user = await api.get('/me/');
```

---

## 📊 Dashboard Data

### GET /dashboard/
Retourne les données adaptées au rôle de l'utilisateur

**Response Admin:**
```json
{
  "total_revenue": 15000.00,
  "total_profit": 5000.00,
  "total_stock_value": 8000.00,
  "total_stores": 5,
  "total_employees": 20,
  "total_products": 150,
  "total_sales": 450,
  "today_sales": 2500.00,
  "today_profit": 800.00,
  "low_stock_count": 12,
  "expired_products_count": 2,
  "expiring_soon_count": 5,
  "top_products": [...],
  "top_stores": [...],
  "sales_by_day": [...]
}
```

**Response Magasin:**
```json
{
  "today_sales": 500.00,
  "today_profit": 150.00,
  "total_stock_value": 2000.00,
  "total_products": 50,
  "total_sales": 100,
  "low_stock_count": 3,
  "expired_products_count": 1,
  "top_sellers": [...],
  "top_products": [...],
  "low_stock_products": [...],
  "weekly_sales": [...]
}
```

**Response Employer:**
```json
{
  "today_sales_count": 5,
  "today_sales_amount": 250.00,
  "total_products_sold": 25,
  "recent_sales": [...]
}
```

---

## 📦 Produits

### GET /products/
Liste les produits (filtrée par rôle)

**Query Parameters:**
- `search` : Recherche par nom/référence
- `category` : Filtrer par catégorie
- `magasin` : Filtrer par magasin (admin uniquement)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Produit A",
    "reference": "REF001",
    "category": "Électronique",
    "unit_price": 10.00,           // Admin uniquement
    "shell_price": 15.00,
    "initial_quantity": 50,
    "alert_threshold": 10,
    "expiry_date": "2025-12-31",
    "magasin": 1,
    "magasin_name": "Magasin A"
  }
]
```

### POST /products/
Créer un nouveau produit (Admin & Magasin)

**Request:**
```json
{
  "name": "Nouveau Produit",
  "reference": "REF002",
  "category": "Électronique",
  "unit_price": 12.00,
  "shell_price": 18.00,
  "initial_quantity": 100,
  "alert_threshold": 15,
  "expiry_date": "2025-12-31",
  "magasin": 1
}
```

### PUT /products/{id}/
Modifier un produit complet (Admin uniquement)

**PATCH /products/{id}/**
Modifier partiellement (Admin uniquement)

### DELETE /products/{id}/
Supprimer un produit (Admin uniquement)

---

## 🛒 Ventes

### GET /sales/
Liste les ventes (filtrées par rôle)

**Query Parameters:**
- `period` : today, week, month, year
- `magasin` : Filtrer par magasin
- `seller` : Filtrer par vendeur

**Response:**
```json
[
  {
    "id": 1,
    "product": 1,
    "product_name": "Produit A",
    "magasin": 1,
    "magasin_name": "Magasin A",
    "shop_name": "Magasin A",
    "seller": 5,
    "seller_name": "Jean Dupont",
    "quantity": 3,
    "sale_price": 15.00,
    "total_price": 45.00,
    "sold_at": "2025-05-20T14:30:00Z"
  }
]
```

### POST /sales/
Créer une vente (Authentifié)

**Request:**
```json
{
  "product": 1,
  "quantity": 3,
  "sale_price": 15.00
}
```

**Response:**
```json
{
  "id": 1,
  "product": 1,
  "magasin": 1,
  "shop_name": "Magasin A",
  "seller": 5,
  "seller_name": "Jean Dupont",
  "quantity": 3,
  "sale_price": 15.00,
  "total_price": 45.00,
  "sold_at": "2025-05-20T14:30:00Z"
}
```

**Code:**
```typescript
const formData = {
  product: 1,
  quantity: 3,
  sale_price: 15.00,
};

await api.post('/sales/', formData);
```

---

## 👥 Utilisateurs

### GET /magasins/users/
Liste des utilisateurs groupés par magasin

**Response:**
```json
[
  {
    "magasin_id": 1,
    "shop_name": "Magasin A",
    "manager": {
      "id": 2,
      "full_name": "Alice Martin",
      "email": "alice@example.com",
      "is_confirmed": true,
      "role": "magasin"
    },
    "employers": [
      {
        "id": 3,
        "full_name": "Bob Durand",
        "email": "bob@example.com",
        "is_confirmed": false,
        "position": "Vendeur",
        "role": "employer"
      }
    ]
  }
]
```

### PUT /approve/{user_id}/
Approuver un utilisateur (Admin & Magasin)

**Request:** Vide

**Response:**
```json
{
  "success": true,
  "message": "User approved successfully"
}
```

**Code:**
```typescript
await api.put(`/approve/${userId}/`);
```

### PUT /role/{user_id}/
Changer le rôle d'un utilisateur (Admin uniquement)

**Request:**
```json
{
  "role": "admin"
}
```

**Response:**
```json
{
  "id": 2,
  "username": "user@example.com",
  "old_role": "magasin",
  "new_role": "admin",
  "message": "Role updated successfully"
}
```

---

## 📈 Analyses

### GET /sales/totals/
Totaux de prix

**Response:**
```json
{
  "total_unit_price": 8000.00,
  "total_shell_price": 12000.00
}
```

### GET /sales/profit/
Calcul du bénéfice

**Response:**
```json
{
  "profit": 5000.00
}
```

---

## ⚠️ Gestion des Erreurs

### Erreurs Courantes

#### 401 Unauthorized
```json
{
  "detail": "Invalid token or token expired"
}
```
→ Déclenche refresh automatique du token

#### 403 Forbidden
```json
{
  "detail": "You don't have permission to perform this action"
}
```
→ Rôle insuffisant pour cette action

#### 400 Bad Request
```json
{
  "field_name": ["Error message"]
}
```
→ Validation échouée côté backend

### Gestion dans le Code
```typescript
try {
  const data = await api.get('/products/');
  return data;
} catch (error) {
  if (error.response?.status === 401) {
    // Token expiré - intercepteur s'en charge
  } else if (error.response?.status === 403) {
    // Permissions insuffisantes
    router.push('/dashboard');
  } else {
    console.error('Error:', error.response?.data);
  }
}
```

---

## 🔄 Flux Données avec SWR

### Exemple Simple
```typescript
const { data, error, isLoading, mutate } = useSWR('/products/', fetcher);

// Revalider les données
mutate(); // Refetch
```

### Exemple avec Création
```typescript
const { mutate } = useSWR('/sales/', fetcher);

// Après création
await api.post('/sales/', data);
mutate(); // Revalider la liste
```

### Exemple Optimiste
```typescript
const { mutate } = useSWR('/products/', fetcher);

// Mettre à jour l'UI immédiatement
mutate(newProduct, false); // false = pas de refetch

// Puis faire l'appel API
try {
  await api.post('/products/', newProduct);
  mutate(); // Revalider
} catch (error) {
  mutate(); // Revalider en cas d'erreur
}
```

---

## 🔐 Sécurité des Tokens

### Stockage
```typescript
localStorage.setItem('access_token', token);
localStorage.setItem('refresh_token', token);
```

### Récupération
```typescript
const token = localStorage.getItem('access_token');
```

### Ajout Automatique
L'intercepteur ajoute le token:
```typescript
headers.Authorization = `Bearer ${token}`;
```

### Suppression
```typescript
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
```

---

## 📋 Checklist d'Intégration

- [ ] URL API définie dans `.env.local`
- [ ] AuthProvider wraps l'application
- [ ] Login fonctionne et retourne les tokens
- [ ] `/me/` retourne l'utilisateur
- [ ] Tokens sont stockés dans localStorage
- [ ] Requêtes incluent le token
- [ ] Refresh token fonctionne en cas d'expiration
- [ ] Erreurs 401 rechargent le token
- [ ] Erreurs 403 redirectionnent vers `/dashboard`
- [ ] Les données sont filtrées par rôle
- [ ] Déconnexion supprime les tokens

---

## 🧪 Test des Endpoints

### Avec cURL
```bash
# Login
curl -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}'

# Get me (avec token)
curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get products
curl -X GET http://localhost:8000/api/users/products/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Avec Postman
1. Créer une collection
2. Ajouter les endpoints
3. Dans "Authorization" tab, sélectionner "Bearer Token"
4. Définir `{{token}}` comme variable
5. Utiliser "Pre-request Script" pour le login

---

## 🚀 Optimisations

### Caching avec SWR
```typescript
useSWR(key, fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000, // 1 minute
})
```

### Pagination (Future)
```typescript
const { data, mutate } = useSWR(`/products/?page=${page}`, fetcher);
```

### Offline Support (Future)
```typescript
// SWR peut servir le cache quand offline
```

---

## 📞 Support

Besoin d'aide pour l'intégration API ?

1. Vérifier les logs du navigateur (F12)
2. Vérifier les logs du backend
3. Vérifier les headers de réponse
4. Vérifier les CORS settings
5. Vérifier le token dans localStorage

---

**Happy coding! 🚀**
