'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, ShieldAlert, Users as UsersIcon, Shield, Briefcase, Plus, Loader2, Building2, ImagePlus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'employer',
  });
  const [newAdminUser, setNewAdminUser] = useState({
    full_name: '',
    email: '',
    password: '',
    store_name: '',
  });
  const [adminLogoFile, setAdminLogoFile] = useState<File | null>(null);
  const [adminLogoPreview, setAdminLogoPreview] = useState<string | null>(null);
  // Admin tab — store mode
  const [adminStoreMode, setAdminStoreMode] = useState<'existing' | 'new'>('new');
  const [storesWithoutAdmin, setStoresWithoutAdmin] = useState<any[]>([]);
  const [adminStoreSearch, setAdminStoreSearch] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [selectedExistingStore, setSelectedExistingStore] = useState<any | null>(null);

  // Edit role dialog state
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState<any>(null);
  const [newRoleValue, setNewRoleValue] = useState('');

  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
    fetchStoresWithoutAdmin();
  }, []);

  const fetchStoresWithoutAdmin = async () => {
    try {
      const [{ data: storesData }, { data: adminsData }] = await Promise.all([
        supabase.from('stores').select('id, name, logo_url').order('name'),
        supabase.from('users').select('store_id').eq('role', 'admin').not('store_id', 'is', null),
      ]);
      const assignedIds = new Set(adminsData?.map(a => a.store_id) ?? []);
      setStoresWithoutAdmin((storesData ?? []).filter(s => !assignedIds.has(s.id)));
    } catch { /* silent */ }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        
      if (!profile) {
        setUsers([]);
        return;
      }

      setCurrentUser(profile);

      let query = supabase.from('users').select('*').order('created_at', { ascending: false });

      if (profile.role === 'superadmin') {
        // superadmin voit tous les utilisateurs de tous les magasins — pas de filtre
      } else {
        // admin, employer, magasinier → uniquement leur propre magasin
        query = query.eq('store_id', profile.store_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setUsers(data);
    } catch (err: any) {
      toast.error('Erreur de chargement des utilisateurs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const updatePayload: Record<string, any> = { status: newStatus };

      // When approving, also link the user to the current manager's store
      if (newStatus === 'approved' && currentUser?.store_id) {
        updatePayload.store_id = currentUser.store_id;
      }

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Statut mis à jour : ${newStatus}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus, store_id: updatePayload.store_id ?? u.store_id } : u))
      );
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour: ' + err.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      toast.error('Seul un administrateur peut modifier les rôles');
      return;
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Rôle mis à jour : ${newRole}`);
      setEditRoleDialogOpen(false);
      setEditingUserRole(null);
      setNewRoleValue('');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour du rôle: ' + err.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      toast.success('Utilisateur supprimé.');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      toast.error('Erreur de suppression: ' + err.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (newUser.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Import dynamique de @supabase/supabase-js pour éviter les conflits et ne l'utiliser qu'ici
      const { createClient: createSbClient } = await import('@supabase/supabase-js');
      
      // On crée un client secondaire pour ne pas écraser la session de l'admin actuel
      const secondarySupabase = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { error } = await secondarySupabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.full_name,
            role: newUser.role,
            status: 'approved', // Accepté automatiquement si créé d'ici
            referred_by_email: currentUser.email,
            store_id: currentUser.store_id,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de la création');
      }

      toast.success('Utilisateur ajouté avec succès.');
      setIsDialogOpen(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'employer' });
      fetchUsers(); // Refresh list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (newAdminUser.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (adminStoreMode === 'existing' && !selectedExistingStore) {
      toast.error('Veuillez sélectionner un magasin existant.');
      return;
    }
    if (adminStoreMode === 'new' && !newAdminUser.store_name.trim()) {
      toast.error('Le nom du magasin est requis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { createClient: createSbClient } = await import('@supabase/supabase-js');
      const secondary = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );

      const { data: signUpData, error: signUpError } = await secondary.auth.signUp({
        email: newAdminUser.email,
        password: newAdminUser.password,
        options: {
          data: {
            full_name: newAdminUser.full_name,
            role: 'admin',
            status: 'approved',
            store_name: adminStoreMode === 'existing' ? selectedExistingStore.name : newAdminUser.store_name,
          },
        },
      });

      if (signUpError || !signUpData.user) throw new Error(signUpError?.message || 'Erreur création compte');

      await new Promise((r) => setTimeout(r, 1000));

      if (adminStoreMode === 'existing') {
        // 1. Update user to link to store
        await supabase
          .from('users')
          .update({ store_id: selectedExistingStore.id, status: 'approved', role: 'admin' })
          .eq('id', signUpData.user.id);
          
        // 2. Update store to link to user as owner
        await supabase
          .from('stores')
          .update({ owner_id: signUpData.user.id })
          .eq('id', selectedExistingStore.id);

        toast.success(`Admin créé et assigné à "${selectedExistingStore.name}"`);
      } else {
        let logoUrl: string | null = null;
        if (adminLogoFile) {
          const ext = adminLogoFile.name.split('.').pop();
          const fileName = `admin-${signUpData.user.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('products').upload(`logos/${fileName}`, adminLogoFile);
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(`logos/${fileName}`);
            logoUrl = publicUrl;
          }
        }

        const { data: newStore, error: storeErr } = await supabase
          .from('stores')
          .insert({ 
            name: newAdminUser.store_name.trim(), 
            logo_url: logoUrl,
            owner_id: signUpData.user.id // Link owner on creation
          })
          .select()
          .single();

        if (storeErr || !newStore) throw new Error('Erreur création magasin');

        await supabase
          .from('users')
          .update({ store_id: newStore.id, status: 'approved', role: 'admin' })
          .eq('id', signUpData.user.id);

        toast.success(`Admin créé — magasin "${newAdminUser.store_name}" créé`);
      }

      setIsDialogOpen(false);
      setNewAdminUser({ full_name: '', email: '', password: '', store_name: '' });
      setAdminLogoFile(null);
      setAdminLogoPreview(null);
      setAdminStoreMode('new');
      setSelectedExistingStore(null);
      setAdminStoreSearch('');
      fetchUsers();
      fetchStoresWithoutAdmin();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-purple-500" />;
      case 'magasinier': return <Briefcase className="h-4 w-4 text-blue-500" />;
      default: return <UsersIcon className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-800">Approuvé</Badge>;
      case 'pending': return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">En attente</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejeté</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (currentUser && (currentUser.role === 'employer' || currentUser.role === 'magasinier')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold">Accès Refusé</h2>
            <p className="text-muted-foreground mt-2">Vous n'avez pas les permissions pour gérer les utilisateurs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les accès de vos employés et magasiniers.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajouter un utilisateur</DialogTitle>
              <DialogDescription>
                Choisissez le type de compte à créer
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="simple" className="pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple" className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  Employé
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin
                </TabsTrigger>
              </TabsList>

              {/* ── Tab Employé / Magasinier ── */}
              <TabsContent value="simple">
                <form onSubmit={handleAddUser} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                      id="full_name"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      placeholder="Jean Dupont"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="employe@boutique.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe provisoire</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(val) => setNewUser({ ...newUser, role: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employer">Employé</SelectItem>
                        <SelectItem value="magasinier">Magasinier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</> : 'Créer l\'utilisateur'}
                  </Button>
                </form>
              </TabsContent>

              {/* ── Tab Admin ── */}
              <TabsContent value="admin">
                <form onSubmit={handleAddAdmin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="adm_full_name">Nom complet</Label>
                    <Input
                      id="adm_full_name"
                      value={newAdminUser.full_name}
                      onChange={(e) => setNewAdminUser({ ...newAdminUser, full_name: e.target.value })}
                      placeholder="Marie Martin"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm_email">Adresse email</Label>
                    <Input
                      id="adm_email"
                      type="email"
                      value={newAdminUser.email}
                      onChange={(e) => setNewAdminUser({ ...newAdminUser, email: e.target.value })}
                      placeholder="admin@boutique.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm_password">Mot de passe provisoire</Label>
                    <Input
                      id="adm_password"
                      type="password"
                      value={newAdminUser.password}
                      onChange={(e) => setNewAdminUser({ ...newAdminUser, password: e.target.value })}
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>

                  {/* Store section */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
                    {/* Header + toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                        <Building2 className="h-4 w-4" />
                        Magasin associé
                      </div>
                      <div className="flex rounded-md border border-blue-200 overflow-hidden text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => { setAdminStoreMode('existing'); setSelectedExistingStore(null); setAdminStoreSearch(''); }}
                          className={`px-3 py-1.5 transition-colors ${adminStoreMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                        >
                          Existant
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminStoreMode('new')}
                          className={`px-3 py-1.5 transition-colors ${adminStoreMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                        >
                          Nouveau
                        </button>
                      </div>
                    </div>

                    {adminStoreMode === 'existing' ? (
                      /* ── Mode : magasin existant sans admin ── */
                      <div className="space-y-2">
                        <Label>Magasin sans admin <span className="text-red-500">*</span></Label>
                        {selectedExistingStore ? (
                          <div className="flex items-center gap-3 p-2.5 rounded-md bg-white border border-blue-300">
                            {selectedExistingStore.logo_url && (
                              <img src={selectedExistingStore.logo_url} alt="" className="h-8 w-8 object-contain rounded shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{selectedExistingStore.name}</div>
                            </div>
                            <Button
                              type="button" variant="ghost" size="sm"
                              className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                              onClick={() => setSelectedExistingStore(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              className="pl-8 bg-white"
                              placeholder="Rechercher un magasin…"
                              value={adminStoreSearch}
                              onChange={(e) => { setAdminStoreSearch(e.target.value); setShowStoreDropdown(true); }}
                              onFocus={() => setShowStoreDropdown(true)}
                              onBlur={() => setTimeout(() => setShowStoreDropdown(false), 150)}
                            />
                            {showStoreDropdown && (
                              <div className="absolute z-50 w-full mt-1 rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                                {storesWithoutAdmin
                                  .filter(s => !adminStoreSearch || s.name.toLowerCase().includes(adminStoreSearch.toLowerCase()))
                                  .map(store => (
                                    <button
                                      key={store.id}
                                      type="button"
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => { setSelectedExistingStore(store); setAdminStoreSearch(''); setShowStoreDropdown(false); }}
                                    >
                                      {store.logo_url && <img src={store.logo_url} alt="" className="h-6 w-6 object-contain rounded shrink-0" />}
                                      <span className="text-sm">{store.name}</span>
                                    </button>
                                  ))
                                }
                                {storesWithoutAdmin.filter(s => !adminStoreSearch || s.name.toLowerCase().includes(adminStoreSearch.toLowerCase())).length === 0 && (
                                  <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                    {adminStoreSearch ? 'Aucun magasin trouvé' : 'Aucun magasin sans admin disponible'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {storesWithoutAdmin.length === 0 && !selectedExistingStore && (
                          <p className="text-xs text-muted-foreground italic">
                            Tous les magasins ont déjà un admin — utilisez "Nouveau" pour en créer un.
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── Mode : nouveau magasin ── */
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="adm_store">Nom du magasin <span className="text-red-500">*</span></Label>
                          <Input
                            id="adm_store"
                            value={newAdminUser.store_name}
                            onChange={(e) => setNewAdminUser({ ...newAdminUser, store_name: e.target.value })}
                            placeholder="Ma Boutique"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Logo <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                          <div
                            className="border-2 border-dashed border-blue-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors bg-white flex flex-col items-center justify-center gap-2 min-h-[90px]"
                            onClick={() => document.getElementById('adm_logo_input')?.click()}
                          >
                            {adminLogoPreview ? (
                              <img src={adminLogoPreview} alt="Logo preview" className="h-14 w-14 object-contain rounded" />
                            ) : (
                              <>
                                <ImagePlus className="h-7 w-7 text-blue-300" />
                                <p className="text-xs text-muted-foreground">Cliquer pour choisir une image</p>
                              </>
                            )}
                            <input
                              id="adm_logo_input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setAdminLogoFile(file);
                                setAdminLogoPreview(file ? URL.createObjectURL(file) : null);
                              }}
                            />
                          </div>
                          {adminLogoPreview && (
                            <Button type="button" variant="ghost" size="sm"
                              className="text-red-500 hover:text-red-600 px-0 text-xs"
                              onClick={() => { setAdminLogoFile(null); setAdminLogoPreview(null); }}>
                              Supprimer le logo
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                    {isSubmitting
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                      : adminStoreMode === 'existing' ? 'Créer l\'admin' : 'Créer l\'admin et le magasin'
                    }
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Liste des utilisateurs</CardTitle>
              <CardDescription>
                Employés en attente et personnel actif
              </CardDescription>
            </div>
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Manager/Référant</TableHead>
                    <TableHead>Date d'inscription</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun utilisateur trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.full_name || 'Sans nom'}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 capitalize">
                            {getRoleIcon(user.role)}
                            {user.role}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.referred_by_email || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {user.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleUpdateStatus(user.id, 'approved')}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Accepter
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleUpdateStatus(user.id, 'rejected')}
                                >
                                  <X className="h-4 w-4 mr-1" /> Rejeter
                                </Button>
                              </>
                            )}
                            {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && user.id !== currentUser?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  setEditingUserRole(user);
                                  setNewRoleValue(user.role);
                                  setEditRoleDialogOpen(true);
                                }}
                              >
                                Modifier rôle
                              </Button>
                            )}
                            {user.status !== 'pending' && user.id !== currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(user.id)}
                              >
                                Supprimer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de {editingUserRole?.full_name || editingUserRole?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nouveau rôle</Label>
              <Select
                value={newRoleValue}
                onValueChange={(val) => setNewRoleValue(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="magasinier">Magasinier</SelectItem>
                  <SelectItem value="employer">Employé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (editingUserRole && newRoleValue) {
                    handleUpdateRole(editingUserRole.id, newRoleValue);
                  }
                }}
                disabled={!newRoleValue || newRoleValue === editingUserRole?.role}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
