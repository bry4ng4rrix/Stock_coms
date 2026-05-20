'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Package, AlertTriangle, TrendingUp, DollarSign, Users, ShoppingBag,
  ArrowUp, ArrowDown, CheckCircle2,
} from 'lucide-react';
import { AIAnalysis } from '@/components/ai-analysis';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#f97316'];

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', { minimumFractionDigits: 0 }).format(Math.round(n));

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const supabase  = createClient();

  const [loading, setLoading] = useState(true);

  // KPIs
  const [kpis, setKpis] = useState({
    totalProducts:   0,
    totalQuantity:   0,
    totalValue:      0,
    totalEmployees:  0,
    lowStockCount:   0,
    outOfStockCount: 0,
  });

  // Charts
  const [weeklyTrend, setWeeklyTrend]       = useState<any[]>([]);
  const [categoryChart, setCategoryChart]   = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<any[]>([]);
  const [movementStats, setMovementStats] = useState<{fastest: any[], slowest: any[]}>({ fastest: [], slowest: [] });

  const getLast7Days = () => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push({ fullDate: d.toISOString().split('T')[0], label: days[d.getDay()] });
    }
    return result;
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Products (RLS auto-filters by store)
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, quantity, unit_price, reorder_level, status, category, expiry_date');

      // 2. Employees in the same store
      const { data: employees } = await supabase
        .from('users')
        .select('id, role, status')
        .neq('role', 'admin')
        .eq('status', 'approved');

      // 3. Recent movements (avec utilisateur pour traçabilité)
      const { data: movementsRecent } = await supabase
        .from('stock_movements')
        .select('id, type, quantity, created_at, products:product_id(name, sku), users:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(8);

      // 4. Weekly trend
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: weeklyData } = await supabase
        .from('stock_movements')
        .select('type, quantity, created_at, products:product_id(name)')
        .gte('created_at', sevenDaysAgo.toISOString());

      // ── Compute KPIs ─────────────────────────────────────────
      if (products) {
        let totalQuantity   = 0;
        let totalValue      = 0;
        let lowStockCount   = 0;
        let outOfStockCount = 0;
        const categoryMap: Record<string, number> = {};
        const lowProducts: any[] = [];

        products.forEach((p) => {
          const qty = p.quantity ?? 0;
          totalQuantity += qty;
          totalValue    += qty * (p.unit_price ?? 0);
          if (p.status === 'low')          { lowStockCount++;   lowProducts.push(p); }
          if (p.status === 'out_of_stock') { outOfStockCount++; lowProducts.push(p); }
          categoryMap[p.category || 'Autre'] = (categoryMap[p.category || 'Autre'] || 0) + qty;
        });

        setKpis({
          totalProducts:   products.length,
          totalQuantity,
          totalValue,
          totalEmployees:  employees?.length ?? 0,
          lowStockCount,
          outOfStockCount,
        });

        setCategoryChart(
          Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value),
        );

        setLowStockProducts(lowProducts.slice(0, 8));

        // ── Expiring products (within 30 days) ───────────────────
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        const expiring = products
          .filter(p => p.expiry_date && new Date(p.expiry_date) <= thirtyDaysFromNow)
          .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());
        
        setExpiringProducts(expiring.slice(0, 8));
      }

      // ── Recent movements ─────────────────────────────────────
      if (movementsRecent) setRecentMovements(movementsRecent);

      // ── Weekly trend ─────────────────────────────────────────
      if (weeklyData) {
        const last7Days = getLast7Days();
        setWeeklyTrend(
          last7Days.map((day) => {
            const dayMvts  = weeklyData.filter((m) => m.created_at.startsWith(day.fullDate));
            const entrées  = dayMvts.filter((m) => m.type === 'entry').reduce((s, m) => s + (m.quantity || 0), 0);
            const sorties  = dayMvts.filter((m) => m.type === 'exit').reduce((s, m) => s + (m.quantity || 0), 0);
            return { date: day.label, entrées, sorties };
          }),
        );
      }

      // ── Movement Stats for AI ──────────────────────────────
      if (products && weeklyData) {
        const statsMap: Record<string, { name: string; outQty: number }> = {};
        products.forEach((p) => {
          statsMap[p.name] = { name: p.name, outQty: 0 };
        });
        weeklyData.forEach((m) => {
          if (m.type === 'exit' && m.products?.name) {
            if (!statsMap[m.products.name]) {
              statsMap[m.products.name] = { name: m.products.name, outQty: 0 };
            }
            statsMap[m.products.name].outQty += (m.quantity || 0);
          }
        });
        const sorted = Object.values(statsMap).sort((a, b) => b.outQty - a.outQty);
        setMovementStats({
          fastest: sorted.slice(0, 5),
          slowest: sorted.filter((s) => s.outQty === 0).slice(0, 5),
        });
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── KPI Card helper ───────────────────────────────────────────
  const KpiCard = ({
    title, value, sub, icon: Icon, color = 'text-muted-foreground', accent,
  }: {
    title: string;
    value: string | number;
    sub: string;
    icon: any;
    color?: string;
    accent?: string;
  }) => (
    <Card className={accent}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className={`text-2xl font-bold ${color !== 'text-muted-foreground' ? color : ''}`}>{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">
          {user?.store_name ? `Magasin : ${user.store_name}` : 'Gestion des stocks cosmétiques'}
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="xl:col-span-2">
          <KpiCard
            title="Valeur du stock"
            value={`${fmt(kpis.totalValue)} Ar`}
            sub="Valeur totale de l'inventaire"
            icon={DollarSign}
          />
        </div>
        <KpiCard
          title="Produits"
          value={kpis.totalProducts}
          sub="Références en catalogue"
          icon={Package}
        />
        <KpiCard
          title="Unités en stock"
          value={fmt(kpis.totalQuantity)}
          sub="Total toutes références"
          icon={ShoppingBag}
        />
        <KpiCard
          title="Employés actifs"
          value={kpis.totalEmployees}
          sub="Personnel approuvé"
          icon={Users}
        />
        <KpiCard
          title="Alertes stock"
          value={kpis.lowStockCount + kpis.outOfStockCount}
          sub={`${kpis.outOfStockCount} rupture(s), ${kpis.lowStockCount} faible(s)`}
          icon={AlertTriangle}
          color="text-orange-600"
          accent={kpis.lowStockCount + kpis.outOfStockCount > 0 ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20' : ''}
        />
      </div>

      <AIAnalysis 
        fastest={movementStats.fastest} 
        slowest={movementStats.slowest} 
        expiring={expiringProducts}
      />

      {/* ── Charts ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mouvements — 7 derniers jours</CardTitle>
            <CardDescription>Entrées et sorties de stock</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="entrées" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sorties" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock par catégorie</CardTitle>
            <CardDescription>Unités par famille de produits</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : categoryChart.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                Aucune donnée
              </div>
            ) : categoryChart.length <= 5 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryChart}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {categoryChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Movements + Low Stock ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activités récentes
            </CardTitle>
            <CardDescription>8 derniers mouvements</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun mouvement enregistré</p>
            ) : (
              <div className="space-y-3">
                {recentMovements.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={`flex-shrink-0 p-1.5 rounded-full ${
                      m.type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {m.type === 'entry'
                        ? <ArrowUp className="h-4 w-4" />
                        : <ArrowDown className="h-4 w-4" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.products?.name ?? 'Produit inconnu'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {m.users?.full_name && (
                          <span className="ml-1">· {m.users.full_name}</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${
                      m.type === 'entry' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {m.type === 'entry' ? '+' : '-'}{m.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className={lowStockProducts.length > 0 ? 'border-orange-200' : ''}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${lowStockProducts.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              Alertes de stock
            </CardTitle>
            <CardDescription>Produits à réapprovisionner</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                <p className="text-sm font-medium text-green-700">Tous les stocks sont OK</p>
                <p className="text-xs text-muted-foreground mt-1">Aucun produit en alerte</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-semibold ${
                        p.status === 'out_of_stock' ? 'text-red-600' : 'text-orange-600'
                      }`}>
                        {p.quantity ?? 0} u.
                      </span>
                      <Badge className={
                        p.status === 'out_of_stock'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }>
                        {p.status === 'out_of_stock' ? 'Rupture' : 'Faible'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
