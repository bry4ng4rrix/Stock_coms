'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Package, Clock, ShieldAlert, Info, Check, Trash2, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AdminGuard } from '@/components/auth/admin-guard';

export default function NotificationsPage() {
  return (
    <AdminGuard>
      <NotificationsContent />
    </AdminGuard>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('notifications-page-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) setNotifications(data);
    } catch (e: any) {
      toast.error('Erreur lors du chargement des notifications: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      toast.error('Erreur');
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('Toutes les notifications ont été marquées comme lues.');
    } catch (e) {
      toast.error('Erreur');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification supprimée.');
    } catch (e) {
      toast.error('Erreur');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'stock_alert':
        return <Package className="h-5 w-5 text-orange-500" />;
      case 'expiration_alert':
        return <Clock className="h-5 w-5 text-red-500" />;
      case 'approval_request':
        return <ShieldAlert className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Historique complet de vos alertes.</p>
        </div>
        <Button onClick={markAllAsRead} variant="outline" className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          Tout marquer comme lu
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Toutes les notifications
          </CardTitle>
          <CardDescription>
            Alertes de stock, péremption, et accès utilisateurs (100 dernières)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <Bell className="h-12 w-12 text-slate-200 mb-4" />
              <p>Aucune notification enregistrée.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex flex-col sm:flex-row gap-4 p-4 rounded-lg border transition-colors ${
                    !notif.is_read ? 'bg-blue-50/50 border-blue-100' : 'bg-card'
                  }`}
                >
                  <div className={`mt-1 flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${!notif.is_read ? 'bg-white shadow-xs' : 'bg-muted'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`font-semibold text-sm ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <p className={`text-sm ${!notif.is_read ? 'text-slate-800' : 'text-muted-foreground'}`}>
                      {notif.message}
                    </p>
                  </div>
                  <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notif.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-8"
                      >
                        <Check className="h-4 w-4 mr-1" /> Lu
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notif.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
