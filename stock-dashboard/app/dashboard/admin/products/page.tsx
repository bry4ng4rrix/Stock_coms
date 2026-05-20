'use client';

import { ProtectedRoute } from '@/lib/protected-route';
import useSWR from 'swr';
import { fetcher, getApiClient } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface Product {
  id: number;
  name: string;
  reference: string;
  category: string;
  unit_price: number;
  shell_price: number;
  initial_quantity: number;
  magasin_name: string;
  expiry_date: string;
}

export default function AdminProductsPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminProductsContent />
    </ProtectedRoute>
  );
}

function AdminProductsContent() {
  const { data: products, error, isLoading, mutate } = useSWR<Product[]>(
    '/products/',
    fetcher
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  const handleDelete = async (productId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    setDeleteLoading(productId);
    try {
      await getApiClient().delete(`/products/${productId}/`);
      mutate();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
          <h1 className="text-3xl font-bold">Gestion des produits</h1>
          <p className="text-gray-600">Total: {filteredProducts.length} produits</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          + Ajouter un produit
        </Button>
      </div>

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
                  <th className="text-right py-3 px-4 font-semibold">P. Achat</th>
                  <th className="text-right py-3 px-4 font-semibold">P. Vente</th>
                  <th className="text-right py-3 px-4 font-semibold">Stock</th>
                  <th className="text-left py-3 px-4 font-semibold">Magasin</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{product.name}</td>
                    <td className="py-3 px-4 text-gray-600">{product.reference}</td>
                    <td className="py-3 px-4">{product.category}</td>
                    <td className="py-3 px-4 text-right text-blue-600 font-semibold">
                      {product.unit_price.toFixed(2)} €
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 font-semibold">
                      {product.shell_price.toFixed(2)} €
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.initial_quantity <= 5
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {product.initial_quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4">{product.magasin_name}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => handleDelete(product.id)}
                          disabled={deleteLoading === product.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
