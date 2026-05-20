'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Store, Users, RefreshCw } from 'lucide-react';

export default function StoresPage() {
  const { isSuperAdmin, isManager } = useCurrentUser();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await djangoClient.get<any[]>('/users/magasins/users/');
      setStores(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Magasins</h1>
          <p className="text-muted-foreground mt-1">{stores.length} magasin(s) enregistré(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Store className="h-10 w-10" />
            <p>Aucun magasin enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.magasin_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5 text-blue-500" />
                  {store.shop_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {store.manager && (
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Gérant</p>
                    <p className="font-medium">{store.manager.full_name}</p>
                    <p className="text-muted-foreground text-xs">{store.manager.email}</p>
                    <Badge variant="outline" className={store.manager.is_confirmed ? 'text-green-700 border-green-200' : 'text-orange-700 border-orange-200'}>
                      {store.manager.is_confirmed ? 'Actif' : 'En attente'}
                    </Badge>
                  </div>
                )}
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                    <Users className="h-3 w-3 inline mr-1" />
                    Employés ({store.employers?.length || 0})
                  </p>
                  {store.employers?.length > 0 ? (
                    <div className="space-y-1">
                      {store.employers.slice(0, 3).map((emp: any) => (
                        <div key={emp.id} className="flex items-center justify-between">
                          <span className="text-xs">{emp.full_name}</span>
                          <Badge variant="outline" className={`text-xs ${emp.is_confirmed ? 'text-green-700' : 'text-orange-700'}`}>
                            {emp.is_confirmed ? '✓' : '...'}
                          </Badge>
                        </div>
                      ))}
                      {store.employers.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{store.employers.length - 3} autre(s)</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucun employé</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
