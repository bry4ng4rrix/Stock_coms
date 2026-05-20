# ⚡ Quick Start - Stock Manager Dashboard

## 🎯 5 Minutes pour Démarrer

### 1️⃣ Installation (1 minute)

```bash
# Cloner ou télécharger le projet
cd stock-manager

# Installer les dépendances
pnpm install
```

### 2️⃣ Configuration (1 minute)

Créer/éditer `.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users
```

> ⚠️ Remplacer avec votre URL API Django

### 3️⃣ Lancer (1 minute)

```bash
pnpm dev
```

Accéder à: **http://localhost:3000**

### 4️⃣ Se Connecter (1 minute)

À la page de login, utiliser:
- **Email**: `admin@example.com` (ou votre utilisateur)
- **Password**: Votre mot de passe

### 5️⃣ Naviguer (1 minute)

- **Admin** → Voit tous les dashboards
- **Magasin** → Voit son magasin uniquement
- **Employer** → Voit ses ventes

---

## 📁 Structure Simplifiée

```
app/
├── login/                    # Page de connexion
└── dashboard/
    ├── admin/               # 👤 Admin Dashboard
    ├── magasin/             # 🏪 Magasin Dashboard
    └── employer/            # 👨‍💼 Employer Dashboard

lib/
├── auth-context.tsx         # 🔐 Gestion auth
├── protected-route.tsx      # 🛡️ Protection routes
└── api-client.ts           # 🌐 API client

.env.local                   # ⚙️ Configuration
```

---

## 🔑 Points Clés

| Concept | Fichier | Rôle |
|---------|---------|------|
| **Authentification** | `lib/auth-context.tsx` | JWT tokens + user state |
| **Protection Routes** | `lib/protected-route.tsx` | RBAC validation |
| **API Client** | `lib/api-client.ts` | Axios + interceptors |
| **Navigation** | `components/dashboard-nav.tsx` | Menu by role |
| **Dashboards** | `app/dashboard/{role}/*` | Role-specific pages |

---

## 🔐 3 Rôles, 3 Accès

### 👤 Admin
- ✅ Accès complet
- ✅ CRUD produits
- ✅ Gestion utilisateurs
- ✅ Voir tous les magasins

### 🏪 Magasin
- ✅ Accès son magasin
- ✅ Produits du magasin
- ✅ Approuver employés
- ❌ Pas d'autres magasins

### 👨‍💼 Employer
- ✅ Voir catalogue
- ✅ Enregistrer ventes
- ❌ Pas de modification
- ❌ Accès restreint

---

## 📊 Pages Principales

### Admin (`/dashboard/admin/`)
```
/                    → Dashboard global
/analytics          → Graphiques détaillés
/products           → Gestion produits
/sales              → Historique ventes
/users              → Gestion utilisateurs
/stores             → Gestion magasins
```

### Magasin (`/dashboard/magasin/`)
```
/                    → Dashboard magasin
/analytics          → Graphiques magasin
/products           → Produits magasin
/sales              → Ventes magasin
/employees          → Gestion employés
```

### Employer (`/dashboard/employer/`)
```
/                    → Dashboard personnel
/products           → Catalogue
/sales              → Mes ventes
```

---

## 🚀 Commandes Essentielles

```bash
# Développement
pnpm dev                # Lancer le serveur

# Build
pnpm build              # Build production
pnpm start             # Lancer la prod

# Lint
pnpm lint              # Vérifier code

# Clean
rm -rf .next node_modules
pnpm install
```

---

## 🐛 Problèmes Courants

### ❌ "Cannot reach API"
```
✓ Vérifier NEXT_PUBLIC_API_BASE_URL
✓ Vérifier que le backend est lancé
✓ Vérifier les CORS settings
```

### ❌ "Token invalid"
```
✓ Vérifier que le compte est approuvé
✓ Effacer localStorage et reconnecter
✓ Vérifier le backend JWT secret
```

### ❌ "Page blank"
```
✓ Ouvrir Console (F12)
✓ Vérifier les erreurs
✓ Vérifier network tab
```

---

## 📚 Documentation Complète

- 📖 **[README](./README.md)** - Vue d'ensemble
- 🔐 **[Dashboard Doc](./DASHBOARD_DOCUMENTATION.md)** - Architecture détaillée
- ✨ **[Features](./FEATURES.md)** - Toutes les fonctionnalités
- 🌐 **[API Integration](./API_INTEGRATION.md)** - Guide API complet
- 🚀 **[Deployment](./DEPLOYMENT.md)** - Guide déploiement

---

## 💡 Pro Tips

### Debugger Facilement
```typescript
// Dans les composants
const { user, isAuthenticated } = useAuth();
console.log('[v0] User:', user);
console.log('[v0] Auth:', isAuthenticated);
```

### Tester les Erreurs
```typescript
// Supprimer le token
localStorage.removeItem('access_token');
// Recharger la page → Redirect to login
```

### Modifier les Données
Chercher `mutate()` dans les composants pour revalider après création/modification

---

## ✅ Checklist Avant de Déployer

- [ ] `.env.local` configuré avec URL API
- [ ] Connexion testée (admin, magasin, employer)
- [ ] Chaque rôle voit les bonnes pages
- [ ] Les alertes s'affichent correctement
- [ ] Build réussit: `pnpm build`
- [ ] Pas d'erreurs en console
- [ ] Responsive testé (F12 mobile)
- [ ] Backend API disponible
- [ ] CORS configuré

---

## 🎯 Prochaines Étapes

1. **Personnaliser**
   - Ajouter votre logo
   - Changer les couleurs (tailwind.config.ts)
   - Adapter les KPIs

2. **Tester**
   - Tous les endpoints API
   - Tous les rôles
   - Toutes les pages

3. **Déployer**
   - Sur Vercel: `vercel deploy`
   - Variables d'env en production
   - Tester en prod

4. **Monitorer**
   - Logs Vercel
   - Errors Sentry
   - Performance

---

## 🤝 Architecture Résumée

```
User navigates → Router checks auth
                    ↓
              Protected Route?
                ↓         ↓
              Yes         No
              ↓           ↓
        Render page   Redirect /login
            ↓
      ProtectedRoute checks role
            ↓         ↓
          Match      No match
            ↓           ↓
        Show page   Show "Access denied"
```

---

## 🔗 Ressources

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com
- **shadcn/ui**: https://ui.shadcn.com
- **Recharts**: https://recharts.org
- **JWT**: https://jwt.io

---

## 📞 Support Rapide

| Problème | Solution |
|----------|----------|
| Page blanche | Ouvrir console F12 → Chercher erreurs |
| Token expiré | Effacer localStorage → Reconnecter |
| API non trouvée | Vérifier URL dans .env.local |
| Erreur CORS | Configurer CORS dans Django settings |
| Build échoue | `rm -rf .next && pnpm build` |

---

## 🎉 C'est Prêt !

Votre dashboard sécurisé multi-rôles est opérationnel.

```bash
pnpm dev
# Ouvrir http://localhost:3000
# Se connecter et explorer !
```

---

**Happy coding! 🚀**

**Pour plus de détails:** Lire [README.md](./README.md)

---

*Dashboard créé avec ❤️ pour la gestion de stock sécurisée*
