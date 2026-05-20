'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SuperAdminGuard } from '@/components/auth/superadmin-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Store, Plus, Edit, Trash2, Loader2, Users, Package,
  DollarSign, RefreshCw, UserPlus, Link as LinkIcon, Search, X, Eye, BarChart3, TrendingUp, User
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', { minimumFractionDigits: 0 }).format(Math.round(n));

export default function StoresPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [freeAdmins, setFreeAdmins] = useState<any[]>([]);
  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Admin search in edit dialog
  const [editAdminSearch, setEditAdminSearch] = useState('');
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // Tab "new admin"
  const [newAdminForm, setNewAdminForm] = useState({
    storeName: '', fullName: '', email: '', password: '',
  });
  // Tab "existing admin"
  const [existingForm, setExistingForm] = useState({ storeName: '', adminId: '' });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStore, setDeletingStore] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingStore, setViewingStore] = useState<any>(null);
  const [viewStats, setViewStats] = useState<{topProducts: any[], topEmployees: any[]}>({ topProducts: [], topEmployees: [] });
  const [loadingStats, setLoadingStats] = useState(false);

  const handleViewStore = async (store: any) => {
    setViewingStore(store);
    setViewOpen(true);
    setLoadingStats(true);
    try {
      const { data: mvts } = await supabase
        .from('stock_movements')
        .select('quantity, product_id, products(name), user_id, users(full_name)')
        .eq('store_id', store.id)
        .eq('type', 'exit');
        
      const productStats: Record<string, {name: string, qty: number}> = {};
      const employeeStats: Record<string, {name: string, movements: number}> = {};
      
      mvts?.forEach((m: any) => {
        const pId = m.product_id;
        const uId = m.user_id;
        const qty = m.quantity || 0;
        
        if (pId) {
          if (!productStats[pId]) productStats[pId] = { name: m.products?.name || 'Produit inconnu', qty: 0 };
          productStats[pId].qty += qty;
        }
        
        if (uId) {
          if (!employeeStats[uId]) employeeStats[uId] = { name: m.users?.full_name || 'Système', movements: 0 };
          employeeStats[uId].movements += 1;
        }
      });
      
      const topProducts = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 5);
      const topEmployees = Object.values(employeeStats).sort((a, b) => b.movements - a.movements).slice(0, 5);
      
      setViewStats({ topProducts, topEmployees });
    } catch (err) {
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoadingStats(false);
    }
  };

  // ── Fetch ──────────────────────────────────────────────────
  const fetchStores = async () => {
    setLoading(true);
    try {
      const [{ data: storesData }, { data: usersData }] = await Promise.all([
        supabase.from('stores').select('*').order('name'),
        supabase.from('users').select('id, full_name, email, role, store_id, status').order('full_name'),
      ]);

      const adminsList = usersData?.filter(u => u.role === 'admin') ?? [];
      setAllAdmins(adminsList);
      setFreeAdmins(adminsList.filter(a => !a.store_id));

      const enriched = await Promise.all(
        (storesData || []).map(async (store: any) => {
          const storeUsers = usersData?.filter(u => u.store_id === store.id) ?? [];
          const admin = storeUsers.find(u => u.role === 'admin');
          const employees = storeUsers.filter(u => u.role !== 'admin' && u.status === 'approved');

          const { data: products } = await supabase
            .from('products')
            .select('quantity, unit_price')
            .eq('store_id', store.id);

          let totalQty = 0, totalValue = 0;
          products?.forEach(p => {
            const qty = p.quantity ?? 0;
            totalQty += qty;
            totalValue += qty * (p.unit_price ?? 0);
          });

          return { ...store, admin, employeesCount: employees.length, productsCount: products?.length ?? 0, totalQty, totalValue };
        })
      );

      setStores(enriched);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStores(); }, []);

  // ── Create store + NEW admin ────────────────────────────────
  const handleCreateWithNewAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { storeName, fullName, email, password } = newAdminForm;
    if (!storeName.trim() || !email.trim() || !password || !fullName.trim()) {
      toast.error('Tous les champs sont requis');
      return;
    }
    if (password.length < 6) { toast.error('Mot de passe : minimum 6 caractères'); return; }
    setCreating(true);
    try {
      // 1. Créer le magasin
      const { data: store, error: storeErr } = await supabase
        .from('stores')
        .insert({ name: storeName.trim() })
        .select()
        .single();
      if (storeErr) throw storeErr;

      // 2. Créer le compte admin (session secondaire pour ne pas écraser la session superadmin)
      const { createClient: createSbClient } = await import('@supabase/supabase-js');
      const secondary = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      const { data: signUpData, error: signUpErr } = await secondary.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'admin',
            status: 'approved',
            store_name: storeName.trim(),
          },
        },
      });
      if (signUpErr) throw signUpErr;

      // 3. Lier l'admin au magasin (attendre que le trigger crée le profil)
      if (signUpData.user) {
        await new Promise(r => setTimeout(r, 1000)); // laisser le trigger s'exécuter
        await supabase
          .from('users')
          .update({ store_id: store.id, status: 'approved', role: 'admin' })
          .eq('id', signUpData.user.id);
      }

      toast.success(`Magasin "${storeName}" et admin créés avec succès`);
      setCreateOpen(false);
      setNewAdminForm({ storeName: '', fullName: '', email: '', password: '' });
      await fetchStores();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Create store + EXISTING admin ──────────────────────────
  const handleCreateWithExistingAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingForm.storeName.trim()) { toast.error('Le nom du magasin est requis'); return; }
    setCreating(true);
    try {
      const { data: store, error: storeErr } = await supabase
        .from('stores')
        .insert({ name: existingForm.storeName.trim() })
        .select()
        .single();
      if (storeErr) throw storeErr;

      if (existingForm.adminId) {
        await supabase
          .from('users')
          .update({ store_id: store.id, status: 'approved' })
          .eq('id', existingForm.adminId);
      }

      toast.success(`Magasin "${existingForm.storeName}" créé`);
      setCreateOpen(false);
      setExistingForm({ storeName: '', adminId: '' });
      await fetchStores();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit store ─────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore?.name?.trim()) { toast.error('Le nom est requis'); return; }
    setSaving(true);
    try {
      await supabase.from('stores').update({ name: editingStore.name.trim() }).eq('id', editingStore.id);

      if (editingStore.newAdminId !== undefined) {
        // Retirer l'ancien admin de ce magasin
        await supabase.from('users').update({ store_id: null }).eq('store_id', editingStore.id).eq('role', 'admin');
        if (editingStore.newAdminId) {
          await supabase.from('users').update({ store_id: editingStore.id }).eq('id', editingStore.newAdminId);
        }
      }

      toast.success('Magasin modifié');
      setEditOpen(false);
      await fetchStores();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete store ───────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingStore) return;
    setDeleting(true);
    try {
      await supabase.from('users').update({ store_id: null }).eq('store_id', deletingStore.id);
      const { error } = await supabase.from('stores').delete().eq('id', deletingStore.id);
      if (error) throw error;
      toast.success('Magasin supprimé');
      setDeleteOpen(false);
      await fetchStores();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredStores = stores.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admin?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admin?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allAdminsForEdit = stores
    .flatMap(s => s.admin ? [{ ...s.admin, currentStoreId: s.id }] : [])
    .filter(a => !a.store_id || (editingStore && a.store_id === editingStore.id));

  // ── Render ─────────────────────────────────────────────────
  return (
    <SuperAdminGuard>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-600" />
              Gestion des magasins
            </h1>
            <p className="text-muted-foreground mt-1">{stores.length} magasin(s) enregistré(s)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStores} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau magasin
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Magasins', value: stores.length, icon: Store, color: 'text-blue-500' },
            { label: 'Produits total', value: stores.reduce((s, x) => s + x.productsCount, 0), icon: Package, color: 'text-green-500' },
            { label: 'Employés total', value: stores.reduce((s, x) => s + x.employeesCount, 0), icon: Users, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />{label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{value}</div>}
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />Valeur totale
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-lg font-bold">{fmt(stores.reduce((s, x) => s + x.totalValue, 0))} Ar</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <CardTitle>Liste des magasins</CardTitle>
                <CardDescription>Tous les magasins et leurs administrateurs</CardDescription>
              </div>
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Aucun magasin trouvé</p>
                <p className="text-sm mt-1">Créez votre premier magasin avec "Nouveau magasin"</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Magasin</TableHead>
                      <TableHead>Administrateur</TableHead>
                      <TableHead className="text-right">Produits</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Valeur</TableHead>
                      <TableHead className="text-right">Employés</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map(store => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="font-semibold">{store.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{store.id.slice(0, 8)}…</div>
                        </TableCell>
                        <TableCell>
                          {store.admin ? (
                            <div>
                              <div className="font-medium text-sm">{store.admin.full_name || 'Sans nom'}</div>
                              <div className="text-xs text-muted-foreground">{store.admin.email}</div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                              Non assigné
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{store.productsCount}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(store.totalQty)}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{fmt(store.totalValue)} Ar</TableCell>
                        <TableCell className="text-right">{store.employeesCount}</TableCell>
                        <TableCell>
                          <Badge className={store.admin ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {store.admin ? 'Actif' : 'Sans admin'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewStore(store)}>
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditingStore({ ...store, newAdminId: undefined, selectedNewAdmin: undefined }); setEditOpen(true); setEditAdminSearch(''); setShowAdminDropdown(false); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setDeletingStore(store); setDeleteOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Create Dialog ──────────────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau magasin</DialogTitle>
              <DialogDescription>
                Créez un magasin avec un nouvel administrateur, ou assignez-en un existant
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="new" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="new" className="flex-1 gap-2">
                  <UserPlus className="h-4 w-4" />Créer un admin
                </TabsTrigger>
                <TabsTrigger value="existing" className="flex-1 gap-2">
                  <LinkIcon className="h-4 w-4" />Admin existant
                </TabsTrigger>
              </TabsList>

              {/* TAB — Nouveau admin */}
              <TabsContent value="new">
                <form onSubmit={handleCreateWithNewAdmin} className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label>Nom du magasin *</Label>
                    <Input
                      placeholder="Ex: Boutique Ivandry"
                      value={newAdminForm.storeName}
                      onChange={e => setNewAdminForm({ ...newAdminForm, storeName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Compte administrateur
                    </p>
                    <div className="space-y-2">
                      <Label>Nom complet *</Label>
                      <Input
                        placeholder="Jean Dupont"
                        value={newAdminForm.fullName}
                        onChange={e => setNewAdminForm({ ...newAdminForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        placeholder="admin@boutique.com"
                        value={newAdminForm.email}
                        onChange={e => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mot de passe provisoire *</Label>
                      <Input
                        type="password"
                        placeholder="Min. 6 caractères"
                        value={newAdminForm.password}
                        onChange={e => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création…</> : 'Créer magasin + admin'}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* TAB — Admin existant */}
              <TabsContent value="existing">
                <form onSubmit={handleCreateWithExistingAdmin} className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label>Nom du magasin *</Label>
                    <Input
                      placeholder="Ex: Boutique Analakely"
                      value={existingForm.storeName}
                      onChange={e => setExistingForm({ ...existingForm, storeName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Administrateur</Label>
                    <Select
                      value={existingForm.adminId}
                      onValueChange={v => setExistingForm({ ...existingForm, adminId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un admin sans magasin…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun pour l'instant</SelectItem>
                        {freeAdmins.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.full_name || a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {freeAdmins.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Aucun admin sans magasin disponible. Utilisez l'onglet "Créer un admin".
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création…</> : 'Créer le magasin'}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* ── Edit Dialog ────────────────────────────────────── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le magasin</DialogTitle>
              <DialogDescription>Modifiez le nom ou l'administrateur</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nom du magasin *</Label>
                <Input
                  value={editingStore?.name || ''}
                  onChange={e => setEditingStore({ ...editingStore, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Administrateur</Label>
                {(() => {
                  // Determine which admin to display
                  const displayAdmin =
                    editingStore?.newAdminId !== undefined
                      ? editingStore?.selectedNewAdmin ?? null
                      : editingStore?.admin ?? null;

                  if (displayAdmin) {
                    return (
                      <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 border border-blue-200">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{displayAdmin.full_name || 'Sans nom'}</div>
                          <div className="text-xs text-muted-foreground truncate">{displayAdmin.email}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => setEditingStore({ ...editingStore, newAdminId: '', selectedNewAdmin: null })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1">
                      {editingStore?.newAdminId === '' && (
                        <p className="text-xs text-orange-600 italic">L'admin sera retiré du magasin</p>
                      )}
                      {!editingStore?.admin && editingStore?.newAdminId === undefined && (
                        <p className="text-xs text-muted-foreground italic mb-1">Aucun admin assigné</p>
                      )}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8"
                          placeholder="Rechercher un admin par nom ou email…"
                          value={editAdminSearch}
                          onChange={(e) => { setEditAdminSearch(e.target.value); setShowAdminDropdown(true); }}
                          onFocus={() => setShowAdminDropdown(true)}
                          onBlur={() => setTimeout(() => setShowAdminDropdown(false), 150)}
                        />
                        {showAdminDropdown && (
                          <div className="absolute z-50 w-full mt-1 rounded-md border bg-white shadow-lg max-h-52 overflow-y-auto">
                            {allAdmins
                              .filter(a =>
                                !editAdminSearch ||
                                a.full_name?.toLowerCase().includes(editAdminSearch.toLowerCase()) ||
                                a.email?.toLowerCase().includes(editAdminSearch.toLowerCase())
                              )
                              .map(admin => (
                                <button
                                  key={admin.id}
                                  type="button"
                                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted text-left"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setEditingStore({ ...editingStore, newAdminId: admin.id, selectedNewAdmin: admin });
                                    setEditAdminSearch('');
                                    setShowAdminDropdown(false);
                                  }}
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium">{admin.full_name || 'Sans nom'}</div>
                                    <div className="text-xs text-muted-foreground">{admin.email}</div>
                                    {admin.store_id && admin.store_id !== editingStore?.id && (
                                      <Badge variant="outline" className="text-[10px] mt-0.5 text-orange-600 border-orange-300 h-4">
                                        Déjà assigné
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              ))
                            }
                            {allAdmins.filter(a =>
                              !editAdminSearch ||
                              a.full_name?.toLowerCase().includes(editAdminSearch.toLowerCase()) ||
                              a.email?.toLowerCase().includes(editAdminSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                Aucun admin trouvé
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement…</> : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ──────────────────────────────────── */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer le magasin</DialogTitle>
              <DialogDescription>
                Supprimer <strong>{deletingStore?.name}</strong> ? Les utilisateurs seront dissociés.
                Les produits et mouvements restent en base.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suppression…</> : 'Supprimer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── View Dialog ────────────────────────────────────── */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Statistiques du magasin : {viewingStore?.name}
              </DialogTitle>
              <DialogDescription>
                Aperçu des performances et activités récentes du magasin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
                  <Package className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-blue-600 font-medium">Produits</div>
                  <div className="text-lg font-bold">{viewingStore?.productsCount || 0}</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
                  <Users className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                  <div className="text-xs text-purple-600 font-medium">Employés</div>
                  <div className="text-lg font-bold">{viewingStore?.employeesCount || 0}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
                  <DollarSign className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <div className="text-xs text-green-600 font-medium">Valeur</div>
                  <div className="text-sm font-bold truncate">{fmt(viewingStore?.totalValue || 0)} Ar</div>
                </div>
              </div>

              {loadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" /> Top 5 Produits (Sorties)
                    </h3>
                    {viewStats.topProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucune sortie enregistrée.</p>
                    ) : (
                      <div className="space-y-2">
                        {viewStats.topProducts.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border">
                            <span className="font-medium text-sm">{p.name}</span>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              {p.qty} sortis
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-purple-500" /> Top Employés (Mouvements)
                    </h3>
                    {viewStats.topEmployees.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucun mouvement enregistré par les employés.</p>
                    ) : (
                      <div className="space-y-2">
                        {viewStats.topEmployees.map((e, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border">
                            <span className="font-medium text-sm">{e.name}</span>
                            <Badge variant="outline" className="text-purple-700 border-purple-200">
                              {e.movements} mouvement(s)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setViewOpen(false)}>Fermer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminGuard>
  );
}
