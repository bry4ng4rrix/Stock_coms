# Fonctionnalités du Dashboard Multi-Rôles

## ✨ Vue d'ensemble

Dashboard complet de gestion de stock avec 3 niveaux de rôles et accès granulaire aux données. Chaque rôle a une expérience utilisateur et un ensemble de données distincts.

---

## 👤 Dashboard Admin

### Pages disponibles:

#### 1. **Dashboard Principal** (`/dashboard/admin`)
- 📊 8 cartes de KPIs:
  - Chiffre d'affaires total
  - Bénéfices totaux
  - Valeur totale du stock
  - Nombre de magasins
  - Nombre d'employés
  - Nombre de produits
  - Ventes du jour
  - Profit du jour
- ⚠️ Alertes automatiques:
  - Stock faible
  - Produits expirés
  - Produits expirés bientôt
- 📈 Graphiques:
  - Ventes par jour
  - Produits les plus vendus
  - Meilleurs magasins

#### 2. **Analyses** (`/dashboard/admin/analytics`)
- 📈 Graphiques avancés:
  - Évolution des ventes et profits
  - Répartition par catégorie
  - Ventes par magasin
- 🏆 Top employés
- Données non filtrées (vue globale)

#### 3. **Produits** (`/dashboard/admin/products`)
- 📋 Liste complète de tous les produits
- 🔍 Recherche par nom/référence
- 📊 Colonnes visibles:
  - Nom, Référence, Catégorie
  - Prix d'achat (unit_price) - **VISIBLE ADMIN UNIQUEMENT**
  - Prix de vente (shell_price)
  - Stock avec alerte visuelle
  - Magasin associé
- 🎯 Actions:
  - Modifier produit
  - Supprimer produit

#### 4. **Ventes** (`/dashboard/admin/sales`)
- 📊 Historique complet de toutes les ventes
- 🎯 Filtres par période:
  - Aujourd'hui
  - Cette semaine
  - Ce mois
  - Cette année
- 📋 Détails par vente:
  - Produit, Magasin, Vendeur
  - Quantité, Prix unitaire, Total
  - Date et heure
- 📈 Statistiques:
  - Nombre de ventes
  - Quantité totale
  - Ticket moyen

#### 5. **Utilisateurs** (`/dashboard/admin/users`)
- 🏢 Utilisateurs groupés par magasin
- 👨‍💼 Gérants à approuver
- 👥 Employés à approuver
- ✅ Approbation en un clic
- 📊 Statut d'approbation visible

#### 6. **Magasins** (`/dashboard/admin/stores`)
- 🏪 Vue en grille de tous les magasins
- 📊 Cartes individuelles avec:
  - Nom du magasin
  - Gérant associé
  - Nombre d'employés
  - Nombre de produits
  - Ventes totales
  - Bénéfices totaux
  - Valeur du stock

---

## 🏪 Dashboard Magasin

### Pages disponibles:

#### 1. **Dashboard Principal** (`/dashboard/magasin`)
- 📊 5 cartes de KPIs:
  - Ventes du jour
  - Profit du jour
  - Valeur du stock (son magasin)
  - Nombre de produits
  - Total de ventes
- ⚠️ Alertes:
  - Stock faible
  - Produits expirés
- 📈 Graphiques:
  - Ventes de la semaine
  - Produits populaires
- 🏆 Meilleurs vendeurs

#### 2. **Analyses** (`/dashboard/magasin/analytics`)
- 📈 Graphiques du magasin:
  - Ventes de la semaine
  - Bénéfices de la semaine
  - Produits populaires
  - Répartition par catégorie
- 🎯 **Données limitées au magasin**
- 🔒 **Pas d'accès aux données d'autres magasins**

#### 3. **Produits** (`/dashboard/magasin/products`)
- 📋 Liste des produits du magasin uniquement
- 🔍 Recherche par nom/référence
- 📊 Colonnes visibles:
  - Nom, Référence, Catégorie
  - Prix de vente (shell_price) uniquement
  - Stock avec alerte
  - Date d'expiration
- ⚠️ Alertes visuelles:
  - Stock faible = fond rouge
  - Produits expirés = ligne rouge
- 🚫 **Prix d'achat MASQUÉ**

#### 4. **Ventes** (`/dashboard/magasin/sales`)
- 📊 Ventes du magasin uniquement
- 🎯 Filtres par période:
  - Aujourd'hui
  - Cette semaine
  - Ce mois
- 📋 Détails visibles:
  - Produit, Vendeur
  - Quantité, Prix, Total
  - Date et heure
- 📈 Statistiques:
  - Nombre de ventes
  - Quantité vendue
  - Chiffre d'affaires

#### 5. **Employés** (`/dashboard/magasin/employees`)
- 👥 Liste des employés du magasin
- 📋 Section "En attente d'approbation":
  - Email, Position
  - Bouton Approuver
- ✅ Section "Employés confirmés":
  - Nom, Email, Poste
  - Nombre de ventes
  - Montant total des ventes
  - Statut

---

## 👨‍💼 Dashboard Employer

### Pages disponibles:

#### 1. **Dashboard Principal** (`/dashboard/employer`)
- 📊 3 cartes de KPIs:
  - Mes ventes du jour (compteur)
  - Montant total vendu
  - Nombre de produits vendus
- 📋 Dernières ventes:
  - Produit, Quantité, Total
  - Date et heure

#### 2. **Produits** (`/dashboard/employer/products`)
- 📋 Catalogue du magasin (lecture seule)
- 🔍 Recherche par nom/référence
- 📊 Colonnes visibles:
  - Nom, Référence, Catégorie
  - Prix (shell_price) uniquement
  - Stock disponible
- 🔒 **Aucune modification possible**
- 🔒 **Pas d'accès aux prix d'achat**

#### 3. **Mes Ventes** (`/dashboard/employer/sales`)
- 📊 Historique personnel uniquement
- 📊 Statistiques personnelles:
  - Nombre de ventes du jour
  - Quantité vendue
  - Montant total
- 📋 Tableau des ventes:
  - Produit, Quantité
  - Prix unitaire, Total
  - Date et heure
- ➕ **Formulaire d'ajout de vente**:
  - Sélectionner produit
  - Quantité à vendre
  - Prix de vente
  - Validation du stock
  - Calcul automatique du total
- ✅ Soumission crée la transaction

---

## 🔐 Sécurité par Rôle

| Fonctionnalité | Admin | Magasin | Employer |
|---|---|---|---|
| Voir tous les dashboards | ✅ | ❌ | ❌ |
| Voir son magasin | ✅ | ✅ | ❌ |
| Voir autres magasins | ✅ | ❌ | ❌ |
| Créer/Modifier produits | ✅ | ✅ | ❌ |
| Supprimer produits | ✅ | ❌ | ❌ |
| Voir prix d'achat | ✅ | ❌ | ❌ |
| Voir profits globaux | ✅ | ❌ | ❌ |
| Voir données d'autres magasins | ✅ | ❌ | ❌ |
| Créer vente | ✅ | ✅ | ✅ |
| Voir toutes les ventes | ✅ | ✅ (magasin) | ❌ |
| Voir ses ventes uniquement | ✅ | ✅ | ✅ |
| Approuver utilisateurs | ✅ | ✅ | ❌ |
| Voir liste des employés | ✅ | ✅ | ❌ |

---

## 🎨 Composants UI Utilisés

- **Cards** : Affichage des KPIs
- **Tables** : Listes de données
- **Buttons** : Actions principales
- **Input** : Champs de recherche/formulaires
- **Select** : Sélecteurs (produits, périodes)
- **Dialogs** : Formulaires modaux (ajout de vente)
- **Alerts** : Messages d'alerte
- **Charts** : Visualisations (Line, Bar, Pie)
- **Navigation** : Barre de navigation responsive

---

## 📱 Responsive Design

- **Desktop** : Grilles multi-colonnes
- **Tablet** : Ajustement des colonnes
- **Mobile** : 
  - Menu hamburger au lieu de navigation horizontale
  - Tables scrollables
  - Single-column layout

---

## 🔄 Intégrations API

Tous les dashboards consomment l'API backend:

### Endpoints utilisés:
- `GET /me/` - Profil utilisateur
- `GET /dashboard/` - Données dashboard (filtré par rôle)
- `GET /products/` - Liste produits (filtrée)
- `GET /sales/` - Ventes (filtrées)
- `GET /magasins/users/` - Utilisateurs par magasin
- `POST /sales/` - Créer une vente
- `PUT /approve/{id}/` - Approuver utilisateur
- `DELETE /products/{id}/` - Supprimer produit

---

## 🚀 Points Forts

✨ **Sécurité granulaire** - Chaque rôle voit uniquement ses données  
✨ **Navigation intelligente** - Menu adapté au rôle  
✨ **Données masquées** - Prix d'achat caché pour non-admins  
✨ **Alertes visuelles** - Stock faible, expiration  
✨ **Responsive** - Fonctionne sur tous les appareils  
✨ **Real-time** - SWR pour données à jour  
✨ **Formulaires intégrés** - Création directe depuis dashboard  
✨ **Graphiques** - Visualisations des données  

---

**Système complet et sécurisé de gestion de stock ! 🎯**
