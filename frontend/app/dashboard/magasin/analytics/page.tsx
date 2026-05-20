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
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  weekly_sales: Array<{ date: string; sales: number }>;
  weekly_profit: Array<{ date: string; profit: number }>;
  popular_products: Array<{ name: string; quantity: number }>;
  category_distribution: Array<{ name: string; value: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function MagasinAnalyticsPage() {
  return (
    <ProtectedRoute requiredRoles={['magasin']}>
      <MagasinAnalyticsContent />
    </ProtectedRoute>
  );
}

function MagasinAnalyticsContent() {
  const { data, error, isLoading } = useSWR<AnalyticsData>(
    '/analytics/',
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
        <AlertDescription>Erreur lors du chargement des analyses</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Analyses de mon magasin</h1>
        <p className="text-gray-600">Vue d&apos;ensemble des performances</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Sales */}
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

        {/* Weekly Profit */}
        {data.weekly_profit && data.weekly_profit.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bénéfices de la semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.weekly_profit}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="profit" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Products */}
        {data.popular_products && data.popular_products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Produits populaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.popular_products.slice(0, 5).map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {product.quantity}
                    </p>
                    <p className="text-xs text-gray-600">vendues</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Category Distribution */}
        {data.category_distribution && data.category_distribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Répartition par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.category_distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.category_distribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
