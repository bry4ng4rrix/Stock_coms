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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface Sale {
  id: number;
  product_name: string;
  seller_name: string;
  quantity: number;
  sale_price: number;
  total_price: number;
  sold_at: string;
}

export default function MagasinSalesPage() {
  return (
    <ProtectedRoute requiredRoles={['magasin']}>
      <MagasinSalesContent />
    </ProtectedRoute>
  );
}

function MagasinSalesContent() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const { data: sales, error, isLoading } = useSWR<Sale[]>(
    `/sales/?period=${timeRange}`,
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
        <AlertDescription>Erreur lors du chargement des ventes</AlertDescription>
      </Alert>
    );
  }

  const totalSales = sales?.reduce((sum, sale) => sum + sale.total_price, 0) || 0;
  const totalQuantity = sales?.reduce((sum, sale) => sum + sale.quantity, 0) || 0;

  const rangeLabels = {
    today: 'Aujourd\'hui',
    week: 'Cette semaine',
    month: 'Ce mois',
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Historique des ventes</h1>
          <p className="text-gray-600">
            {rangeLabels[timeRange]}: {totalSales.toFixed(2)} € ({totalQuantity} articles)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Période
              </label>
              <Select
                value={timeRange}
                onValueChange={(value: any) => setTimeRange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {sales && sales.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Nombre de ventes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{sales.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Quantité vendue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{totalQuantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Chiffre d&apos;affaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {totalSales.toFixed(2)} €
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des ventes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Produit</th>
                  <th className="text-left py-3 px-4 font-semibold">Vendeur</th>
                  <th className="text-right py-3 px-4 font-semibold">Quantité</th>
                  <th className="text-right py-3 px-4 font-semibold">P. Unitaire</th>
                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales && sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{sale.product_name}</td>
                      <td className="py-3 px-4">{sale.seller_name}</td>
                      <td className="py-3 px-4 text-right">{sale.quantity}</td>
                      <td className="py-3 px-4 text-right text-blue-600">
                        {sale.sale_price.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">
                        {sale.total_price.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {new Date(sale.sold_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Aucune vente pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
