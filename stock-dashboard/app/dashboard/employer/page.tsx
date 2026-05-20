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
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface EmployerDashboardData {
  today_sales_count: number;
  today_sales_amount: number;
  total_products_sold: number;
  total_customers?: number;
  recent_sales: Array<{
    id: number;
    product_name: string;
    quantity: number;
    total_price: number;
    sold_at: string;
  }>;
}

export default function EmployerDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['employer']}>
      <EmployerDashboardContent />
    </ProtectedRoute>
  );
}

function EmployerDashboardContent() {
  const { data, error, isLoading } = useSWR<EmployerDashboardData>(
    '/dashboard/',
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
        <AlertDescription>Erreur lors du chargement du dashboard</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const statCards = [
    {
      title: 'Mes ventes du jour',
      value: data.today_sales_count,
      subtitle: `${data.today_sales_amount.toFixed(2)} €`,
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total vendus (montant)',
      value: `${data.today_sales_amount.toFixed(2)} €`,
      icon: ShoppingCart,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Produits vendus',
      value: data.total_products_sold,
      icon: Package,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  {card.title}
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{card.value}</p>
                {card.subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Sales */}
      {data.recent_sales && data.recent_sales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Mes dernières ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-semibold">Produit</th>
                    <th className="text-center py-2 font-semibold">Quantité</th>
                    <th className="text-right py-2 font-semibold">Total</th>
                    <th className="text-left py-2 font-semibold">Date & Heure</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_sales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">{sale.product_name}</td>
                      <td className="text-center py-3">{sale.quantity}</td>
                      <td className="text-right py-3 font-semibold text-green-600">
                        {sale.total_price.toFixed(2)} €
                      </td>
                      <td className="text-left py-3 text-gray-500">
                        {new Date(sale.sold_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message */}
      {(!data.recent_sales || data.recent_sales.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune vente enregistrée pour aujourd'hui</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
