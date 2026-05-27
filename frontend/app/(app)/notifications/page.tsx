'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Bell, Trash2, Mail, Package, User ,CheckCheck, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
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
    case 'chat': return <MessageSquare className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const typeLabel = (type: string) => {
  switch (type) {
    case 'sale': return 'Vente';
    case 'product': return 'Produit';
    case 'user': return 'Utilisateur';
    case 'chat': return 'Chat';
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

  // WebSocket state
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.notifications.list() as any;
      setNotifications(Array.isArray(data) ? data : data.results || []);
    } catch (error: any) {
      console.error('Notifications error:', error);
      toast.error('Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect WebSockets for Realtime notifications
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    const token = djangoClient.getAccessToken();
    if (!token) return;

    setSocketStatus('connecting');

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiURL = process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000/api';
    const host = apiURL.replace(/^https?:\/\//, '').split('/')[0];
    const wsUrl = `${wsProto}//${host}/ws/notifications/?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketStatus('connected');
        console.log('Realtime Notifications connected');
      };

      ws.onmessage = (event) => {
        try {
          const newNotif = JSON.parse(event.data);
          
          setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            
            // Trigger beautiful audio-visual alert
            toast.info(newNotif.message, {
              description: `Type: ${typeLabel(newNotif.notif_type)}`,
              duration: 5000,
            });
            
            return [newNotif, ...prev];
          });
        } catch (e) {
          console.error('Error parsing incoming WS notification:', e);
        }
      };

      ws.onclose = (event) => {
        setSocketStatus('disconnected');
        console.log('Realtime Notifications disconnected:', event.reason);
        
        // Auto reconnect
        if (socketRef.current === ws) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Reconnecting notifications...');
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('Notifications WebSocket error:', err);
        setSocketStatus('disconnected');
      };
    } catch (error) {
      console.error('Error connecting to notifications socket:', error);
      setSocketStatus('disconnected');
    }
  }, []);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocketStatus('disconnected');
  }, []);

  useEffect(() => {
    fetchNotifications();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [fetchNotifications, connectWebSocket, disconnectWebSocket]);

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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">Toutes les alertes et mouvements enregistrés de l'application.</p>
            {socketStatus === 'connected' ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] flex items-center gap-1.5 rounded-full py-0.5 px-2.5 ml-2 select-none animate-in fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Temps Réel
              </Badge>
            ) : socketStatus === 'connecting' ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] flex items-center gap-1.5 rounded-full py-0.5 px-2.5 ml-2 select-none animate-in fade-in">
                <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                Connexion...
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] flex items-center gap-1.5 rounded-full py-0.5 px-2.5 ml-2 select-none animate-in fade-in">
                <AlertCircle className="h-3 w-3 text-rose-500" />
                Déconnecté
              </Badge>
            )}
          </div>
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
                  className={`rounded-xl border p-4 transition-all duration-300 ${notification.is_read ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 shadow-sm animate-in fade-in slide-in-from-top-4'}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 shrink-0">
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
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleRead(notification)}
                        disabled={actionLoading}
                        className="cursor-pointer"
                      >
                        {notification.is_read ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <CheckCheck className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => deleteNotification(notification.id)}
                        disabled={actionLoading}
                        className="cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
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
