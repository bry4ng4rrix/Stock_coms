'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { authAPI, productAPI, salesAPI, analyticsAPI, userAPI } from '@/lib/api-client';
import { Copy, Play } from 'lucide-react';

interface TestRequest {
  method: string;
  endpoint: string;
  description: string;
  body?: any;
}

const testRequests: Record<string, TestRequest> = {
  login: {
    method: 'POST',
    endpoint: '/login/',
    description: 'Se connecter',
    body: {
      username: 'admin@example.com',
      password: 'password123'
    }
  },
  getMe: {
    method: 'GET',
    endpoint: '/me/',
    description: 'Récupérer mon profil'
  },
  listProducts: {
    method: 'GET',
    endpoint: '/products/',
    description: 'Lister les produits'
  },
  createProduct: {
    method: 'POST',
    endpoint: '/products/',
    description: 'Créer un produit',
    body: {
      name: 'Test Product',
      reference: 'TEST-001',
      brand: 'Test Brand',
      category: 'Test Category',
      description: 'Test Description',
      unit_price: 50.00,
      shell_price: 75.00,
      initial_quantity: 100,
      alert_threshold: 10,
      expiry_date: '2027-12-31',
      magasin: 1
    }
  },
  listSales: {
    method: 'GET',
    endpoint: '/sales/',
    description: 'Lister les ventes'
  },
  createSale: {
    method: 'POST',
    endpoint: '/sales/',
    description: 'Créer une vente',
    body: {
      product: 1,
      quantity: 5,
      sale_price: 100.00
    }
  },
  getDashboard: {
    method: 'GET',
    endpoint: '/dashboard/',
    description: 'Récupérer le dashboard'
  },
  getSalesTotals: {
    method: 'GET',
    endpoint: '/sales/totals/',
    description: 'Récupérer les totaux'
  },
  getSalesProfit: {
    method: 'GET',
    endpoint: '/sales/profit/',
    description: 'Récupérer les profits'
  },
  getMagazinsUsers: {
    method: 'GET',
    endpoint: '/magasins/users/',
    description: 'Lister les utilisateurs par magasin'
  },
  getEndpoints: {
    method: 'GET',
    endpoint: '/endpoints/',
    description: 'Lister tous les endpoints'
  }
};

export default function TestEndpointsPage() {
  const [selectedTest, setSelectedTest] = useState<string>('login');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const executeTest = async (testKey: string) => {
    const test = testRequests[testKey];
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      let result;
      
      switch (testKey) {
        case 'login':
          result = await authAPI.login(test.body.username, test.body.password);
          break;
        case 'getMe':
          result = await authAPI.getMe();
          break;
        case 'listProducts':
          result = await productAPI.list();
          break;
        case 'createProduct':
          result = await productAPI.create(test.body);
          break;
        case 'listSales':
          result = await salesAPI.list();
          break;
        case 'createSale':
          result = await salesAPI.create(test.body);
          break;
        case 'getDashboard':
          result = await analyticsAPI.getDashboard();
          break;
        case 'getSalesTotals':
          result = await salesAPI.getTotals();
          break;
        case 'getSalesProfit':
          result = await salesAPI.getProfit();
          break;
        case 'getMagazinsUsers':
          result = await analyticsAPI.getMagazinsUsers();
          break;
        case 'getEndpoints':
          result = await analyticsAPI.getEndpoints();
          break;
        default:
          throw new Error('Test non reconnu');
      }

      setResponse({
        status: result.status,
        data: result.data,
        headers: result.headers
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Erreur lors de la requête');
      console.error('Test error:', err);
    } finally {
      setLoading(false);
    }
  };

  const test = testRequests[selectedTest];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">API Endpoint Tester</h1>
          <p className="text-gray-600">Testez les endpoints de l&apos;API en temps réel</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tests List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Tests Disponibles</CardTitle>
              <CardDescription>Sélectionnez un test à exécuter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(testRequests).map(([key, req]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTest(key)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    selectedTest === key
                      ? 'bg-blue-100 border-l-4 border-blue-600 text-blue-900 font-semibold'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{req.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{req.method} {req.endpoint}</p>
                    </div>
                    {selectedTest === key && <Play className="w-4 h-4 flex-shrink-0 ml-2" />}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{test?.description}</CardTitle>
              <CardDescription>{test?.method} {test?.endpoint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Request Body */}
              {test?.body && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Request Body</label>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{JSON.stringify(test.body, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Response */}
              {response && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Response (Status: {response.status})</label>
                  <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-96">
                    <pre>{JSON.stringify(response.data, null, 2)}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <Button
                onClick={() => executeTest(selectedTest)}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner className="w-4 h-4" />
                    Exécution en cours...
                  </div>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Exécuter le test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* API Documentation */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Documentation API</CardTitle>
            <CardDescription>Vue d&apos;ensemble des endpoints disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(testRequests).map(([key, req]) => (
                <div key={key} className="border-l-4 border-gray-300 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      req.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                      req.method === 'POST' ? 'bg-green-100 text-green-700' :
                      req.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {req.method}
                    </span>
                    <code className="text-sm font-mono text-gray-700">{req.endpoint}</code>
                  </div>
                  <p className="text-sm text-gray-600">{req.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
