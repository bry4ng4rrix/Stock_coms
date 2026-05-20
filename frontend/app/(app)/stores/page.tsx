'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Store, Users, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StoresPage() {
  const { user, isAdmin, isManager } = useCurrentUser();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [submittingStore, setSubmittingStore] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        djangoClient.get<any[]>('/users/magasins/users/'),
        djangoClient.get<any[]>('/users/magasins/stats/'),
      ]);

      const merged = data.map((store) => ({
        ...store,
        stats: stats.find((item) => item.magasin_id === store.magasin_id) || {
          total_products: 0,
          total_stock_value: 0,
          total_sold_value: 0,
        },
      }));

      setStores(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error('Le nom du magasin est requis.');
      return;
    }
    if (!managerName.trim()) {
      toast.error('Le nom du gérant est requis.');
      return;
    }
    if (!managerEmail.trim()) {
      toast.error('L’email du gérant est requis.');
      return;
    }
    if (managerPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (!user?.email) {
      toast.error('Impossible de créer le magasin sans administrateur connecté.');
      return;
    }

    setSubmittingStore(true);
    try {
      const response = await djangoClient.auth.register(
        managerEmail,
        managerEmail,
        managerPassword,
        'magasin',
        {
          full_name: managerName,
          shop_name: storeName,
          admin_email: user.email,
        }
      );

      if (response?.id) {
        await djangoClient.auth.approveUser(response.id);
      }

      toast.success('Magasin créé et confirmé avec succès.');
      setIsRegisterDialogOpen(false);
      setStoreName('');
      setManagerName('');
      setManagerEmail('');
      setManagerPassword('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du magasin.');
    } finally {
      setSubmittingStore(false);
    }
  };

  const formatNumber = (value: number | string | null | undefined) =>
    new Intl.NumberFormat('fr-FR').format(Number(value ?? 0));

  const formatCurrency = (value: number | string | null | undefined) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0));

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Magasins</h1>
          <p className="text-muted-foreground mt-1">{stores.length} magasin(s) enregistré(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  Créer un magasin
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Créer un magasin confirmé</DialogTitle>
                  <DialogDescription>
                    Enregistrer un nouveau magasin et le confirmer immédiatement.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegisterStore} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nom du magasin *</Label>
                    <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Ex: Boutique Centre-Ville" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du gérant *</Label>
                    <Input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Ex: Marie Rakoto" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email du gérant *</Label>
                    <Input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="gerant@magasin.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe *</Label>
                    <Input type="password" value={managerPassword} onChange={e => setManagerPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" type="button" onClick={() => setIsRegisterDialogOpen(false)} disabled={submittingStore}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={submittingStore}>
                      {submittingStore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Créer...</> : 'Créer le magasin'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualiser
          </Button>
        </div>
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
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Produits</p>
                      <p className="text-lg font-semibold">{formatNumber(store.stats?.total_products)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Valeur stock</p>
                      <p className="text-lg font-semibold">{formatCurrency(store.stats?.total_stock_value)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Valeur vendue</p>
                      <p className="text-lg font-semibold">{formatCurrency(store.stats?.total_sold_value)}</p>
                    </div>
                  </div>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
