# Plan d'Intégration de l'IA (Akanjo)

Ce document détaille les instructions et suggestions pour intégrer des fonctionnalités d'Intelligence Artificielle dans l'application de gestion de stock.

## 1. Recommandations technologiques

### Quelle IA utiliser ?

Pour ce projet, je recommande vivement l'utilisation de **Google Gemini 2.0 Flash**.

- **Pourquoi ?** C'est extrêmement rapide, dispose d'une fenêtre de contexte immense, et est très économique (voire gratuit selon le niveau d'usage via Google AI Studio).
- **Alternative :** OpenAI GPT-4o-mini si vous préférez l'écosystème OpenAI.

### Framework d'intégration

Utilisez le **Vercel AI SDK**. Il simplifie énormément l'intégration de modèles de langage (LLM) dans une application Next.js, en gérant le streaming et les hooks React (`useChat`, `useCompletion`).

---

## 2. Suggestions de fonctionnalités IA

### A. Prédiction de Stock (La "Petite Prédiction")

L'IA peut analyser l'historique des mouvements de stock (`stock_movements`) pour prédire la date d'épuisement d'un produit.

- **Données en entrée :** Historique des sorties sur les 30 derniers jours, stock actuel, niveau de réapprovisionnement.
- **Sortie :** "Basé sur vos ventes actuelles, ce produit sera en rupture de stock dans environ 12 jours. Nous vous conseillons de commander 50 unités supplémentaires."

### B. Catégorisation Automatique

Lors de l'ajout d'un nouveau produit, l'IA suggère automatiquement la catégorie, la matière et les couleurs à partir du nom ou de la description.

### C. Analyse des Tendances

Génération d'un rapport hebdomadaire textuel : "Le produit 'T-shirt Rouge' a connu une augmentation de 40% de demande cette semaine. Pensez à augmenter le stock pour la semaine prochaine."

---

## 3. Instructions d'implémentation

### Étape 1 : Préparation

1. Obtenez une clé API sur [Google AI Studio](https://aistudio.google.com/).
2. Ajoutez-la dans votre fichier `.env.local` :
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyDCLR5Xa_iz0gfSV6FouskTbqp5em1twXg
   ```

### Étape 2 : Installation des dépendances

```bash
npm install ai @google/generative-ai @ai-sdk/google
```

### Étape 3 : Création d'une API Route pour la prédiction

Créez un fichier `app/api/ai/predict-stock/route.ts` :

```typescript
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { productName, currentStock, history } = await req.json();

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: `En tant qu'expert en logistique, analyse ces données :
    Produit : ${productName}
    Stock actuel : ${currentStock}
    Historique des sorties : ${JSON.stringify(history)}
    Prédit en une phrase simple quand le stock sera épuisé et donne un conseil.`,
  });

  return Response.json({ prediction: text });
}
```

---

## 4. Analyse Globale Automatique

Si vous souhaitez que l'IA analyse **l'ensemble de votre inventaire** pour donner des conseils stratégiques globaux :

### A. Concept

L'IA récupère la liste de tous les produits avec leurs niveaux de stock et l'historique récent des mouvements pour générer un "Tableau de Bord Intelligent".

### B. Route API d'Analyse Globale

Créez `app/api/ai/global-analysis/route.ts` :

```typescript
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { allProducts } = await req.json();

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: `Tu es un expert en gestion de stock. Voici l'état actuel de tout mon inventaire :
    ${JSON.stringify(allProducts)}
    
    Analyse ces données et donne-moi :
    1. Les 3 produits prioritaires à recommander.
    2. Les produits qui ne se vendent pas (stock mort).
    3. Une suggestion pour optimiser le cash-flow global.
    Réponds de manière concise et professionnelle.`,
  });

  return Response.json({ analysis: text });
}
```

### C. Exemple d'utilisation

Ajoutez un bouton **"Générer Rapport IA"** en haut de votre page de produits.
Ce bouton enverra tous les produits récupérés via Supabase à cette route.

---

## 5. Note sur l'erreur RLS (Row-Level Security)

L'erreur `"new row violates row-level security policy for table \"products\""` que vous rencontrez indique que l'utilisateur actuel n'a pas les droits pour insérer dans la table.

### Causes possibles :

1. **Utilisateur sans magasin :** L'utilisateur connecté n'est associé à aucun `store_id` dans la table `users`.
2. **Permission "Admin" manquante :** Seul l'admin peut insérer des produits.
3. **Session expirée :** Le client Supabase a perdu l'ID de l'utilisateur.

### Solution rapide :

Vérifiez dans votre base de données que votre utilisateur a bien un `role` ('admin' ou 'magasinier') et un `store_id` valide.
