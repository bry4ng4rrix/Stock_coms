'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Lock, Users, Bell, Check, X, UserPlus, Clock, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [addEmployerDialog, setAddEmployerDialog] = useState(false);
  const [newEmployer, setNewEmployer] = useState({
    email: '',
    password: '',
    full_name: '',
  });
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null);
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [savingStore, setSavingStore] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          setUser(authUser);
          setFullName(authUser.user_metadata?.full_name || '');

          // Fetch user profile from users table
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          const resolvedRole = userProfile?.role || authUser.user_metadata?.role || '';
          setUserRole(resolvedRole);

          // Fetch store info pour admin et superadmin (quand ils ont un store_id)
          if (userProfile?.store_id) {
            const { data: storeData } = await supabase
              .from('stores')
              .select('id, name')
              .eq('id', userProfile.store_id)
              .single();
            if (storeData) {
              setStoreName(storeData.name || '');
              setStoreId(storeData.id);
              setStoreLogoUrl(storeData.logo_url || null);
            }
          }

          // Fetch all users si admin ou superadmin
          if (userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'magasinier') {
            const { data: allUsers } = await supabase
              .from('users')
              .select('*')
              .order('full_name');

            if (allUsers) {
              setUsers(allUsers);
              // Filter pending employers
              const pending = allUsers.filter(u => u.role === 'employer' && u.status === 'pending');
              setPendingUsers(pending);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [supabase]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (authError) {
        toast.error('Erreur lors de la mise à jour');
        return;
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (profileError) {
        toast.error('Erreur lors de la mise à jour du profil');
        return;
      }

      toast.success('Profil mis à jour avec succès');
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error('Erreur lors du changement de mot de passe');
        return;
      }

      toast.success('Mot de passe changé avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('Erreur lors du changement de mot de passe');
    }
  };

  const handleApproveUser = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.rpc('approve_employer', {
        p_user_id: userId,
        p_status: status,
      });

      if (error) {
        toast.error('Erreur lors de l\'approbation');
        return;
      }

      toast.success(status === 'approved' ? 'Employé approuvé' : 'Demande rejetée');
      
      // Refresh users list
      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (allUsers) {
        setUsers(allUsers);
        const pending = allUsers.filter(u => u.role === 'employer' && u.status === 'pending');
        setPendingUsers(pending);
      }
    } catch (err) {
      toast.error('Erreur lors de l\'opération');
    }
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error('Le nom du magasin est requis');
      return;
    }

    setSavingStore(true);
    try {
      let logoUrl = storeLogoUrl;
      let currentStoreId = storeId;

      // Upload logo first if provided
      if (newLogoFile) {
        setUploadingLogo(true);
        const fileExt = newLogoFile.name.split('.').pop();
        const tempId = currentStoreId || `new-${Date.now()}`;
        const fileName = `${tempId}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(`logos/${fileName}`, newLogoFile);

        if (uploadError) {
          toast.error('Erreur lors de l\'upload du logo');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(`logos/${fileName}`);
          logoUrl = publicUrl;
        }
        setUploadingLogo(false);
      }

      if (!currentStoreId) {
        // Create store then link admin to it
        const { data: newStore, error: createError } = await supabase
          .from('stores')
          .insert({ name: storeName.trim(), logo_url: logoUrl })
          .select()
          .single();

        if (createError || !newStore) {
          toast.error('Erreur lors de la création du magasin');
          return;
        }

        await supabase
          .from('users')
          .update({ store_id: newStore.id })
          .eq('id', user.id);

        currentStoreId = newStore.id;
        setStoreId(newStore.id);
      } else {
        const { error } = await supabase
          .from('stores')
          .update({ name: storeName.trim(), logo_url: logoUrl })
          .eq('id', currentStoreId);

        if (error) {
          toast.error('Erreur lors de la mise à jour du magasin');
          return;
        }
      }

      setStoreLogoUrl(logoUrl);
      setNewLogoFile(null);
      toast.success('Informations du magasin mises à jour');
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSavingStore(false);
    }
  };

  const handleAddEmployer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newEmployer.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('add_employer_by_manager', {
        p_email: newEmployer.email,
        p_password: newEmployer.password,
        p_full_name: newEmployer.full_name,
        p_manager_id: user.id,
      });

      if (error) {
        toast.error('Erreur lors de la création: ' + error.message);
        return;
      }

      toast.success('Employé ajouté avec succès');
      setAddEmployerDialog(false);
      setNewEmployer({ email: '', password: '', full_name: '' });

      // Refresh users list
      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (allUsers) {
        setUsers(allUsers);
        const pending = allUsers.filter(u => u.role === 'employer' && u.status === 'pending');
        setPendingUsers(pending);
      }
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const getRoleBadgeColor = (role: string, status?: string) => {
    if (role === 'admin') return 'bg-red-100 text-red-800 border-red-200';
    if (role === 'magasinier') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (role === 'employer') {
      if (status === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      if (status === 'rejected') return 'bg-gray-100 text-gray-800 border-gray-200';
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string, status?: string) => {
    if (role === 'admin') return 'Administrateur';
    if (role === 'magasinier') return 'Manager';
    if (role === 'employer') {
      if (status === 'pending') return 'Employé (En attente)';
      if (status === 'rejected') return 'Employé (Rejeté)';
      return 'Employé';
    }
    return role;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez vos paramètres et préférences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Mon profil
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
          
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Mon profil</CardTitle>
              <CardDescription>
                Mettez à jour vos informations personnelles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Votre adresse email ne peut pas être modifiée
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <Button type="submit">
                  Enregistrer les modifications
                </Button>
              </form>
            </CardContent>
          </Card>

          {(userRole === 'admin' || userRole === 'superadmin') && (
            <Card className="mt-6 border-blue-100 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Configuration du Magasin</CardTitle>
                    <CardDescription>
                      {storeId ? 'Personnalisez le nom et le logo de votre boutique' : 'Créez votre magasin et définissez son logo'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateStore} className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <Label htmlFor="storeName">Nom de la boutique</Label>
                        <Input
                          id="storeName"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          placeholder="Nom du magasin"
                          className="max-w-md"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="storeLogo">Changer le logo</Label>
                        <Input
                          id="storeLogo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
                          className="max-w-md cursor-pointer"
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                          Format recommandé : Carré (PNG/JPG), fond transparent de préférence.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-gray-50/50 min-w-[200px]">
                      <Label className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Aperçu du logo</Label>
                      {newLogoFile || storeLogoUrl ? (
                        <div className="relative group h-24 w-24 rounded-lg overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center">
                          <img 
                            src={newLogoFile ? URL.createObjectURL(newLogoFile) : (storeLogoUrl || '')} 
                            alt="Logo" 
                            className="max-h-full max-w-full object-contain p-1"
                          />
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white text-gray-400">
                          <Building2 className="h-10 w-10 opacity-20" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button type="submit" disabled={savingStore || uploadingLogo} className="bg-blue-600 hover:bg-blue-700">
                      {savingStore || uploadingLogo ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        storeId ? 'Enregistrer les changements' : 'Créer le magasin'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sécurité</CardTitle>
              <CardDescription>
                Gérez votre mot de passe et vos paramètres de sécurité
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-muted-foreground">
                    Note: Supabase Auth gère directement le changement de mot de passe
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit">
                  Changer le mot de passe
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Employer Dialog */}
      <Dialog open={addEmployerDialog} onOpenChange={setAddEmployerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un employé</DialogTitle>
            <DialogDescription>
              Créer un compte employé approuvé directement
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEmployer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                type="email"
                value={newEmployer.email}
                onChange={(e) => setNewEmployer({ ...newEmployer, email: e.target.value })}
                placeholder="employe@entreprise.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-name">Nom complet</Label>
              <Input
                id="emp-name"
                value={newEmployer.full_name}
                onChange={(e) => setNewEmployer({ ...newEmployer, full_name: e.target.value })}
                placeholder="Jean Dupont"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password">Mot de passe</Label>
              <Input
                id="emp-password"
                type="password"
                value={newEmployer.password}
                onChange={(e) => setNewEmployer({ ...newEmployer, password: e.target.value })}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
            </div>
            <Button type="submit" className="w-full">
              Créer l&apos;employé
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
