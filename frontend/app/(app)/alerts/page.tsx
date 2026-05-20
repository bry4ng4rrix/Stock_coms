'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface StockAlert {
  id: string;
  product_id: string;
  size: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'reorder' | 'expiring' | 'expired';
  current_quantity: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  expiry_date?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'resolved'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadAlerts();
  }, [filterType]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('stock_alerts')
        .select(`
          *,
          product:product_id(id, name, sku)
        `)
        .order('created_at', { ascending: false });

      if (filterType === 'active') {
        query = query.eq('is_active', true);
      } else if (filterType === 'resolved') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedAlerts = data?.map((alert: any) => ({
        ...alert,
        product: alert.product || null,
      })) || [];

      // Fetch expiring products
      const today = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(today.getDate() + 30);
      const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      const { data: expiringProducts } = await supabase
        .from('products')
        .select('id, name, sku, quantity, expiry_date')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysStr);

      const expiringAlerts = (expiringProducts || []).map((p: any) => {
        const isExpired = p.expiry_date < todayStr;
        return {
          id: `expiry-${p.id}`,
          product_id: p.id,
          size: '-',
          alert_type: isExpired ? 'expired' : 'expiring',
          current_quantity: p.quantity || 0,
          reorder_level: 0,
          is_active: true,
          created_at: p.expiry_date, // used for sorting
          expiry_date: p.expiry_date,
          product: {
            id: p.id,
            name: p.name,
            sku: p.sku,
          }
        };
      });

      let allData = [...formattedAlerts];
      if (filterType === 'all' || filterType === 'active') {
         allData = [...allData, ...expiringAlerts];
      }
      
      allData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAlerts(allData);
    } catch (error) {
      console.error('[v0] Error loading alerts:', error);
      toast.error('Erreur lors du chargement des alertes');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      setResolving(alertId);
      const { error } = await supabase
        .from('stock_alerts')
        .update({
          is_active: false,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, is_active: false } : alert
        )
      );

      toast.success('Alerte marquée comme résolue');
    } catch (error) {
      console.error('[v0] Error resolving alert:', error);
      toast.error('Erreur lors de la résolution de l\'alerte');
    } finally {
      setResolving(null);
    }
  };

  const reactivateAlert = async (alertId: string) => {
    try {
      setResolving(alertId);
      const { error } = await supabase
        .from('stock_alerts')
        .update({
          is_active: true,
          resolved_at: null,
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, is_active: true } : alert
        )
      );

      toast.success('Alerte réactivée');
    } catch (error) {
      console.error('[v0] Error reactivating alert:', error);
      toast.error('Erreur lors de la réactivation de l\'alerte');
    } finally {
      setResolving(null);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'reorder':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'low_stock':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'expiring':
        return <AlertCircle className="w-5 h-5 text-purple-500" />;
      case 'expired':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'out_of_stock':
        return <Badge className="bg-red-500">Rupture de stock</Badge>;
      case 'reorder':
        return <Badge className="bg-orange-500">À réapprovisionner</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500">Stock faible</Badge>;
      case 'expiring':
        return <Badge className="bg-purple-500">Expirant bientôt</Badge>;
      case 'expired':
        return <Badge className="bg-red-600">Expiré</Badge>;
      default:
        return null;
    }
  };

  const activeAlerts = alerts.filter((a) => a.is_active);
  const resolvedAlerts = alerts.filter((a) => !a.is_active);
  const filteredAlerts = filterType === 'all' 
    ? alerts 
    : filterType === 'active' 
    ? activeAlerts 
    : resolvedAlerts;

  const displayedAlerts = filteredAlerts.filter((alert) =>
    !searchTerm ||
    alert.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Alertes actives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{activeAlerts.length}</div>
            <p className="text-xs text-slate-500 mt-1">Nécessitent une action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Ruptures de stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {activeAlerts.filter((a) => a.alert_type === 'out_of_stock').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Produits en rupture</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Alertes résolues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{resolvedAlerts.length}</div>
            <p className="text-xs text-slate-500 mt-1">Action complétée</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alertes de stock</CardTitle>
              <CardDescription>Gestion des alertes et notifications de stock</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-col sm:flex-row">
            <Input
              placeholder="Rechercher par nom ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les alertes</SelectItem>
                <SelectItem value="active">Alertes actives</SelectItem>
                <SelectItem value="resolved">Alertes résolues</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* No Alerts */}
          {displayedAlerts.length === 0 && !loading && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                {filterType === 'active'
                  ? 'Aucune alerte active - Votre stock est bien géré!'
                  : 'Aucune alerte trouvée'}
              </AlertDescription>
            </Alert>
          )}

          {/* Alerts Table */}
          {!loading && displayedAlerts.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité / Limite</TableHead>
                    <TableHead>Créée</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{getAlertIcon(alert.alert_type)}</TableCell>
                      <TableCell className="font-medium">{alert.product?.name || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{alert.product?.sku}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{alert.size}</Badge>
                      </TableCell>
                      <TableCell>{getAlertBadge(alert.alert_type)}</TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <span className="font-semibold text-red-500">{alert.current_quantity}</span>
                          <span className="text-slate-500"> / {alert.reorder_level}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {alert.is_active ? (
                          alert.alert_type === 'expiring' || alert.alert_type === 'expired' ? (
                            <Button variant="outline" size="sm" onClick={() => window.location.href='/products'}>
                              Gérer le produit
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveAlert(alert.id)}
                              disabled={resolving === alert.id}
                            >
                              {resolving === alert.id && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              Résoudre
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reactivateAlert(alert.id)}
                            disabled={resolving === alert.id}
                          >
                            Réactiver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
