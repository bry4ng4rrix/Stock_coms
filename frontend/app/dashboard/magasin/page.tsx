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
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface MagasinDashboardData {
  today_sales: number;
  today_profit: number;
  total_stock_value: number;
  total_products: number;
  total_sales: number;
  low_stock_count: number;
  expired_products_count: number;
  top_sellers: Array<{
    name: string;
    sales_count: number;
    total_amount: number;
  }>;
  top_products: Array<{
    name: string;
    quantity: number;
  }>;
  low_stock_products: Array<{
    name: string;
    quantity: number;
    threshold: number;
  }>;
  weekly_sales: Array<{
    date: string;
    sales: number;
  }>;
}

export default function MagasinDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['magasin']}>
      <MagasinDashboardContent />
    </ProtectedRoute>
  );
}

function MagasinDashboardContent() {
  const { data, error, isLoading } = useSWR<MagasinDashboardData>(
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
      title: 'Ventes du jour',
      value: `${data.today_sales.toFixed(2)} €`,
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Profit du jour',
      value: `${data.today_profit.toFixed(2)} €`,
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Valeur stock',
      value: `${data.total_stock_value.toFixed(2)} €`,
      icon: Package,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Produits',
      value: data.total_products,
      icon: Package,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Total ventes',
      value: data.total_sales,
      icon: ShoppingCart,
      color: 'bg-cyan-100 text-cyan-600',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Alerts */}
      {data.low_stock_count > 0 && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {data.low_stock_count} produit(s) en stock faible
          </AlertDescription>
        </Alert>
      )}
      {data.expired_products_count > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {data.expired_products_count} produit(s) expiré(s)
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Sales Chart */}
        {data.weekly_sales && data.weekly_sales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ventes de la semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.weekly_sales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        {data.top_products && data.top_products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Produits populaires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.top_products.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between pb-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.quantity} vendues</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meilleurs vendeurs */}
      {data.top_sellers && data.top_sellers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meilleurs vendeurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-semibold">Vendeur</th>
                    <th className="text-right py-2 font-semibold">Nombre de ventes</th>
                    <th className="text-right py-2 font-semibold">Montant total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_sellers.map((seller, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3">{seller.name}</td>
                      <td className="text-right py-3">{seller.sales_count}</td>
                      <td className="text-right py-3 font-semibold text-green-600">
                        {seller.total_amount.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock faible */}
      {data.low_stock_products && data.low_stock_products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Produits en stock faible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.low_stock_products.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      Stock: {product.quantity} / Seuil: {product.threshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
