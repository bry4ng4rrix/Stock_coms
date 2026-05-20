'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Lock, Globe } from 'lucide-react';

const endpoints = [
  {
    category: 'Authentication',
    items: [
      {
        method: 'POST',
        path: '/login/',
        auth: false,
        description: 'Authentifie un utilisateur et retourne les tokens JWT (access & refresh)',
        request: {
          email: 'user@example.com',
          password: 'password123'
        },
        response: {
          refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      },
      {
        method: 'POST',
        path: '/refresh/',
        auth: false,
        description: 'Rafraîchit le token d&apos;accès JWT expiré',
        request: {
          refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        response: {
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    ]
  },
  {
    category: 'User Management',
    items: [
      {
        method: 'POST',
        path: '/register/',
        auth: false,
        description: 'Inscrit un nouvel utilisateur (admin créé automatiquement, magasin/employé en attente)',
        request: {
          full_name: 'John User',
          email: 'user@example.com',
          password: 'password123',
          phone: '+1234567890',
          role: 'employer'
        }
      },
      {
        method: 'GET',
        path: '/me/',
        auth: true,
        description: 'Retourne le profil complet de l&apos;utilisateur connecté',
        response: {
          id: 1,
          username: 'user@example.com',
          email: 'user@example.com',
          role: 'admin',
          is_confirmed: true
        }
      },
      {
        method: 'PUT',
        path: '/approve/<user_id>/',
        auth: true,
        description: 'Approuve et active un compte utilisateur (Admin ou Magasin)',
        roles: ['admin', 'magasin']
      },
      {
        method: 'PUT',
        path: '/role/<user_id>/',
        auth: true,
        description: 'Modifie le rôle d&apos;un utilisateur',
        roles: ['admin'],
        request: {
          role: 'magasin'
        }
      }
    ]
  },
  {
    category: 'Products',
    items: [
      {
        method: 'GET',
        path: '/products/',
        auth: true,
        description: 'Liste les produits (prix d&apos;achat masqué pour magasin/employé)',
        query: ['magasin', 'category', 'brand']
      },
      {
        method: 'POST',
        path: '/products/',
        auth: true,
        description: 'Crée un nouveau produit',
        roles: ['admin', 'magasin'],
        request: {
          name: 'Product Name',
          reference: 'REF-001',
          brand: 'Brand',
          category: 'Electronics',
          unit_price: 50.00,
          shell_price: 75.00,
          initial_quantity: 100,
          alert_threshold: 10,
          expiry_date: '2027-12-31'
        }
      },
      {
        method: 'GET',
        path: '/products/<id>/',
        auth: true,
        description: 'Récupère les détails d&apos;un produit spécifique'
      },
      {
        method: 'PUT/PATCH',
        path: '/products/<id>/',
        auth: true,
        description: 'Modifie un produit',
        roles: ['admin']
      },
      {
        method: 'DELETE',
        path: '/products/<id>/',
        auth: true,
        description: 'Supprime un produit',
        roles: ['admin']
      }
    ]
  },
  {
    category: 'Sales',
    items: [
      {
        method: 'GET',
        path: '/sales/',
        auth: true,
        description: 'Liste l&apos;historique des ventes (filtré par rôle)',
        query: ['product', 'magasin', 'seller', 'ordering']
      },
      {
        method: 'POST',
        path: '/sales/',
        auth: true,
        description: 'Enregistre une nouvelle vente',
        request: {
          product: 1,
          quantity: 5,
          sale_price: 100.00
        }
      },
      {
        method: 'GET',
        path: '/sales/<id>/',
        auth: true,
        description: 'Récupère les détails d&apos;une vente spécifique'
      },
      {
        method: 'PUT/PATCH',
        path: '/sales/<id>/',
        auth: true,
        description: 'Modifie une vente existante'
      },
      {
        method: 'DELETE',
        path: '/sales/<id>/',
        auth: true,
        description: 'Supprime une vente'
      }
    ]
  },
  {
    category: 'Analytics',
    items: [
      {
        method: 'GET',
        path: '/dashboard/',
        auth: true,
        description: 'Tableau de bord analytique dynamique adapté au rôle de l&apos;utilisateur'
      },
      {
        method: 'GET',
        path: '/sales/totals/',
        auth: true,
        description: 'Calcule la somme globale des unit_price et shell_price'
      },
      {
        method: 'GET',
        path: '/sales/profit/',
        auth: true,
        description: 'Calcule le bénéfice réel total'
      },
      {
        method: 'GET',
        path: '/magasins/users/',
        auth: true,
        description: 'Liste tous les utilisateurs regroupés par magasin'
      }
    ]
  }
];

const httpMethods: Record<string, { color: string; bg: string }> = {
  GET: { color: 'text-blue-700', bg: 'bg-blue-100' },
  POST: { color: 'text-green-700', bg: 'bg-green-100' },
  PUT: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  PATCH: { color: 'text-orange-700', bg: 'bg-orange-100' },
  DELETE: { color: 'text-red-700', bg: 'bg-red-100' }
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">API Documentation</h1>
          <p className="text-lg text-gray-600">Base URL: <code className="bg-gray-200 px-2 py-1 rounded">http://localhost:8000/api/users/</code></p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Globe className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Public Endpoints</h3>
                  <p className="text-sm text-gray-600">Login, Register, Endpoints</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Lock className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Protected</h3>
                  <p className="text-sm text-gray-600">Requires Bearer Token</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Role-Based</h3>
                  <p className="text-sm text-gray-600">Admin, Magasin, Employer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Endpoints by Category */}
        <div className="space-y-6">
          {endpoints.map((category, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-2xl">{category.category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="border-l-4 border-gray-300 pl-4 py-3 bg-gray-50 rounded-r">
                    {/* Method & Path */}
                    <div className="flex items-center gap-3 mb-2">
                      {item.method.split('/').map((method) => (
                        <Badge
                          key={method}
                          className={`font-semibold ${httpMethods[method]?.color} ${httpMethods[method]?.bg}`}
                        >
                          {method}
                        </Badge>
                      ))}
                      <code className="text-sm font-mono bg-white px-3 py-1 rounded border border-gray-300">
                        {item.path}
                      </code>
                      {!item.auth ? (
                        <Badge variant="outline" className="ml-auto">Public</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-auto">
                          <Lock className="w-3 h-3 mr-1" />
                          Protected
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 mb-2">{item.description}</p>

                    {/* Roles */}
                    {item.roles && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Roles:</strong> {item.roles.join(', ')}
                      </div>
                    )}

                    {/* Query Parameters */}
                    {item.query && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Query:</strong> {item.query.join(', ')}
                      </div>
                    )}

                    {/* Request/Response */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {item.request && (
                        <div className="bg-white rounded border border-gray-300 p-2">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Request:</p>
                          <code className="text-xs text-gray-600 block font-mono overflow-x-auto">
                            {JSON.stringify(item.request, null, 2).substring(0, 200)}
                          </code>
                        </div>
                      )}
                      {item.response && (
                        <div className="bg-white rounded border border-gray-300 p-2">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Response:</p>
                          <code className="text-xs text-gray-600 block font-mono overflow-x-auto">
                            {JSON.stringify(item.response, null, 2).substring(0, 200)}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Codes */}
        <Card>
          <CardHeader>
            <CardTitle>HTTP Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Success</h4>
                <ul className="space-y-2 text-sm">
                  <li><Badge className="bg-blue-100 text-blue-700">200</Badge> OK - Requête réussie</li>
                  <li><Badge className="bg-blue-100 text-blue-700">201</Badge> Created - Ressource créée</li>
                  <li><Badge className="bg-blue-100 text-blue-700">204</Badge> No Content - Succès sans contenu</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Errors</h4>
                <ul className="space-y-2 text-sm">
                  <li><Badge className="bg-yellow-100 text-yellow-700">400</Badge> Bad Request - Données invalides</li>
                  <li><Badge className="bg-red-100 text-red-700">401</Badge> Unauthorized - Token invalide</li>
                  <li><Badge className="bg-red-100 text-red-700">403</Badge> Forbidden - Accès refusé</li>
                  <li><Badge className="bg-red-100 text-red-700">404</Badge> Not Found - Ressource inexistante</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing */}
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Testing API</CardTitle>
            <CardDescription>Testez les endpoints interactivement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 mb-4">
              Utilisez la page de test pour exécuter les endpoints et voir les réponses en temps réel.
            </p>
            <a
              href="/test-endpoints"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Aller au testeur d&apos;API
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
