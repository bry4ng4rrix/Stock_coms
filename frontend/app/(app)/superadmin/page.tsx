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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield, Store, Package, Users, DollarSign,
  Plus, Edit, Trash2, Loader2,
  Building2, ArrowUp, ArrowDown, Check, X, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', { minimumFractionDigits: 0 }).format(Math.round(n));

export default function SuperAdminPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [globalStats, setGlobalStats] = useState({
    totalStores: 0,
    totalAdmins: 0,
    totalProducts: 0,
    totalQuantity: 0,
    totalValue: 0,
    totalEmployees: 0,
  });

  const [storeStats, setStoreStats] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const [admins, setAdmins] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    full_name: '',
    email: '',
    password: '',
    store_name: '',
  });

  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newRoleValue, setNewRoleValue] = useState('');

  // Approve dialog with store name confirmation
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingAdmin, setApprovingAdmin] = useState<any>(null);
  const [approvalStoreName, setApprovalStoreName] = useState('');
  const [approving, setApproving] = useState(false);

  // All movements
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [movementsStoreFilter, setMovementsStoreFilter] = useState<string>('all');
  const [movementsLoading, setMovementsLoading] = useState(false);

  // All products
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productsStoreFilter, setProductsStoreFilter] = useState<string>('all');
  const [productsLoading, setProductsLoading] = useState(false);

  // BarChart data: mouvements par magasin
  const barChartData = storeStats.map((s) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    Entrées: s.entries ?? 0,
    Sorties: s.exits ?? 0,
  }));

  const fetchGlobalStats = async () => {
    try {
      const { data: stores } = await supabase.from('stores').select('*');
      const { data: adminsData } = await supabase
        .from('users')
        .select('*')
        .in('role', ['admin', 'superadmin']);
      const { data: products } = await supabase.from('products').select('*');
      const { data: employees } = await supabase
        .from('users')
        .select('*')
        .in('role', ['employer', 'magasinier'])
        .eq('status', 'approved');

      let totalQuantity = 0;
      let totalValue = 0;
      products?.forEach((p) => {
        const qty = p.quantity ?? 0;
        totalQuantity += qty;
        totalValue += qty * (p.unit_price ?? 0);
      });

      setGlobalStats({
        totalStores: stores?.length ?? 0,
        totalAdmins: adminsData?.length ?? 0,
        totalProducts: products?.length ?? 0,
        totalQuantity,
        totalValue,
        totalEmployees: employees?.length ?? 0,
      });

      const storeData = await Promise.all(
        (stores || []).map(async (store: any) => {
          const { data: storeProducts } = await supabase
            .from('products').select('*').eq('store_id', store.id);
          const { data: storeEmployees } = await supabase
            .from('users').select('*')
            .eq('store_id', store.id)
            .in('role', ['employer', 'magasinier'])
            .eq('status', 'approved');
          const { data: storeMvts } = await supabase
            .from('stock_movements')
            .select('type, quantity, products:product_id(store_id)')
            .limit(500);

          let storeQty = 0, storeValue = 0, entries = 0, exits = 0;
          storeProducts?.forEach((p) => {
            const qty = p.quantity ?? 0;
            storeQty += qty;
            storeValue += qty * (p.unit_price ?? 0);
          });
          storeMvts?.forEach((m: any) => {
            if (m.products?.store_id === store.id) {
              if (m.type === 'entry') entries += m.quantity ?? 0;
              else exits += m.quantity ?? 0;
            }
          });

          return {
            id: store.id,
            name: store.name,
            owner_id: store.owner_id,
            products: storeProducts?.length ?? 0,
            quantity: storeQty,
            value: storeValue,
            employees: storeEmployees?.length ?? 0,
            entries,
            exits,
          };
        })
      );

      setStoreStats(storeData);
    } catch (err) {
      console.error('Error fetching global stats:', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, stores(name)')
        .in('role', ['admin', 'superadmin', 'magasinier', 'employer'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const fetchAllMovements = async () => {
    setMovementsLoading(true);
    try {
      const { data } = await supabase
        .from('stock_movements')
        .select('*, products:product_id(name, sku, store_id, stores:store_id(name)), users:user_id(full_name), product_sizes:product_size_id(gender, size)')
        .order('created_at', { ascending: false })
        .limit(300);
      setAllMovements(data || []);
    } catch (err) {
      console.error('Error fetching movements:', err);
    } finally {
      setMovementsLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    setProductsLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('*, stores:store_id(name)')
        .order('name');
      setAllProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchGlobalStats(), fetchAdmins(), fetchAllMovements(), fetchAllProducts()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdmin.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { createClient: createSbClient } = await import('@supabase/supabase-js');
      const secondarySupabase = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      const { error } = await secondarySupabase.auth.signUp({
        email: newAdmin.email,
        password: newAdmin.password,
        options: {
          data: {
            full_name: newAdmin.full_name,
            role: 'admin',
            store_name: newAdmin.store_name,
          },
        },
      });
      if (error) throw error;
      toast.success('Administrateur créé avec succès.');
      setIsCreateAdminOpen(false);
      setNewAdmin({ full_name: '', email: '', password: '', store_name: '' });
      await Promise.all([fetchGlobalStats(), fetchAdmins()]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      toast.success(`Rôle mis à jour : ${newRole}`);
      setEditRoleDialogOpen(false);
      setEditingUser(null);
      setNewRoleValue('');
      await fetchAdmins();
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour du rôle: ' + err.message);
    }
  };

  const openApproveDialog = (admin: any) => {
    setApprovingAdmin(admin);
    setApprovalStoreName(admin.store_name || '');
    setApproveDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!approvingAdmin) return;
    if (!approvalStoreName.trim()) { toast.error('Le nom du magasin est requis pour approuver'); return; }
    setApproving(true);
    try {
      const { data: newStore, error: storeErr } = await supabase
        .from('stores')
        .insert({ name: approvalStoreName.trim() })
        .select()
        .single();
      if (storeErr) throw storeErr;

      const { error } = await supabase
        .from('users')
        .update({ status: 'approved', store_id: newStore.id })
        .eq('id', approvingAdmin.id);
      if (error) throw error;

      toast.success(`Admin approuvé — magasin "${approvalStoreName}" créé`);
      setApproveDialogOpen(false);
      setApprovingAdmin(null);
      setApprovalStoreName('');
      await Promise.all([fetchGlobalStats(), fetchAdmins()]);
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectAdmin = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', userId);
      if (error) throw error;
      toast.success('Demande rejetée');
      await Promise.all([fetchGlobalStats(), fetchAdmins()]);
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      toast.success('Utilisateur supprimé.');
      await Promise.all([fetchGlobalStats(), fetchAdmins()]);
    } catch (err: any) {
      toast.error('Erreur de suppression: ' + err.message);
    }
  };

  const filteredAdmins = admins.filter((a) =>
    a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.stores?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStoreStats = selectedStore === 'all'
    ? storeStats
    : storeStats.filter((s) => s.id === selectedStore);

  const filteredMovements = movementsStoreFilter === 'all'
    ? allMovements
    : allMovements.filter((m) => m.products?.store_id === movementsStoreFilter);

  const filteredProducts = productsStoreFilter === 'all'
    ? allProducts
    : allProducts.filter((p) => p.store_id === productsStoreFilter);

  const totalMovementsValue = allMovements.reduce((acc, m) => {
    if (m.type === 'entry') return acc + (m.quantity ?? 0);
    return acc - (m.quantity ?? 0);
  }, 0);

  const genderLabel = (g: string) =>
    ({ homme: 'Homme', femme: 'Femme', enfant: 'Enfant', unisexe: 'Unisexe' }[g] ?? g);

  return (
    <SuperAdminGuard>
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-600" />
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Gestion globale de tous les magasins et administrateurs</p>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-32" /> : (
                  <>
                    <div className="text-2xl font-bold">{fmt(globalStats.totalValue)} Ar</div>
                    <p className="text-xs text-muted-foreground mt-1">Tous magasins confondus</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          {[
            { label: 'Magasins', value: globalStats.totalStores, sub: 'Actifs', icon: Store },
            { label: 'Administrateurs', value: globalStats.totalAdmins, sub: 'Gestionnaires', icon: Shield },
            { label: 'Produits', value: globalStats.totalProducts, sub: 'Références totales', icon: Package },
            { label: 'Employés', value: globalStats.totalEmployees, sub: 'Personnel actif', icon: Users },
          ].map(({ label, value, sub, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="stores">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="stores">Magasins</TabsTrigger>
            <TabsTrigger value="movements">Tous les mouvements</TabsTrigger>
            <TabsTrigger value="products">Tous les produits</TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              Utilisateurs
              {admins.filter(a => a.status === 'pending').length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {admins.filter(a => a.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Magasins ─────────────────────────────────────── */}
          <TabsContent value="stores" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />Statistiques par magasin
                    </CardTitle>
                    <CardDescription>Vue d'ensemble de tous les magasins</CardDescription>
                  </div>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger className="w-50">
                      <SelectValue placeholder="Filtrer par magasin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les magasins</SelectItem>
                      {storeStats.map((store) => (
                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Magasin</TableHead>
                          <TableHead>Produits</TableHead>
                          <TableHead>Quantité</TableHead>
                          <TableHead>Valeur</TableHead>
                          <TableHead>Employés</TableHead>
                          <TableHead className="text-green-700">Entrées</TableHead>
                          <TableHead className="text-red-700">Sorties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStoreStats.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun magasin trouvé.</TableCell>
                          </TableRow>
                        ) : filteredStoreStats.map((store) => (
                          <TableRow key={store.id}>
                            <TableCell className="font-medium">{store.name}</TableCell>
                            <TableCell>{store.products}</TableCell>
                            <TableCell>{fmt(store.quantity)}</TableCell>
                            <TableCell>{fmt(store.value)} Ar</TableCell>
                            <TableCell>{store.employees}</TableCell>
                            <TableCell className="text-green-700 font-medium">{fmt(store.entries)}</TableCell>
                            <TableCell className="text-red-700 font-medium">{fmt(store.exits)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BarChart Mouvements par magasin */}
            {!loading && barChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Mouvements par magasin (entrées vs sorties)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barChartData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Entrées" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Tab Tous les mouvements ───────────────────────── */}
          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Tous les mouvements</CardTitle>
                    <CardDescription>
                      {filteredMovements.length} mouvement(s) — Valeur nette mouvements :{' '}
                      <span className={totalMovementsValue >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {totalMovementsValue >= 0 ? '+' : ''}{fmt(totalMovementsValue)} unités
                      </span>
                    </CardDescription>
                  </div>
                  <Select value={movementsStoreFilter} onValueChange={setMovementsStoreFilter}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Filtrer par magasin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les magasins</SelectItem>
                      {storeStats.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Magasin</TableHead>
                          <TableHead>Produit</TableHead>
                          <TableHead>Variante</TableHead>
                          <TableHead>Utilisateur</TableHead>
                          <TableHead className="text-right">Quantité</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Aucun mouvement
                            </TableCell>
                          </TableRow>
                        ) : filteredMovements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(m.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {m.products?.stores?.name ?? '-'}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{m.products?.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{m.products?.sku}</p>
                            </TableCell>
                            <TableCell>
                              {m.product_sizes ? (
                                <Badge variant="secondary" className="text-xs">
                                  {genderLabel(m.product_sizes.gender)} / {m.product_sizes.size}
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">{m.users?.full_name || 'Système'}</TableCell>
                            <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={m.type === 'entry' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                                {m.type === 'entry'
                                  ? <><ArrowUp className="h-3 w-3 mr-1 inline" />Entrée</>
                                  : <><ArrowDown className="h-3 w-3 mr-1 inline" />Sortie</>
                                }
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Tous les produits ─────────────────────────── */}
          <TabsContent value="products" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Tous les produits</CardTitle>
                    <CardDescription>{filteredProducts.length} référence(s)</CardDescription>
                  </div>
                  <Select value={productsStoreFilter} onValueChange={setProductsStoreFilter}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Filtrer par magasin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les magasins</SelectItem>
                      {storeStats.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Magasin</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Prix (Ar)</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Aucun produit
                            </TableCell>
                          </TableRow>
                        ) : filteredProducts.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm font-medium">{p.stores?.name ?? '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{p.name}</p>
                              {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                            </TableCell>
                            <TableCell className="text-sm">{p.category || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{p.quantity ?? 0}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(p.unit_price ?? 0)}</TableCell>
                            <TableCell>
                              <Badge className={
                                p.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                                p.status === 'low' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {p.status === 'in_stock' ? 'En stock' : p.status === 'low' ? 'Faible' : 'Rupture'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Administrateurs ───────────────────────────── */}
          <TabsContent value="admins" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />Gestion des utilisateurs
                    </CardTitle>
                    <CardDescription>Gérez les admins, employés et approbations en attente</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-xs"
                    />
                    <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
                      <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" />Nouvel admin</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Créer un administrateur</DialogTitle>
                          <DialogDescription>Créez un nouvel administrateur avec son magasin</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateAdmin} className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="full_name">Nom complet</Label>
                            <Input id="full_name" value={newAdmin.full_name}
                              onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={newAdmin.email}
                              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Mot de passe</Label>
                            <Input id="password" type="password" value={newAdmin.password}
                              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} minLength={6} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store_name">Nom du magasin</Label>
                            <Input id="store_name" value={newAdmin.store_name}
                              onChange={(e) => setNewAdmin({ ...newAdmin, store_name: e.target.value })} required />
                          </div>
                          <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</> : "Créer l'administrateur"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Administrateur</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Magasin</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date de création</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAdmins.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Aucun administrateur trouvé.
                            </TableCell>
                          </TableRow>
                        ) : filteredAdmins.map((admin) => (
                          <TableRow key={admin.id}>
                            <TableCell>
                              <div className="font-medium">{admin.full_name || 'Sans nom'}</div>
                              <div className="text-xs text-muted-foreground">{admin.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                admin.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                                admin.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                admin.role === 'magasinier' ? 'bg-cyan-100 text-cyan-800' :
                                'bg-slate-100 text-slate-700'
                              }>
                                {admin.role === 'superadmin' ? 'Super Admin' :
                                 admin.role === 'admin' ? 'Admin' :
                                 admin.role === 'magasinier' ? 'Magasinier' : 'Employé'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {admin.stores?.name ? (
                                <span className="font-medium text-sm">{admin.stores.name}</span>
                              ) : admin.store_name && admin.status === 'pending' ? (
                                <div>
                                  <span className="text-sm text-orange-700 font-medium">{admin.store_name}</span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="h-3 w-3 text-orange-500" />
                                    <span className="text-xs text-orange-500">En attente de création</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                admin.status === 'approved' ? 'bg-green-100 text-green-800' :
                                admin.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {admin.status === 'approved' ? 'Approuvé' :
                                 admin.status === 'pending' ? 'En attente' : 'Rejeté'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {admin.created_at ? format(new Date(admin.created_at), 'dd MMM yyyy', { locale: fr }) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2 flex-wrap">
                                {admin.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400"
                                      onClick={() => openApproveDialog(admin)}
                                    >
                                      <Check className="h-4 w-4 mr-1" />Approuver
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                                      onClick={() => handleRejectAdmin(admin.id)}
                                    >
                                      <X className="h-4 w-4 mr-1" />Rejeter
                                    </Button>
                                  </>
                                )}
                                {admin.role !== 'superadmin' && (
                                  <>
                                    <Button variant="outline" size="sm"
                                      onClick={() => { setEditingUser(admin); setNewRoleValue(admin.role); setEditRoleDialogOpen(true); }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleDeleteUser(admin.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
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
          </TabsContent>
        </Tabs>

        {/* Edit Role Dialog */}
        <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
              <DialogDescription>
                Changer le rôle de {editingUser?.full_name || editingUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nouveau rôle</Label>
                <Select value={newRoleValue} onValueChange={setNewRoleValue}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez un rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="magasinier">Magasinier</SelectItem>
                    <SelectItem value="employer">Employé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>Annuler</Button>
                <Button
                  onClick={() => { if (editingUser && newRoleValue) handleUpdateRole(editingUser.id, newRoleValue); }}
                  disabled={!newRoleValue || newRoleValue === editingUser?.role}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Approve Admin Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Approuver l'administrateur
              </DialogTitle>
              <DialogDescription>
                Vérifiez et confirmez le nom du magasin avant d'approuver
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Admin info */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <p className="font-semibold text-sm">{approvingAdmin?.full_name || 'Sans nom'}</p>
                <p className="text-xs text-muted-foreground">{approvingAdmin?.email}</p>
                {approvingAdmin?.superadmin_email && (
                  <p className="text-xs text-muted-foreground">
                    A renseigné votre email : <span className="font-medium">{approvingAdmin.superadmin_email}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-store-name">
                  Nom du magasin *
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (renseigné par l'admin lors de l'inscription)
                  </span>
                </Label>
                <Input
                  id="approval-store-name"
                  placeholder="Nom du magasin"
                  value={approvalStoreName}
                  onChange={e => setApprovalStoreName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Un nouveau magasin sera créé avec ce nom et assigné à cet administrateur.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Annuler</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmApprove}
                  disabled={approving || !approvalStoreName.trim()}
                >
                  {approving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approbation…</>
                    : <><Check className="h-4 w-4 mr-2" />Approuver & créer le magasin</>
                  }
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminGuard>
  );
}
