'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, TrendingUp, Package, RefreshCw } from 'lucide-react';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', { minimumFractionDigits: 0 }).format(Math.round(n));

export default function MovementsPage() {
  const { user, isAdmin, isManager } = useCurrentUser();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesData, productsData] = await Promise.all([
        djangoClient.sales.list(),
        djangoClient.products.list(),
      ]);
      setSales(salesData);
      setProducts(productsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredSales = useMemo(() =>
    sales.filter(s => {
      const term = searchTerm.toLowerCase();
      return !term ||
        (s.product_name || '').toLowerCase().includes(term) ||
        (s.seller_name || '').toLowerCase().includes(term) ||
        (s.shop_name || '').toLowerCase().includes(term);
    }),
    [sales, searchTerm]
  );

  const movementStats = useMemo(() => {
    const statsMap: Record<string, { name: string; outQty: number }> = {};
    sales.forEach(s => {
      const name = s.product_name || 'Produit inconnu';
      if (!statsMap[name]) statsMap[name] = { name, outQty: 0 };
      statsMap[name].outQty += s.quantity || 0;
    });
    const sorted = Object.values(statsMap).sort((a, b) => b.outQty - a.outQty);
    return {
      fastest: sorted.slice(0, 5),
      slowest: products
        .filter(p => !sorted.some(s => s.name === p.name))
        .slice(0, 5)
        .map(p => ({ name: p.name, outQty: 0 })),
    };
  }, [sales, products]);

  const totalRevenue = useMemo(() =>
    sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0), [sales]);

  const totalQty = useMemo(() =>
    sales.reduce((sum, s) => sum + (s.quantity || 0), 0), [sales]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const groupedByDay = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const groups: Record<string, any[]> = {};
    filteredSales.forEach(s => {
      const day = new Date(s.sold_at).toISOString().split('T')[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(s);
    });
    return { groups, today };
  }, [filteredSales]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mouvements de stock</h1>
          <p className="text-muted-foreground mt-1">Historique complet des sorties</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher produit, vendeur..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-red-500" />Total sorties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{totalQty} unités</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />Chiffre d'affaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold">{fmt(totalRevenue)} Ar</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />Nb transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{sales.length}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-green-600">
              <TrendingUp className="mr-2 h-5 w-5" />Produits les plus vendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                {movementStats.fastest.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune vente enregistrée.</p>
                ) : movementStats.fastest.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">{p.outQty} vendus</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-orange-600">
              <ArrowDown className="mr-2 h-5 w-5" />Produits sans vente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                {movementStats.slowest.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tous les produits ont été vendus.</p>
                ) : movementStats.slowest.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">0 vente</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des sorties (ventes)</CardTitle>
          <CardDescription>{filteredSales.length} transaction(s) affichée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Prix unitaire</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vendeur</TableHead>
                    {isManager && <TableHead>Magasin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 8 : 7} className="text-center text-muted-foreground py-8">
                        Aucune vente enregistrée
                      </TableCell>
                    </TableRow>
                  ) : filteredSales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.sold_at)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{s.product_name || `Produit #${s.product}`}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          Sortie
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          <ArrowDown className="h-3 w-3 mr-1 inline" />{s.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmt(Number(s.sale_price || 0))} Ar</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{fmt(Number(s.total_price || 0))} Ar</TableCell>
                      <TableCell className="text-sm">{s.seller_name || 'Système'}</TableCell>
                      {isManager && (
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                            {s.shop_name || '-'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouped by day */}
      <DailySalesTable groups={groupedByDay.groups} today={groupedByDay.today} isManager={isManager} />
    </div>
  );
}

function DailySalesTable({ groups, today, isManager }: { groups: Record<string, any[]>; today: string; isManager: boolean }) {
  const sortedDates = Object.keys(groups).filter(d => d !== today).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return null;

  const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(Math.round(n));

  const label = (dateKey: string) => {
    const d = new Date(dateKey);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const same = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, yesterday)) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Ventes par jour</h2>
      {sortedDates.map(dateKey => (
        <Card key={dateKey}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 capitalize">
              {label(dateKey)}
              <Badge variant="outline">{groups[dateKey].length} vente(s)</Badge>
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {fmt(groups[dateKey].reduce((s, x) => s + Number(x.total_price || 0), 0))} Ar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vendeur</TableHead>
                    {isManager && <TableHead>Magasin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups[dateKey].map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {new Date(s.sold_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{s.product_name || `Produit #${s.product}`}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-red-50 text-red-700">Sortie</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{s.quantity}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{fmt(Number(s.total_price || 0))} Ar</TableCell>
                      <TableCell className="text-sm">{s.seller_name || 'Système'}</TableCell>
                      {isManager && (
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                            {s.shop_name || '-'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
