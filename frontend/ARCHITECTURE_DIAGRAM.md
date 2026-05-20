# Architecture Diagram - Django Backend Integration

## 1. Flux de Données Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS FRONTEND                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │  Pages React    │  │  Components UI   │  │  Forms/Inputs   │    │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘    │
│           │                    │                     │               │
│           └────────────────────┼─────────────────────┘               │
│                                │                                     │
│                         ┌──────▼──────┐                              │
│                         │   Hooks     │                              │
│                         │ useAuth()   │                              │
│                         │ useDash()   │                              │
│                         └──────┬──────┘                              │
│                                │                                     │
│                    ┌───────────┼───────────┐                         │
│                    │           │           │                         │
│            ┌───────▼───┐ ┌────▼──────┐ ┌─▼──────────┐              │
│            │ Services  │ │  DjangoAuth│ │ Auth Hooks │              │
│            │           │ │            │ │            │              │
│            │ Product   │ │ - login    │ │ - useAuth  │              │
│            │ Sales     │ │ - register │ │ - useUser  │              │
│            │ Dashboard │ │ - logout   │ │            │              │
│            └───────┬───┘ └────┬──────┘ └─┬──────────┘              │
│                    │          │          │                          │
│                    └──────────┼──────────┘                          │
│                               │                                     │
│                      ┌────────▼────────┐                            │
│                      │  DjangoClient   │                            │
│                      │  (API Handler)  │                            │
│                      │                 │                            │
│                      │ - get, post,    │                            │
│                      │   patch, delete │                            │
│                      │ - JWT handler   │                            │
│                      │ - Token refresh │                            │
│                      └────────┬────────┘                            │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                    HTTP Requests with JWT Token
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                      DJANGO BACKEND API                              │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Django REST Framework                                      │    │
│  │                                                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │    │
│  │  │  /login/    │  │ /products/  │  │  /dashboard/     │   │    │
│  │  │ /register/  │  │  /sales/    │  │  /magasins/      │   │    │
│  │  │   /me/      │  │ /totals/    │  │  /endpoints/     │   │    │
│  │  │ /approve/   │  │  /profit/   │  │                  │   │    │
│  │  │  /role/     │  │             │  │                  │   │    │
│  │  └─────┬───────┘  └─────┬───────┘  └────────┬─────────┘   │    │
│  │        │                │                   │               │    │
│  │        └────────────────┼───────────────────┘               │    │
│  │                         │                                   │    │
│  │                  ┌──────▼──────┐                            │    │
│  │                  │ Permissions │                            │    │
│  │                  │             │                            │    │
│  │                  │ - IsAdmin   │                            │    │
│  │                  │ - IsMagasin │                            │    │
│  │                  │ - IsEmployer│                            │    │
│  │                  │ - IsAuth    │                            │    │
│  │                  └──────┬──────┘                            │    │
│  │                         │                                   │    │
│  │                  ┌──────▼──────┐                            │    │
│  │                  │ Serializers │                            │    │
│  │                  │             │                            │    │
│  │                  │ Validation  │                            │    │
│  │                  │ Filtering   │                            │    │
│  │                  │ Masking     │                            │    │
│  │                  └──────┬──────┘                            │    │
│  └───────────────────────┬────────────────────────────────────┘    │
│                          │                                          │
│                   ┌──────▼──────┐                                   │
│                   │   Models    │                                   │
│                   │             │                                   │
│                   │ - User      │                                   │
│                   │ - Product   │                                   │
│                   │ - Sale      │                                   │
│                   │ - Magasin   │                                   │
│                   └──────┬──────┘                                   │
│                          │                                          │
│                   ┌──────▼──────┐                                   │
│                   │ PostgreSQL  │                                   │
│                   │ Database    │                                   │
│                   └─────────────┘                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flux d'Authentification JWT

```
┌────────────────────────────────────────────────────────────┐
│                    LOGIN FLOW                              │
└────────────────────────────────────────────────────────────┘

User enters email & password
              │
              ▼
   ┌─────────────────────┐
   │  POST /login/       │
   │  {username, passwd} │
   └────────────┬────────┘
                │
         Django validates
                │
    ┌───────────┴───────────┐
    │                       │
    ▼ (Valid)              ▼ (Invalid)
┌──────────────┐      ┌─────────────┐
│ Generate JWT │      │ Return 401  │
└──────┬───────┘      └─────────────┘
       │
       ▼
  Return:
  {
    "access": "eyJ...",
    "refresh": "eyJ..."
  }
       │
       ▼
Store in localStorage
       │
       ▼
GET /me/ with token
       │
       ▼
    Check is_confirmed
       │
   ┌───┴────┐
   │        │
   ▼        ▼
 true     false
   │        │
   ▼        ▼
Dashboard Pending

┌────────────────────────────────────────────────────────────┐
│              PROTECTED REQUEST FLOW                        │
└────────────────────────────────────────────────────────────┘

Any Protected Request
   (GET /products/, POST /sales/, etc.)
              │
              ▼
Include Token:
Authorization: Bearer <access_token>
              │
              ▼
    ┌─────────────────────┐
    │  Django validates   │
    │  JWT token          │
    └────────────┬────────┘
                 │
          ┌──────┴───────┐
          │              │
          ▼              ▼
      Valid?          Invalid?
          │              │
      ┌───┴───┐          ▼
      │       │      ┌─────────┐
      ▼       ▼      │Return   │
    Expired  Fresh   │401      │
      │      │       └────┬────┘
      │      │            │
      │      │            ▼
      │      │         Trigger
      │      │        Refresh
      │      │         Flow
      │      │
      ▼      ▼
   Check Permissions
     (Admin? Magasin?
      Employer?)
         │
    ┌────┴────┐
    │         │
    ▼ ✓       ▼ ✗
 Process   Return
 Request    403
    │
    ▼
Return Data
(with proper
 filtering &
 masking)

┌────────────────────────────────────────────────────────────┐
│             TOKEN REFRESH FLOW                             │
└────────────────────────────────────────────────────────────┘

Token Expired
    │
    ▼
Client detects 401
    │
    ▼
  POST /refresh/
  {refresh_token}
    │
    ▼
Django validates
refresh token
    │
  ┌─┴──┐
  │    │
  ▼    ▼
Valid Invalid
  │    │
  ▼    ▼
New   Return
Token 401
  │    │
  │    ▼
  │   Logout
  │   User
  ▼
Save new
token
  │
  ▼
Retry
Original
Request
```

---

## 3. Hiérarchie des Rôles et Permissions

```
┌──────────────────────────────────────────────────────────┐
│                    ROLE HIERARCHY                        │
└──────────────────────────────────────────────────────────┘

                    ┌──────────┐
                    │  ADMIN   │
                    │ (Level 3)│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
         Full Access   Can         Can
         to all data   Approve     Create
                       Accounts    Products
                            │
                            ▼
                      ┌────────────┐
                      │  MAGASIN   │
                      │ (Level 2)  │
                      └────┬───────┘
                           │
                ┌──────────┴─────────┐
                │                    │
                ▼                    ▼
           Only Own          Can Approve
           Store Data        Employees
                │
                ▼
          ┌────────────┐
          │  EMPLOYER  │
          │ (Level 1)  │
          └────┬───────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   Read Only    Create
   Products     Sales
   from own     from own
   store        store

┌──────────────────────────────────────────────────────────┐
│              PERMISSION MATRIX                           │
└──────────────────────────────────────────────────────────┘

                   Admin  Magasin  Employer
Products:
  - List all       ✓      Own      Own
  - Create         ✓      ✓        ✗
  - Update         ✓      ✗        ✗
  - Delete         ✓      ✗        ✗
  - See unit_price ✓      ✗        ✗

Sales:
  - List all       ✓      Own      Own
  - Create         ✓      ✓        ✓
  - View profit    ✓      Own      ✗
  - View totals    ✓      ✓        ✓

Users:
  - List all       ✓      Own      Own
  - Approve        ✓      ✓        ✗
  - Change role    ✓      ✗        ✗

Dashboard:
  - Full view      ✓      ✗        ✗
  - Store view     ✗      ✓        ✗
  - Personal view  ✗      ✗        ✓
```

---

## 4. Flux des Données par Rôle

```
┌─────────────────────────────────────────────────────────────┐
│         ADMIN VIEW - Voir Tout                              │
└─────────────────────────────────────────────────────────────┘

GET /products/
    │
    ▼
Return ALL products with:
├─ id, name, brand, category
├─ unit_price ✓ (visible)
├─ shell_price
├─ initial_quantity
├─ magasin info
└─ all fields

GET /dashboard/
    │
    ▼
KPIs:
├─ total_revenue
├─ total_profit
├─ total_stock_value
├─ total_magasins
├─ total_employers
├─ sales_today
├─ profit_today
└─ alerts

Lists:
├─ top_products
├─ bottom_products
├─ low_stock
├─ expired
├─ best_employees
└─ best_shops


┌─────────────────────────────────────────────────────────────┐
│     MAGASIN VIEW - Voir Son Magasin                         │
└─────────────────────────────────────────────────────────────┘

GET /products/
    │
    ▼
Return ONLY own store products:
├─ id, name, brand, category
├─ unit_price ✗ (hidden)
├─ shell_price ✓
├─ initial_quantity
├─ magasin = own store
└─ no sensitive data

GET /dashboard/
    │
    ▼
KPIs:
├─ sales_today (own store)
├─ profit_today (own store)
├─ stock_value (own store)
├─ total_products (own store)
├─ low_stock_count
└─ expired_count

Lists:
├─ top_products (own store)
├─ bottom_products (own store)
├─ low_stock (own store)
├─ recent_sales (own store)
└─ best_sellers (own store)


┌─────────────────────────────────────────────────────────────┐
│    EMPLOYER VIEW - Voir Son Magasin                         │
└─────────────────────────────────────────────────────────────┘

GET /products/
    │
    ▼
Return ONLY own store products:
├─ id, name, brand, category
├─ unit_price ✗ (hidden)
├─ shell_price ✓ (for reference)
├─ initial_quantity
├─ magasin = own store
└─ minimal access

GET /dashboard/
    │
    ▼
KPIs:
├─ my_sales_today
├─ total_amount_sold
├─ products_sold_count
└─ clients_count

Lists:
└─ recent_sales (own only)

POST /sales/
    │
    ▼
Create sale:
├─ product (own store)
├─ quantity (validated)
├─ sale_price
└─ auto-assign seller
```

---

## 5. Structure des Fichiers du Projet

```
project/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx ✏️ MODIFY
│   ├── register/
│   │   └── page.tsx ✏️ MODIFY
│   ├── logout/
│   │   └── page.tsx ✏️ MODIFY
│   ├── pending-approval/
│   │   └── page.tsx ✨ CREATE
│   └── (app)/
│       ├── dashboard/
│       │   └── page.tsx ✏️ MODIFY
│       ├── products/
│       │   └── page.tsx ✏️ MODIFY
│       ├── sales/
│       │   └── page.tsx ✏️ MODIFY
│       └── ...
│
├── components/
│   ├── auth/
│   │   ├── login-form.tsx ✏️ MODIFY
│   │   ├── register-form.tsx ✏️ MODIFY
│   │   ├── admin-guard.tsx ✏️ MODIFY
│   │   └── superadmin-guard.tsx ✏️ MODIFY
│   └── ...
│
├── lib/
│   ├── api/
│   │   ├── django-client.ts ✨ CREATE
│   │   └── endpoints.ts ✨ CREATE
│   │
│   ├── auth/
│   │   ├── django-auth.ts ✨ CREATE
│   │   ├── useCurrentUser.ts ✏️ MODIFY
│   │   └── ...
│   │
│   ├── services/
│   │   ├── products-service.ts ✨ CREATE
│   │   ├── sales-service.ts ✨ CREATE
│   │   └── dashboard-service.ts ✨ CREATE
│   │
│   ├── utils/
│   │   ├── token-manager.ts ✨ CREATE
│   │   └── error-handler.ts ✨ CREATE
│   │
│   └── supabase/
│       ├── client.ts ✗ DELETE/UNUSED
│       └── server.ts ✗ DELETE/UNUSED
│
├── hooks/
│   ├── useDjangoAuth.ts ✨ CREATE
│   └── ...
│
├── utils/
│   ├── supabase/
│   │   └── ... ✗ DELETE/UNUSED
│   └── ...
│
├── .env.local ✏️ MODIFY
├── .env.example ✏️ UPDATE
├── package.json (no changes needed)
├── next.config.mjs
│
├── ajouter.md ✨ CREATE (guide d'implémentation)
├── django-backend-integration.md ✨ CREATE (docs tech)
├── IMPLEMENTATION_SUMMARY.md ✨ CREATE (résumé)
├── QUICK_START.md ✨ CREATE (snippets)
└── ARCHITECTURE_DIAGRAM.md ✨ CREATE (ce fichier)

Legend:
✨ = CREATE NEW FILE
✏️ = MODIFY EXISTING FILE
✗ = DELETE/UNUSED
```

---

## 6. Séquence d'Intégration Recommandée

```
PHASE 1: Configuration (1-2 heures)
├─ 1. Créer .env.local avec NEXT_PUBLIC_DJANGO_API_URL
├─ 2. Créer lib/api/django-client.ts
└─ 3. Créer lib/api/endpoints.ts

PHASE 2: Authentification (3-4 heures)
├─ 4. Créer lib/auth/django-auth.ts
├─ 5. Créer hooks/useDjangoAuth.ts
├─ 6. Modifier lib/auth/useCurrentUser.ts
├─ 7. Modifier components/auth/login-form.tsx
├─ 8. Modifier components/auth/register-form.tsx
└─ 9. Créer app/pending-approval/page.tsx

PHASE 3: Services métier (2-3 heures)
├─ 10. Créer lib/services/products-service.ts
├─ 11. Créer lib/services/sales-service.ts
└─ 12. Créer lib/services/dashboard-service.ts

PHASE 4: Pages et composants (2-3 heures)
├─ 13. Modifier app/(app)/dashboard/page.tsx
├─ 14. Modifier app/(app)/products/page.tsx
├─ 15. Modifier autres pages métier
└─ 16. Adapter guards et composants

PHASE 5: Validation et tests (1-2 heures)
├─ 17. Tests de login/register
├─ 18. Tests des permissions
├─ 19. Tests du dashboard
└─ 20. Tests des alertes

Total estimé: 9-15 heures

Dependencies:
Phase 1 ──┐
Phase 2 ──┼─► Phase 3 ──┐
          │             ├─► Phase 4 ──┐
          └──────────────┘             ├─► Phase 5
                                       │
All phases independent once Phase 1 complete
```

---

## 7. Matrice de Modification des Fichiers

```
┌──────────────────────────┬─────────┬────────┬──────────┐
│ Fichier                  │ Create  │ Modify │ Priority │
├──────────────────────────┼─────────┼────────┼──────────┤
│ lib/api/django-client.ts │   ✓     │        │    1     │
│ lib/api/endpoints.ts     │   ✓     │        │    1     │
│ lib/auth/django-auth.ts  │   ✓     │        │    2     │
│ lib/auth/useCurrentUser  │         │   ✓    │    2     │
│ hooks/useDjangoAuth.ts   │   ✓     │        │    2     │
│ app/login/page.tsx       │         │   ✓    │    3     │
│ app/register/page.tsx    │         │   ✓    │    3     │
│ app/pending-approval/    │   ✓     │        │    3     │
│ components/auth/*        │         │   ✓    │    3     │
│ lib/services/*           │   ✓     │        │    4     │
│ app/(app)/dashboard/     │         │   ✓    │    4     │
│ app/(app)/products/      │         │   ✓    │    4     │
│ .env.local               │         │   ✓    │    1     │
└──────────────────────────┴─────────┴────────┴──────────┘

Priority 1: Core API infrastructure
Priority 2: Authentication system
Priority 3: Login/Register flows
Priority 4: Business pages & services
```

---

## 8. Validation Checklist

```
AUTHENTIFICATION
├─ [ ] POST /login/ fonctionnelle
├─ [ ] POST /register/ fonctionnelle
├─ [ ] GET /me/ retourne les données
├─ [ ] Tokens sauvegardés correctement
├─ [ ] Token renouvellement automatique
└─ [ ] Logout supprime les tokens

PERMISSIONS
├─ [ ] Admin voir tous les produits + unit_price
├─ [ ] Magasin voir ses propres produits
├─ [ ] Employer voir ses produits + crée ventes
├─ [ ] Comptes non approuvés redirigés
└─ [ ] Erreurs 403 gérées correctement

DONNÉES
├─ [ ] Products list filtrée par rôle
├─ [ ] Sales créées correctement
├─ [ ] Dashboard retourne données par rôle
├─ [ ] Stock décrémenté après vente
└─ [ ] Alertes produits expirés affichées

ERREURS
├─ [ ] 400 Bad Request gérées
├─ [ ] 401 Unauthorized gérées
├─ [ ] 403 Forbidden gérées
├─ [ ] 404 Not Found gérées
└─ [ ] Timeouts gérées

INTERFACE
├─ [ ] Formulaires fonctionnels
├─ [ ] Messages d'erreur clairs
├─ [ ] Loading states affichés
├─ [ ] Redirections correctes
└─ [ ] UX cohérente
```

---

## Notes Finales

- **Base URL Django:** `http://localhost:8000/api/users/`
- **Authentication:** JWT (Access + Refresh tokens)
- **Stockage tokens:** localStorage (ou sessionStorage pour plus de sécurité)
- **Gestion des erreurs:** Centralisée dans error-handler.ts
- **Filtrage données:** Côté backend (sécurité optimale)
- **Masquage données sensibles:** unit_price masqué pour non-admin

