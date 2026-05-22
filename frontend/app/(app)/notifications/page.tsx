'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell, CheckCheck, Trash2, Package, ShoppingCart, Users, ArrowUpDown,
  Shield, AlertTriangle, Info, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const NOTIF_ICONS: Record<string, any> = {
  sale: ShoppingCart,
  product: Package,
  user: Users,
  movement: ArrowUpDown,
  alert: AlertTriangle,
  approval: Shield,
  other: Info,
};

const NOTIF_COLORS: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  product: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  user: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  movement: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  alert: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  approval: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const NOTIF_LABELS: Record<string, string> = {
  sale: 'Vente',
  product: 'Produit',
  user: 'Utilisateur',
  movement: 'Mouvement',
  alert: 'Alerte',
  approval: 'Approbation',
  other: 'Autre',
};

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.notifications.list();
      setNotifications(data);
    } catch (err: any) {
      toast.error('Erreur de chargement: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const filtered = notifications.filter(n => {
    const matchType = filterType === 'all' || n.notif_type === filterType;
    const matchRead = filterRead === 'all' || (filterRead === 'unread' ? !n.is_read : n.is_read);
    return matchType && matchRead;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)));
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await djangoClient.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Toutes les notifications marquées comme lues');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setActionLoading(true);
    try {
      await djangoClient.notifications.deleteAll();
      setNotifications([]);
      setSelectedIds(new Set());
      toast.success('Toutes les notifications supprimées');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkRead = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await djangoClient.notifications.bulkRead(Array.from(selectedIds));
      setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, is_read: true } : n));
      setSelectedIds(new Set());
      toast.success('Notifications marquées comme lues');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await djangoClient.notifications.bulkDelete(Array.from(selectedIds));
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
      toast.success('Notifications supprimées');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkOne = async (id: number) => {
    try {
      await djangoClient.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleDeleteOne = async (id: number) => {
    try {
      await djangoClient.notifications.deleteOne(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" /> Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Toutes lues'} — {notifications.length} au total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={actionLoading || unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-2" />Tout marquer lu
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={actionLoading || notifications.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />Tout supprimer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(NOTIF_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRead} onValueChange={setFilterRead}>
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="unread">Non lues</SelectItem>
            <SelectItem value="read">Lues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
          <Button variant="outline" size="sm" onClick={handleBulkRead} disabled={actionLoading}>
            <CheckCheck className="h-4 w-4 mr-1" />Marquer lu
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={actionLoading}>
            <Trash2 className="h-4 w-4 mr-1" />Supprimer
          </Button>
        </div>
      )}

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Notifications ({filtered.length})</span>
            {filtered.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-normal text-muted-foreground">Tout sélectionner</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(notif => {
                const Icon = NOTIF_ICONS[notif.notif_type] || Info;
                const colorCls = NOTIF_COLORS[notif.notif_type] || NOTIF_COLORS.other;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      notif.is_read ? 'bg-background' : 'bg-muted/50 border-primary/20'
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(notif.id)}
                      onCheckedChange={() => toggleSelect(notif.id)}
                      className="mt-1"
                    />
                    <div className={`p-2 rounded-full ${colorCls} flex-shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={colorCls} variant="secondary">
                          {NOTIF_LABELS[notif.notif_type] || notif.notif_type}
                        </Badge>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        {notif.magasin_name && (
                          <span className="text-xs text-muted-foreground">{notif.magasin_name}</span>
                        )}
                      </div>
                      <p className="text-sm">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(notif.created_at)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!notif.is_read && (
                        <Button variant="ghost" size="sm" onClick={() => handleMarkOne(notif.id)} title="Marquer comme lu">
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteOne(notif.id)} title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
