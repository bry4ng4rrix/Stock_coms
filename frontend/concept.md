but :
gestion de stock suivi par l'admin et pour vois les transactions fait par les employer , 
l'admin peuvent voir tous les mouvement dans le stockage et avoir les notifications lors de leurs connection , l'admin peuvent ajouter des utilisateurs , autre admin ou magasiner ou employer , et les employer peuvent s'inscrire a la page register en ajoutant le mail de l'admin qui va les approuver ou rejeter , 


Roles :
- admin : un magasin cree un compte (admin ) : 
-il peuvent gere tous les produit utlilisateurs , fournisseurs mouvement 
-il peuvent cree un nouveau utilisateur ( employer , magasiner) sans demande (isaprouved direct )
- modifier les roles de tous les utilisateurs 
- voir les mouvement avec le nom de ce qui faire l'actions 

employer ,magasiner : 
- peuvent cree un compte dans le register en ajoutant l'email de l'admin et attendre l'aprouvement de l'admin  (apres confirmation par email )
- une fois approuvé, ils peuvent se connecter via login 
- ne peuvent pas voir les listes des utilisateurs, modifier les roles, creer des utilisateurs 
- peuvent voir les produits, fournisseurs (sans modifications ou suppressions ), mouvements
- ne peuvent pas suprimer les produits et le modifier 
- peuvent faire des mouvements (ajout, retrait)
- ne peuvent pas voir les mouvements des autres utilisateurs





-------------------------------------------------------------------------


maj : 
 - on a ajouter un autre utilisateur superadmin qui peut gerer tous les fonctionalites de l'application


 missions a fait : 
 ajouter des nouvell fonctionalite pour superadmin seulement : 
 - gerer les roles des utilisateurs
 - voire tous les stat par magasin (admin)
 - voir tous les mouvements de tous les utilisateurs(par magasin)
 - voir tous les produits de tous les utilisateurs(par magasin)
- voir la totale de tous les produit de tous les magasin et total de tous les valeurs du mouvement 





concept : -
- Un admin gere UN seul magasin.
- Un superadmin peut gerer PLUSIEURS magasins (via les admins).
- Chaque magasin a plusieurs employes / magasiniers, produits et mouvements.
- Tous les produits et employes d'un magasin sont lies a l'admin de ce magasin, et l'admin est lie au superadmin.
- Donc, en remontant la hierarchie : produit/employe -> magasin -> admin -> superadmin.
- Le superadmin voit tous les magasins, tous les utilisateurs, tous les produits et tous les mouvements (groupes par magasin).

-------------------------------------------------------------------------
ETAPES ET MODIFICATIONS A FAIRE (reste a implementer):
-------------------------------------------------------------------------

1. RESTRICTIONS PAR ROLE — employer / magasinier = lecture seule
   - app/(app)/products/page.tsx :
     * Remplacer la condition isManager par isAdminOrSuperAdmin pour les boutons Ajouter / Modifier / Supprimer
     * Employer / magasinier : voir uniquement le catalogue, pas de modification / suppression
   - app/(app)/suppliers/page.tsx :
     * Masquer les boutons Ajouter / Modifier / Supprimer pour employer / magasinier
     * Lecture seule uniquement
   - app/(app)/movements/page.tsx :
     * Filtrer la liste des mouvements : si role = employer ou magasinier, n’afficher que les mouvements de l’utilisateur connecté (user_id)
     * Admin / superadmin voient tous les mouvements de leur magasin (ou tous pour superadmin)

2. SUPERADMIN — Vue globale enrichie
   - app/(app)/superadmin/page.tsx :
     * Ajouter onglet “Tous les mouvements” : tableau avec filtre par magasin, colonne utilisateur (nom), type, quantité, date, notes
     * Ajouter onglet “Tous les produits” : tableau avec filtre par magasin, SKU, nom, stock, prix unitaire
     * Ajouter chart BarChart “Mouvements par magasin” (entrées vs sorties)
     * Ajouter KPI “Valeur totale des mouvements” (somme des entrées × prix unitaire vs sorties)

3. DASHBOARD — Traçabilité
   - app/(app)/dashboard/page.tsx :
     * Dans la section “Recent movements”, ajouter la colonne “Utilisateur” (récupérer users:user_id(full_name) dans la requête stock_movements)
     * Ajouter un petit chart PieChart ou BarChart “Mouvements par utilisateur” dans le dashboard admin

4. SECURITE REGISTER
   - components/auth/register-form.tsx :
     * Retirer le rôle superadmin du formulaire public (Select / RadioGroup)
     * Superadmin uniquement créable manuellement ou par un autre superadmin (déjà partiellement en place, à vérifier)

5. PAGE UTILISATEURS — Users
   - app/(app)/users/page.tsx :
     * Employer / magasinier : masquer complètement cette page (sidebar déjà masquée, mais vérifier le guard côté page)
     * Admin : ne voit que les utilisateurs de son propre magasin (déjà en place avec store_id)
     * Superadmin : voit tous les utilisateurs de tous les magasins (déjà en place via fetchGlobalStats)

6. RLS SUPABASE (sécurité backend)
   - S’assurer que les policies Supabase empêchent un employer / magasinier de modifier / supprimer des produits ou fournisseurs
   - S’assurer que les policies empêchent un utilisateur de voir les mouvements d’un autre utilisateur (sauf admin / superadmin)