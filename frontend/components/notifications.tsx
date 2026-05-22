'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Package, ShoppingCart, UserPlus, Info, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { djangoClient } from '@/lib/django-client';

interface NotifItem {
  id: number;
  notif_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  sale: ShoppingCart,
  product: Package,
  user: UserPlus,
  other: Info,
};

function timeAgo(d: string) {
  const diffMin = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.notifications.list();
      setNotifications(data);
    } catch {
      // silently fail for topbar dropdown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recent = notifications.slice(0, 8);

  const handleMarkAllRead = async () => {
    try {
      await djangoClient.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />Tout lire
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune notification
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {recent.map(notif => {
              const Icon = TYPE_ICONS[notif.notif_type] || Bell;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notif.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => router.push('/notifications')}
                >
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${!notif.is_read ? 'font-medium' : 'text-muted-foreground'}`}>
                      {notif.message.length > 80 ? notif.message.slice(0, 80) + '…' : notif.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(notif.created_at)}</span>
                  </div>
                  {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs justify-center"
            onClick={() => router.push('/notifications')}
          >
            Voir toutes les notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
