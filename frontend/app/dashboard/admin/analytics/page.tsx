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
  BarChart,
  Bar,
  LineChart,
  Line,
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
  sales_trend: Array<{ date: string; sales: number; profit: number }>;
  products_by_category: Array<{ name: string; value: number }>;
  sales_by_store: Array<{ name: string; sales: number }>;
  top_employees: Array<{ name: string; sales_count: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminAnalyticsPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminAnalyticsContent />
    </ProtectedRoute>
  );
}

function AdminAnalyticsContent() {
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
        <h1 className="text-3xl font-bold">Analyses détaillées</h1>
        <p className="text-gray-600">Vue d&apos;ensemble des performances</p>
      </div>

      {/* Sales Trend */}
      {data.sales_trend && data.sales_trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution des ventes et profits</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data.sales_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  name="Ventes (€)"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  name="Profits (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products by Category */}
        {data.products_by_category && data.products_by_category.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Répartition par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.products_by_category}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.products_by_category.map((entry, index) => (
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

        {/* Sales by Store */}
        {data.sales_by_store && data.sales_by_store.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ventes par magasin</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.sales_by_store}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Employees */}
      {data.top_employees && data.top_employees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meilleurs employés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.top_employees.map((employee, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <p className="font-medium">{employee.name}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      {employee.sales_count} ventes
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
