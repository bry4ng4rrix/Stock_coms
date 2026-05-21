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
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [movementsData, productsData] = await Promise.all([
        djangoClient.movements.list(),
        djangoClient.products.list(),
      ]);
      setMovements(movementsData);
      setProducts(productsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredMovements = useMemo(() =>
    movements.filter(m => {
      const term = searchTerm.toLowerCase();
      return !term ||
        (m.product_name || '').toLowerCase().includes(term) ||
        (m.changed_by_name || '').toLowerCase().includes(term) ||
        (m.magasin_name || '').toLowerCase().includes(term) ||
        (m.note || '').toLowerCase().includes(term);
    }),
    [movements, searchTerm]
  );

  const movementStats = useMemo(() => {
    const statsMap: Record<string, { name: string; qty: number }> = {};
    movements.forEach(m => {
      const name = m.product_name || 'Produit inconnu';
      if (!statsMap[name]) statsMap[name] = { name, qty: 0 };
      statsMap[name].qty += Math.abs(m.change || 0);
    });
    const sorted = Object.values(statsMap).sort((a, b) => b.qty - a.qty);
    return {
      fastest: sorted.slice(0, 5),
      slowest: products
        .filter(p => !sorted.some(s => s.name === p.name))
        .slice(0, 5)
        .map(p => ({ name: p.name, qty: 0 })),
    };
  }, [movements, products]);

  const totalEntries = useMemo(() =>
    movements.reduce((sum, m) => sum + (m.change > 0 ? m.change : 0), 0), [movements]);

  const totalExits = useMemo(() =>
    movements.reduce((sum, m) => sum + (m.change < 0 ? Math.abs(m.change) : 0), 0), [movements]);

  const totalMovements = useMemo(() => movements.length, [movements]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const groupedByDay = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const groups: Record<string, any[]> = {};
    filteredMovements.forEach(m => {
      const day = new Date(m.created_at).toISOString().split('T')[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(m);
    });
    return { groups, today };
  }, [filteredMovements]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mouvements de stock</h1>
          <p className="text-muted-foreground mt-1">Historique complet des mouvements de stock</p>
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
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{fmt(totalExits)} unités</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />Total entrées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold">{fmt(totalEntries)} unités</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />Nb mouvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{totalMovements}</div>}
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
                  <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
                ) : movementStats.fastest.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">{p.qty} unités</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-orange-600">
            <ArrowDown className="mr-2 h-5 w-5" />Produits sans mouvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                {movementStats.slowest.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tous les produits ont été mouvementés.</p>
                ) : movementStats.slowest.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">0 mouvement</Badge>
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
          <CardTitle>Historique des mouvements de stock</CardTitle>
          <CardDescription>{filteredMovements.length} mouvement(s) affiché(s)</CardDescription>
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
                    <TableHead>Note</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    {isManager && <TableHead>Magasin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 7 : 6} className="text-center text-muted-foreground py-8">
                        Aucun mouvement enregistré
                      </TableCell>
                    </TableRow>
                  ) : filteredMovements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{formatDate(m.created_at)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{m.product_name || `Produit #${m.product}`}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.movement_type === 'Entrée'
                              ? 'bg-green-50 text-green-700'
                              : m.movement_type === 'Sortie'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-orange-50 text-orange-700'
                          }
                        >
                          {m.movement_type || 'Mise à jour'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Badge
                          variant="outline"
                          className={
                            m.change > 0
                              ? 'bg-green-50 text-green-700'
                              : m.change < 0
                              ? 'bg-red-50 text-red-700'
                              : 'bg-orange-50 text-orange-700'
                          }
                        >
                          {m.change > 0 ? '+' : ''}{m.change}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.note || '-'}</TableCell>
                      <TableCell className="text-sm">{m.changed_by_name || 'Système'}</TableCell>
                      {isManager && (
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                            {m.magasin_name || '-'}
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
      <DailyMovementsTable groups={groupedByDay.groups} today={groupedByDay.today} isManager={isManager} />
    </div>
  );
}

function DailyMovementsTable({ groups, today, isManager }: { groups: Record<string, any[]>; today: string; isManager: boolean }) {
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
      <h2 className="text-xl font-bold tracking-tight">Mouvements par jour</h2>
      {sortedDates.map(dateKey => (
        <Card key={dateKey}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 capitalize">
              {label(dateKey)}
              <Badge variant="outline">{groups[dateKey].length} mouvement(s)</Badge>
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {fmt(groups[dateKey].reduce((s, x) => s + Math.abs(x.change || 0), 0))} unités
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
                    <TableHead>Note</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    {isManager && <TableHead>Magasin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups[dateKey].map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.product_name || `Produit #${m.product}`}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.movement_type === 'Entrée'
                              ? 'bg-green-50 text-green-700'
                              : m.movement_type === 'Sortie'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-orange-50 text-orange-700'
                          }
                        >
                          {m.movement_type || 'Mise à jour'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Badge
                          variant="outline"
                          className={
                            m.change > 0
                              ? 'bg-green-50 text-green-700'
                              : m.change < 0
                              ? 'bg-red-50 text-red-700'
                              : 'bg-orange-50 text-orange-700'
                          }
                        >
                          {m.change > 0 ? '+' : ''}{m.change}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.note || '-'}</TableCell>
                      <TableCell className="text-sm">{m.changed_by_name || 'Système'}</TableCell>
                      {isManager && (
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                            {m.magasin_name || '-'}
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
