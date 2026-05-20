'use client';

import { ProtectedRoute } from '@/lib/protected-route';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface Product {
  id: number;
  name: string;
  reference: string;
  category: string;
  shell_price: number;
  initial_quantity: number;
  alert_threshold: number;
  expiry_date: string;
}

export default function MagasinProductsPage() {
  return (
    <ProtectedRoute requiredRoles={['magasin']}>
      <MagasinProductsContent />
    </ProtectedRoute>
  );
}

function MagasinProductsContent() {
  const { data: products, error, isLoading } = useSWR<Product[]>(
    '/products/',
    fetcher
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const lowStockProducts = filteredProducts.filter(
    (p) => p.initial_quantity <= p.alert_threshold
  );

  const expiredProducts = filteredProducts.filter(
    (p) => new Date(p.expiry_date) < new Date()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Erreur lors du chargement des produits</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes produits</h1>
          <p className="text-gray-600">Total: {filteredProducts.length} produits</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          + Ajouter un produit
        </Button>
      </div>

      {/* Alerts */}
      {lowStockProducts.length > 0 && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {lowStockProducts.length} produit(s) en stock faible
          </AlertDescription>
        </Alert>
      )}
      {expiredProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {expiredProducts.length} produit(s) expiré(s)
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Rechercher</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Rechercher par nom ou référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des produits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Nom</th>
                  <th className="text-left py-3 px-4 font-semibold">Référence</th>
                  <th className="text-left py-3 px-4 font-semibold">Catégorie</th>
                  <th className="text-right py-3 px-4 font-semibold">P. Vente</th>
                  <th className="text-right py-3 px-4 font-semibold">Stock</th>
                  <th className="text-left py-3 px-4 font-semibold">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const isExpired = new Date(product.expiry_date) < new Date();
                  const isLowStock =
                    product.initial_quantity <= product.alert_threshold;

                  return (
                    <tr
                      key={product.id}
                      className={`border-b hover:bg-gray-50 ${
                        isExpired ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {product.reference}
                      </td>
                      <td className="py-3 px-4">{product.category}</td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">
                        {product.shell_price.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            isLowStock
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {product.initial_quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            isExpired
                              ? 'text-red-600 font-semibold'
                              : 'text-gray-600'
                          }
                        >
                          {new Date(product.expiry_date).toLocaleDateString(
                            'fr-FR'
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucun produit trouvé
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
