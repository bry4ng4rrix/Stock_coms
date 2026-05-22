'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Package, ShoppingCart, Users, ArrowUpDown, Shield, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { djangoClient } from '@/lib/django-client';
import Link from 'next/link';

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
  sale: 'text-blue-600',
  product: 'text-purple-600',
  user: 'text-green-600',
  movement: 'text-orange-600',
  alert: 'text-red-600',
  approval: 'text-emerald-600',
  other: 'text-gray-600',
};

function fmtRelative(d: string) {
  const diffMs = Date.now() - new Date(d).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}j`;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.notifications.list();
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recent = notifications.slice(0, 8);

  const handleMarkAllRead = async () => {
    try {
      await djangoClient.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />Tout lire
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Aucune notification
          </div>
        ) : (
          <>
            {recent.map(notif => {
              const Icon = NOTIF_ICONS[notif.notif_type] || Info;
              const colorCls = NOTIF_COLORS[notif.notif_type] || 'text-gray-600';
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-2 px-3 py-2 text-sm cursor-default ${
                    !notif.is_read ? 'bg-muted/50' : ''
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorCls}`} />
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-xs">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtRelative(notif.created_at)}</p>
                  </div>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
            <DropdownMenuSeparator />
            <div className="p-2 text-center">
              <Link href="/notifications" className="text-xs text-primary hover:underline">
                Voir toutes les notifications
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
