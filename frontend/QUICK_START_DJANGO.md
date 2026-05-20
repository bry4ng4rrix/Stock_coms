# Démarrage Rapide - Django Backend

Guide rapide pour mettre en place et tester l'intégration Django.

## 📋 Prérequis

- Python 3.8+
- Node.js 16+
- Git
- pip (Python package manager)

---

## 🚀 Installation Backend Django

### 1. Cloner et Configurer

```bash
# Cloner le repo Django
git clone <django-backend-repo>
cd django-backend

# Créer virtual environment
python -m venv venv

# Activer virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Installer dépendances
pip install -r requirements.txt
```

### 2. Configuration Django

Créer `django_backend/settings.py` avec:

```python
# Dépendances
INSTALLED_APPS = [
    # ... apps Django standard ...
    'rest_framework',
    'corsheaders',
    'users',
    'products',
    'sales',
    'stores',
    'suppliers',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

# JWT
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
```

### 3. Créer Modèles

Créer `users/models.py`:

```python
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('store_manager', 'Store Manager'),
        ('employee', 'Employee'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    is_approved = models.BooleanField(default=False)
    store = models.ForeignKey('stores.Store', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Créer `products/models.py`, `sales/models.py`, etc. (Voir `DJANGO_BACKEND_README.md`)

### 4. Migrations

```bash
# Créer migrations
python manage.py makemigrations

# Appliquer migrations
python manage.py migrate

# Créer superuser (admin)
python manage.py createsuperuser
```

### 5. Démarrer

```bash
python manage.py runserver
```

Django tourne à: `http://localhost:8000`
Admin panel: `http://localhost:8000/admin`

---

## 🎨 Installation Frontend Next.js

### 1. Installation

```bash
# À la racine du projet (où est ce README)
npm install
```

### 2. Configuration

Créer `.env.local`:

```env
NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api
```

### 3. Démarrer

```bash
npm run dev
```

Frontend tourne à: `http://localhost:3000`

---

## ✅ Tests Rapides

### Test Backend

#### 1. Register
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "testpass123",
    "role": "employee"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

Vous recevrez:
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": { ... }
}
```

#### 3. Get Current User
```bash
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer {access_token}"
```

### Test Frontend

1. Aller à `http://localhost:3000`
2. Cliquer sur "Créer un compte"
3. Remplir le formulaire
4. Vous devez voir la page "En attente d'approbation"
5. Aller à `http://localhost:8000/admin`
6. Login avec superuser
7. Approuver l'utilisateur (mettre `is_approved = true`)
8. Retourner au frontend et login

---

## 📁 Structure des Fichiers

### Frontend Modifié

```
lib/
├── django-client.ts        ← Client API Django (395 lignes)
├── hooks/
│   └── useAuth.ts          ← Hook authentification (87 lignes)
└── types.ts                ← Types TypeScript (109 lignes)

components/auth/
├── login-form.tsx          ← Modifié (utilise djangoClient)
└── register-form.tsx       ← Modifié (utilise djangoClient)

app/auth/
└── pending-approval/
    └── page.tsx            ← Nouvelle page
```

### Documentation

```
DJANGO_BACKEND_README.md       ← Guide complet backend (1051 lignes)
IMPLEMENTATION_CHECKLIST.md    ← Checklist (305 lignes)
MIGRATION_SUMMARY.md           ← Résumé complet (357 lignes)
QUICK_START_DJANGO.md          ← Ce fichier
.env.example                   ← Configuration exemple
```

---

## 🔧 Commandes Utiles

### Backend

```bash
# Migrations
python manage.py makemigrations
python manage.py migrate

# Démarrer serveur
python manage.py runserver

# Shell Django
python manage.py shell

# Créer superuser
python manage.py createsuperuser

# Collecte static files
python manage.py collectstatic
```

### Frontend

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer production
npm start

# Linter
npm run lint
```

---

## 🐛 Troubleshooting

### Erreur: "Cannot GET /api/auth/me/"

**Cause:** Backend ne démarre pas ou port différent  
**Solution:**
```bash
# Vérifier Django démarre
python manage.py runserver

# Vérifier port (par défaut 8000)
# Mettre à jour .env.local si nécessaire
NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api
```

### Erreur: CORS

**Cause:** Frontend URL pas dans CORS_ALLOWED_ORIGINS  
**Solution:** Ajouter dans `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
```

### Erreur: "Account pending approval"

**Cause:** Utilisateur créé mais non approuvé  
**Solution:** 
1. Aller à Django admin (`http://localhost:8000/admin`)
2. Login avec superuser
3. Users → Sélectionner l'utilisateur
4. Cocher "is_approved"
5. Sauvegarder

### Erreur: Tokens expirés

**Cause:** Access token expires après 1 heure  
**Solution:** 
- djangoClient refresh automatiquement
- Si ça ne fonctionne pas, logout et login à nouveau

---

## 📚 Documentation Complète

Pour plus de détails, voir:

- **[DJANGO_BACKEND_README.md](./DJANGO_BACKEND_README.md)** - Guide complet backend
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - Checklist détaillée
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Résumé migration

---

## 🚀 Prochaines Étapes

1. ✓ Frontend configuré
2. ⏳ Backend Django implémenté
3. ⏳ Pages existantes mises à jour
4. ⏳ Tests d'intégration
5. ⏳ Déploiement

---

## 💡 Tips

- Utilisez Postman/Insomnia pour tester les endpoints
- Gardez les logs des 2 serveurs visibles pour debugger
- Lisez les erreurs Django/Next.js - elles sont très explicites
- Consultez `DJANGO_BACKEND_README.md` pour les endpoints détaillés

---

## 📞 Support

Voir les fichiers documentation ou créer une issue sur GitHub.

---

**Status:** ✓ Frontend Prêt | ⏳ Backend À Implémenter

**Dernière mise à jour:** 2024
