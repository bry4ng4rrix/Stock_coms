# Checklist d'Implémentation - Django Backend Integration

Cette checklist guide l'intégration complète du backend Django avec le frontend Next.js.

## Phase 1: Configuration Frontend (Complétée ✓)

### Fichiers Modifiés
- [x] `lib/django-client.ts` - Client API complet avec gestion JWT
- [x] `lib/types.ts` - Types TypeScript pour tous les modèles
- [x] `lib/hooks/useAuth.ts` - Hook d'authentification réactif
- [x] `components/auth/login-form.tsx` - Formulaire de connexion Django
- [x] `components/auth/register-form.tsx` - Formulaire d'inscription Django
- [x] `app/auth/pending-approval/page.tsx` - Page d'attente d'approbation
- [x] `.env.example` - Configuration de l'API Django

### Fichiers Documentation
- [x] `DJANGO_BACKEND_README.md` - Guide complet pour Django
- [x] `IMPLEMENTATION_CHECKLIST.md` - Cette checklist

---

## Phase 2: Configuration Backend Django (À FAIRE)

### 2.1 Dépendances Python
```bash
pip install djangorestframework djangorestframework-simplejwt django-cors-headers
```

### 2.2 Modèles Django
Créer les modèles dans Django selon `DJANGO_BACKEND_README.md`:
- [ ] User (extension avec rôles)
- [ ] Store
- [ ] Product
- [ ] Sale
- [ ] Supplier

**Fichiers à créer:**
- [ ] `users/models.py`
- [ ] `stores/models.py`
- [ ] `products/models.py`
- [ ] `sales/models.py`
- [ ] `suppliers/models.py`

### 2.3 Serializers
Implémente les serializers selon `DJANGO_BACKEND_README.md`:
- [ ] `users/serializers.py` - UserSerializer, RegisterSerializer, LoginSerializer
- [ ] `products/serializers.py` - ProductSerializer
- [ ] `sales/serializers.py` - SaleSerializer
- [ ] `stores/serializers.py` - StoreSerializer
- [ ] `suppliers/serializers.py` - SupplierSerializer

### 2.4 Vues et ViewSets
Implémente les vues selon `DJANGO_BACKEND_README.md`:
- [ ] `users/views.py` - register, login, refresh_token, get_current_user
- [ ] `products/views.py` - ProductViewSet avec search
- [ ] `sales/views.py` - SaleViewSet avec revenue analytics
- [ ] `stores/views.py` - StoreViewSet
- [ ] `suppliers/views.py` - SupplierViewSet

### 2.5 Configuration Settings.py
- [ ] Ajouter les apps installées
- [ ] Configurer CORS_ALLOWED_ORIGINS
- [ ] Configurer JWT (SIMPLE_JWT)
- [ ] Configurer REST_FRAMEWORK
- [ ] Ajouter corsheaders middleware

### 2.6 URLs et Routing
- [ ] Créer `urls.py` avec les endpoints d'authentification
- [ ] Enregistrer les ViewSets avec DefaultRouter
- [ ] Tester les routes

### 2.7 Permissions Personnalisées
- [ ] `users/permissions.py` - IsAdmin, IsStoreManager, etc.

### 2.8 Migrations
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

---

## Phase 3: Tests d'Intégration (À FAIRE)

### 3.1 Tests Authentification

#### Test Register
```bash
POST /api/auth/register/
Body: {
  "email": "test@example.com",
  "username": "testuser",
  "password": "testpass123",
  "role": "employee"
}
Expected: 201 Created
```

#### Test Login
```bash
POST /api/auth/login/
Body: {
  "email": "test@example.com",
  "password": "testpass123"
}
Expected: 200 OK with access + refresh tokens
```

#### Test Current User
```bash
GET /api/auth/me/
Header: Authorization: Bearer {access_token}
Expected: 200 OK with user data
```

- [ ] Registration endpoint fonctionne
- [ ] Login endpoint retourne tokens
- [ ] Token refresh fonctionne
- [ ] Endpoints protégés rejettent sans token
- [ ] Endpoints protégés acceptent avec token valide

### 3.2 Tests Products
- [ ] GET /api/products/ retourne la liste
- [ ] POST /api/products/ crée un produit
- [ ] GET /api/products/{id}/ retourne les détails
- [ ] PUT/PATCH /api/products/{id}/ met à jour
- [ ] DELETE /api/products/{id}/ supprime

### 3.3 Tests Sales
- [ ] POST /api/sales/ crée une vente
- [ ] GET /api/sales/ retourne la liste
- [ ] GET /api/sales/revenue/ retourne les revenus
- [ ] Stock se décrémente automatiquement après vente

### 3.4 Tests Permissions
- [ ] Admin peut accéder à tous les endpoints
- [ ] Store Manager voit seulement son magasin
- [ ] Employee voit seulement son magasin
- [ ] Utilisateur non approuvé ne peut pas se connecter

---

## Phase 4: Configuration Frontend (À FAIRE)

### 4.1 Variables d'environnement
- [ ] Créer `.env.local`
- [ ] Ajouter `NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api`

### 4.2 Tests Frontend
- [ ] Formulaire de login fonctionne
- [ ] Formulaire de register fonctionne
- [ ] Page pending-approval s'affiche après registration
- [ ] Dashboard charge les données après login
- [ ] Logout efface les tokens

### 4.3 Intégration Pages Existantes
- [ ] Dashboard page utilise les nouveaux services
- [ ] Products page utilise djangoClient.products
- [ ] Sales page utilise djangoClient.sales
- [ ] User profile utilise les données actualisées

---

## Phase 5: Sécurité et Optimisation (À FAIRE)

### 5.1 Sécurité CORS
- [ ] CORS_ALLOWED_ORIGINS configuré correctement
- [ ] CORS_ALLOW_CREDENTIALS = True en production
- [ ] Tester les requêtes cross-origin

### 5.2 Sécurité JWT
- [ ] Access token expiration set to 1 hour
- [ ] Refresh token expiration set to 1 day
- [ ] Tokens stockés de manière sécurisée (localStorage)

### 5.3 Rate Limiting
- [ ] Implémenter rate limiting sur les endpoints auth
- [ ] Protéger les endpoints sensibles

### 5.4 Validation Input
- [ ] Valider tous les inputs côté serveur
- [ ] Messages d'erreur appropriés (pas de leaks d'info)

---

## Phase 6: Déploiement (À FAIRE)

### 6.1 Backend Django

#### Préparation
- [ ] SECRET_KEY généré aléatoirement
- [ ] DEBUG = False en production
- [ ] ALLOWED_HOSTS configuré
- [ ] Database en production (pas SQLite)
- [ ] Static files configurés
- [ ] Environment variables set

#### Déploiement
- [ ] Deployment sur serveur (Heroku, Railway, PythonAnywhere, etc.)
- [ ] Domaine configuré
- [ ] HTTPS activé
- [ ] CORS_ALLOWED_ORIGINS set to production domain

### 6.2 Frontend Next.js

#### Préparation
- [ ] `NEXT_PUBLIC_DJANGO_API_URL` set to production backend
- [ ] Build test: `npm run build`
- [ ] No console errors

#### Déploiement
- [ ] Deploy sur Vercel (recommandé)
- [ ] Domain configuré
- [ ] Environment variables set

### 6.3 Tests Production
- [ ] Registration fonctionne
- [ ] Login fonctionne
- [ ] Données se chargent correctement
- [ ] Pas de CORS errors
- [ ] Performance acceptable

---

## Phase 7: Documentation et Support (À FAIRE)

### 7.1 Documentation
- [ ] README.md du projet mis à jour
- [ ] Instructions de setup
- [ ] Troubleshooting guide
- [ ] API documentation

### 7.2 Training
- [ ] Team training sur la nouvelle architecture
- [ ] Documentation des roles et permissions
- [ ] Guides pour chaque rôle (Admin, Manager, Employee)

---

## Fichiers Modifiés Résumé

| Fichier | Statut | Description |
|---------|--------|-------------|
| `lib/django-client.ts` | ✓ Créé | Client API avec JWT |
| `lib/types.ts` | ✓ Créé | Types TypeScript |
| `lib/hooks/useAuth.ts` | ✓ Créé | Hook authentification |
| `components/auth/login-form.tsx` | ✓ Modifié | Django login |
| `components/auth/register-form.tsx` | ✓ Modifié | Django register |
| `app/auth/pending-approval/page.tsx` | ✓ Créé | Approbation page |
| `.env.example` | ✓ Modifié | Config Django |
| `DJANGO_BACKEND_README.md` | ✓ Créé | Guide complet Django |

---

## Points Importants

### Frontend
- Tous les appels API passent par `djangoClient`
- Tokens JWT stockés dans localStorage
- Token refresh automatique
- Gestion des erreurs 401 (token expiré)

### Backend
- Authentification par JWT (pas de sessions)
- Modèles avec rôles (admin, store_manager, employee)
- Approval flow pour nouveaux utilisateurs
- Permissions basées sur les rôles

### Déploiement
- URLs doivent être cohérentes (http/https)
- CORS doit être configuré
- Variables d'environnement correctes
- Tokens sécurisés (HTTPS en production)

---

## Checklist Final

### Avant Production
- [ ] Tous les tests passent
- [ ] No console errors
- [ ] No security warnings
- [ ] Performance acceptable
- [ ] Documentation à jour

### Après Déploiement
- [ ] Tester tous les flows utilisateur
- [ ] Monitor les erreurs
- [ ] Monitor les performances
- [ ] Supporter les utilisateurs

---

## Contacts et Support

- **Documentation:** `DJANGO_BACKEND_README.md`
- **Frontend Guide:** `README.md`
- **Issues:** Créer un issue sur le repository

---

**Dernière mise à jour:** 2024
**Status:** En cours de déploiement
