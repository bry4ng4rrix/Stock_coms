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
import { AlertTriangle, Store, Users, Package, ShoppingCart } from 'lucide-react';

interface StoreData {
  id: number;
  name: string;
  manager_name: string;
  employee_count: number;
  product_count: number;
  total_sales: number;
  total_profit: number;
  stock_value: number;
}

export default function AdminStoresPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminStoresContent />
    </ProtectedRoute>
  );
}

function AdminStoresContent() {
  const { data: stores, error, isLoading } = useSWR<StoreData[]>(
    '/stores/',
    fetcher
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
        <AlertDescription>Erreur lors du chargement des magasins</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion des magasins</h1>
        <p className="text-gray-600">Total: {stores?.length || 0} magasins</p>
      </div>

      {stores && stores.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="hover:shadow-lg transition">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="w-5 h-5 text-blue-600" />
                      {store.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Gérant: {store.manager_name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Employés</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {store.employee_count}
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-gray-600">Produits</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {store.product_count}
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingCart className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-gray-600">Ventes totales</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {store.total_sales.toFixed(2)} €
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Profit</span>
                    <span className="font-bold text-green-600">
                      {store.total_profit.toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Valeur stock</span>
                    <span className="font-bold text-blue-600">
                      {store.stock_value.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Aucun magasin trouvé
          </CardContent>
        </Card>
      )}
    </div>
  );
}
