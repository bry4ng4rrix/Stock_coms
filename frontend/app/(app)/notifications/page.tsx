'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import {
  Bell, CheckCheck, Trash2, Package, ShoppingCart, UserPlus, Info,
  Loader2, Search, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Notification {
  id: number;
  notif_type: 'sale' | 'product' | 'user' | 'other';
  message: string;
  magasin: number | null;
  magasin_name: string | null;
  product: number | null;
  product_name: string | null;
  sale: number | null;
  sale_id: number | null;
  user: number | null;
  user_name: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  sale:    { icon: ShoppingCart, label: 'Vente',    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  product: { icon: Package,     label: 'Produit',  color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  user:    { icon: UserPlus,    label: 'Utilisateur', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  other:   { icon: Info,        label: 'Autre',    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400' },
};

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      toast.error('Erreur de chargement des notifications: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const filtered = notifications.filter(n => {
    const matchSearch = n.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.magasin_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.product_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || n.notif_type === filterType;
    const matchRead = filterRead === 'all' ||
      (filterRead === 'unread' && !n.is_read) ||
      (filterRead === 'read' && n.is_read);
    return matchSearch && matchType && matchRead;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)));
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await djangoClient.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
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

  const handleDelete = async (id: number) => {
    try {
      await djangoClient.notifications.deleteOne(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await djangoClient.notifications.bulkDelete(Array.from(selectedIds));
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} notification(s) supprimée(s)`);
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8" /> Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-sm">{unreadCount} non lue(s)</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Historique de tous les mouvements et événements</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={actionLoading}>
              <CheckCheck className="h-4 w-4 mr-2" />Tout marquer comme lu
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={actionLoading} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" />Tout supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une notification..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-44">
            <Filter className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="sale">Ventes</SelectItem>
            <SelectItem value="product">Produits</SelectItem>
            <SelectItem value="user">Utilisateurs</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
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
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
          <Button variant="outline" size="sm" onClick={handleBulkRead} disabled={actionLoading}>
            <CheckCheck className="h-4 w-4 mr-1" />Marquer comme lu
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={actionLoading} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-1" />Supprimer
          </Button>
        </div>
      )}

      {/* Notifications list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {filtered.length > 0
              ? `${filtered.length} notification(s)`
              : 'Notifications'
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {notifications.length === 0
                  ? "Aucune notification pour l'instant."
                  : 'Aucune notification ne correspond aux filtres.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">Tout sélectionner</span>
              </div>

              {filtered.map(notif => {
                const config = TYPE_CONFIG[notif.notif_type] || TYPE_CONFIG.other;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      notif.is_read
                        ? 'bg-background hover:bg-muted/30'
                        : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    }`}
                    onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(notif.id)}
                      onCheckedChange={() => toggleSelect(notif.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={`p-2 rounded-full flex-shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                          {config.label}
                        </Badge>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {fmtDate(notif.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm ${notif.is_read ? 'text-muted-foreground' : 'font-medium'}`}>
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {notif.magasin_name && <span>📍 {notif.magasin_name}</span>}
                        {notif.product_name && <span>📦 {notif.product_name}</span>}
                        {notif.user_name && <span>👤 {notif.user_name}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
