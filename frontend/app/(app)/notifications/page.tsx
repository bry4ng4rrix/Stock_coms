'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Trash2, Mail, Package, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { djangoClient } from '@/lib/django-client';

const typeIcon = (type: string) => {
  switch (type) {
    case 'sale': return <Package className="h-4 w-4" />;
    case 'user': return <User className="h-4 w-4" />;
    case 'product': return <Mail className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const typeLabel = (type: string) => {
  switch (type) {
    case 'sale': return 'Vente';
    case 'product': return 'Produit';
    case 'user': return 'Utilisateur';
    default: return 'Autre';
  }
};

const formatDate = (value: string) => new Date(value).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.notifications.list();
      setNotifications(Array.isArray(data) ? data : data.results || []);
    } catch (error: any) {
      console.error('Notifications error:', error);
      toast.error('Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const toggleRead = async (notification: any) => {
    try {
      setActionLoading(true);
      await djangoClient.notifications.markRead(notification.id, !notification.is_read);
      toast.success(notification.is_read ? 'Notification marquée non lue' : 'Notification marquée lue');
      await fetchNotifications();
    } catch (error: any) {
      toast.error('Impossible de mettre à jour la notification.');
    } finally {
      setActionLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      setActionLoading(true);
      await djangoClient.notifications.markAllRead();
      toast.success('Toutes les notifications ont été marquées comme lues.');
      await fetchNotifications();
    } catch (error: any) {
      toast.error('Impossible de marquer toutes les notifications comme lues.');
    } finally {
      setActionLoading(false);
    }
  };

  const clearAll = async () => {
    try {
      setActionLoading(true);
      await djangoClient.notifications.deleteAll();
      toast.success('Toutes les notifications ont été supprimées.');
      setNotifications([]);
    } catch (error: any) {
      toast.error('Impossible de supprimer les notifications.');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      setActionLoading(true);
      await djangoClient.delete(`/users/notifications/${id}/`);
      toast.success('Notification supprimée.');
      await fetchNotifications();
    } catch (error: any) {
      toast.error('Impossible de supprimer la notification.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Toutes les alertes et mouvements enregistrés de l'application.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications} disabled={loading || actionLoading}>
            Actualiser
          </Button>
          <Button variant="secondary" size="sm" onClick={markAllRead} disabled={loading || actionLoading || notifications.length === 0}>
            Marquer tout lu
          </Button>
          <Button variant="destructive" size="sm" onClick={clearAll} disabled={loading || actionLoading || notifications.length === 0}>
            Supprimer tout
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Aucune notification pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 ${notification.is_read ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 shadow-sm'}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        {typeIcon(notification.notif_type)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span>{notification.message}</span>
                          <Badge className="bg-slate-100 text-slate-700">{typeLabel(notification.notif_type)}</Badge>
                          {!notification.is_read && <Badge className="bg-blue-100 text-blue-700">Nouveau</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {notification.product_name ? `Produit: ${notification.product_name}` : notification.sale_id ? `Vente #${notification.sale_id}` : notification.user_name ? `Utilisateur: ${notification.user_name}` : ''}
                          {notification.magasin_name ? ` · Magasin: ${notification.magasin_name}` : ''}
                          {notification.created_at ? ` · ${formatDate(notification.created_at)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="xs" variant="outline" onClick={() => toggleRead(notification)} disabled={actionLoading}>
                        {notification.is_read ? 'Marquer non lu' : 'Marquer lu'}
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => deleteNotification(notification.id)} disabled={actionLoading}>
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
