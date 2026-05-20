'use client';

import { ProtectedRoute } from '@/lib/protected-route';
import { useAuth } from '@/lib/auth-context';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, Users, Package, ShoppingCart, AlertTriangle, Store } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface DashboardKPIs {
  total_revenue: number;
  total_profit: number;
  total_stock_value: number;
  total_magasins: number;
  total_employers: number;
  total_products: number;
  total_sales: number;
  sales_today: number;
  profit_today: number;
  low_stock_count: number;
  expired_count: number;
  expiring_soon_count: number;
}

interface TopProduct {
  product__name: string;
  product__magasin__shop_name: string;
  qty_sold: number;
  profit: number;
}

interface BestShop {
  magasin__shop_name: string;
  total_amount: number;
  profit: number;
  sales_count: number;
  total_stock: number;
}

interface RecentSale {
  product_name: string;
  quantity: number;
  sale_price: number;
  total_price: number;
  seller_name: string;
  shop_name: string;
  sold_at: string;
}

interface DashboardData {
  role: string;
  kpis: DashboardKPIs;
  lists: {
    top_products: TopProduct[];
    bottom_products: any[];
    low_stock_products: any[];
    expired_products: any[];
    expiring_soon_products: any[];
    recent_sales: RecentSale[];
    best_employees: any[];
    best_shops: BestShop[];
  };
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { data, error, isLoading } = useSWR<DashboardData>('/dashboard/', fetcher);

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
      title: 'Chiffre d\'affaires',
      value: `${data.kpis.total_revenue.toFixed(2)} €`,
      icon: TrendingUp,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Bénéfices totaux',
      value: `${data.kpis.total_profit.toFixed(2)} €`,
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Valeur stock',
      value: `${data.kpis.total_stock_value.toFixed(2)} €`,
      icon: Package,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Magasins',
      value: data.kpis.total_magasins,
      icon: Store,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'Employés',
      value: data.kpis.total_employers,
      icon: Users,
      color: 'bg-pink-100 text-pink-600',
    },
    {
      title: 'Produits',
      value: data.kpis.total_products,
      icon: Package,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Ventes du jour',
      value: data.kpis.sales_today,
      icon: ShoppingCart,
      color: 'bg-cyan-100 text-cyan-600',
    },
    {
      title: 'Profit du jour',
      value: `${data.kpis.profit_today.toFixed(2)} €`,
      icon: TrendingUp,
      color: 'bg-emerald-100 text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Alerts */}
      {data.kpis.low_stock_count > 0 && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {data.kpis.low_stock_count} produit(s) en stock faible
          </AlertDescription>
        </Alert>
      )}
      {data.kpis.expired_count > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {data.kpis.expired_count} produit(s) expiré(s)
          </AlertDescription>
        </Alert>
      )}
      {data.kpis.expiring_soon_count > 0 && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ⚠️ {data.kpis.expiring_soon_count} produit(s) expire dans moins de 30 jours
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        {/* Top Products */}
        {data.lists.top_products && data.lists.top_products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Produits les plus vendus</CardTitle>
              <CardDescription>Produits avec les meilleures ventes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.lists.top_products.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between pb-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{product.product__name}</p>
                      <p className="text-sm text-gray-500">{product.qty_sold} vendues • {product.product__magasin__shop_name}</p>
                    </div>
                    <p className="text-lg font-bold text-green-600">
                      +{product.profit.toFixed(2)} €
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ventes Récentes */}
        {data.lists.recent_sales && data.lists.recent_sales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dernières ventes</CardTitle>
              <CardDescription>Les 5 derniers enregistrements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.lists.recent_sales.slice(0, 5).map((sale, index) => (
                  <div key={index} className="flex items-center justify-between pb-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium text-sm">{sale.product_name}</p>
                      <p className="text-xs text-gray-500">{sale.seller_name} - {sale.shop_name}</p>
                      <p className="text-xs text-gray-400">{new Date(sale.sold_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600">
                      {sale.quantity}x {sale.sale_price.toFixed(2)} €
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stocks Alertes */}
      {data.lists.low_stock_products && data.lists.low_stock_products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produits en stock faible</CardTitle>
            <CardDescription>{data.lists.low_stock_products.length} article(s) à réapprovisionner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-semibold">Produit</th>
                    <th className="text-right py-2 font-semibold">Stock</th>
                    <th className="text-right py-2 font-semibold">Alerte</th>
                    <th className="text-left py-2 font-semibold">Magasin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.low_stock_products.map((product, index) => (
                    <tr key={index} className="border-b hover:bg-yellow-50">
                      <td className="py-3">{product.name}</td>
                      <td className="text-right py-3 font-semibold text-orange-600">{product.initial_quantity}</td>
                      <td className="text-right py-3 text-red-600">{product.alert_threshold}</td>
                      <td className="py-3">{product.magasin__shop_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Stores */}
      {data.lists.best_shops && data.lists.best_shops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meilleurs magasins</CardTitle>
            <CardDescription>Classement par chiffre d&apos;affaires</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-semibold">Magasin</th>
                    <th className="text-right py-2 font-semibold">Chiffre d&apos;affaires</th>
                    <th className="text-right py-2 font-semibold">Bénéfices</th>
                    <th className="text-right py-2 font-semibold">Ventes</th>
                    <th className="text-right py-2 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.best_shops.map((shop, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{shop.magasin__shop_name}</td>
                      <td className="text-right py-3">{shop.total_amount.toFixed(2)} €</td>
                      <td className="text-right py-3 text-green-600 font-semibold">{shop.profit.toFixed(2)} €</td>
                      <td className="text-right py-3">{shop.sales_count}</td>
                      <td className="text-right py-3">{shop.total_stock} unités</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
