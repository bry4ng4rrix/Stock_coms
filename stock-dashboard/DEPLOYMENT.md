# Guide de Déploiement - Dashboard Multi-Rôles

## 🚀 Déploiement sur Vercel

### Prérequis
- Compte GitHub connecté à Vercel
- Backend Django API disponible (avec CORS configuré)
- Variables d'environnement prêtes

### Étapes

#### 1. Préparer le Repository GitHub
```bash
git init
git add .
git commit -m "Initial commit: Multi-role dashboard"
git push origin main
```

#### 2. Connecter à Vercel
1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer sur "New Project"
3. Importer le repository GitHub
4. Vercel détectera automatiquement **Next.js**

#### 3. Configurer les Variables d'Environnement
Dans les paramètres Vercel:
```
NEXT_PUBLIC_API_BASE_URL=https://votre-api.com/api/users
```

#### 4. Déployer
- Vercel déploie automatiquement à chaque push
- Vérifier l'URL du déploiement
- Tester les différents rôles

## 🔧 Configuration CORS Backend

Le backend Django doit autoriser les requêtes du frontend:

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://votre-domaine.vercel.app",
]

CORS_ALLOW_CREDENTIALS = True
```

## 🌍 Variables d'Environnement par Environnement

### Développement
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/users
```

### Production (Vercel)
```
NEXT_PUBLIC_API_BASE_URL=https://api-prod.yourdomain.com/api/users
```

## ✅ Checklist de Déploiement

- [ ] Backend API disponible et testée
- [ ] CORS configuré correctement
- [ ] JWT tokens fonctionnels
- [ ] Variables d'environnement définies
- [ ] Page de login testée
- [ ] Dashboards testés pour chaque rôle
- [ ] Navigation testée
- [ ] Responsive design testé
- [ ] Gestion d'erreurs testée

## 🧪 Tests Recommandés

### Test de Sécurité
```bash
# Vérifier que sans token, les routes sont protégées
curl https://votre-domaine.vercel.app/dashboard/admin

# Doit rediriger vers /login
```

### Test des Rôles
1. Se connecter comme Admin → Accès à tous les dashboards
2. Se connecter comme Magasin → Accès limité au magasin
3. Se connecter comme Employer → Accès très limité

## 🐛 Dépannage

### "API not found" ou CORS error
- Vérifier que CORS est configuré
- Vérifier que l'URL API est correcte
- Vérifier que l'API est accessible publiquement

### "Token invalid"
- Vérifier que le compte est approuvé (is_confirmed)
- Vérifier que le token n'est pas expiré
- Vérifier le format du token

### "Accès refusé"
- Vérifier le rôle de l'utilisateur
- Vérifier que le backend autorise l'endpoint
- Vérifier les logs du backend

## 📊 Monitoring

Activer les logs de déploiement Vercel pour déboguer:
1. Aller dans "Deployments"
2. Cliquer sur un déploiement
3. Voir les logs en temps réel

## 🔒 Sécurité Production

### Recommandations
- [ ] HTTPS obligatoire
- [ ] CORS restrictif
- [ ] CSRF tokens si formulaires
- [ ] Rate limiting sur l'API
- [ ] Logging des tentatives de connexion
- [ ] Monitoring des erreurs 401/403

### Headers de Sécurité
Ajouter dans next.config.mjs:
```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ];
}
```

## 📚 Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment/vercel)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## 📞 Support

En cas de problème:
1. Vérifier les logs Vercel
2. Vérifier les logs du backend
3. Vérifier la console du navigateur (F12)
4. Vérifier les variables d'environnement

---

**Bonne déploiement ! 🚀**
