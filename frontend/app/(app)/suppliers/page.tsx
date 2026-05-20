'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Phone, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

export default function SuppliersPage() {
  const { isAdminOrSuperAdmin } = useCurrentUser();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<any>(null);
  const [deleteWithProducts, setDeleteWithProducts] = useState(false);
  const supabase = createClient();

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    contact_person: '',
  });

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');

        if (data) setSuppliers(data);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [supabase]);

  const fetchSupplierProducts = async (supplierId: string) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*, product_sizes(size, quantity)')
        .eq('supplier_id', supplierId);

      if (data) setSupplierProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('suppliers')
        .insert([formData]);

      if (error) {
        toast.error('Erreur lors de l\'ajout du fournisseur');
        return;
      }

      toast.success('Fournisseur ajouté avec succès');
      setOpenDialog(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: '',
        contact_person: '',
      });

      // Refresh suppliers
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (data) setSuppliers(data);
    } catch (err) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSupplier) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: editingSupplier.name,
          email: editingSupplier.email,
          phone: editingSupplier.phone,
          address: editingSupplier.address,
          city: editingSupplier.city,
          postal_code: editingSupplier.postal_code,
          country: editingSupplier.country,
          contact_person: editingSupplier.contact_person,
        })
        .eq('id', editingSupplier.id);

      if (error) {
        toast.error('Erreur lors de la modification');
        return;
      }

      toast.success('Fournisseur modifié avec succès');
      setEditDialogOpen(false);
      setEditingSupplier(null);

      // Refresh suppliers
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (data) setSuppliers(data);
    } catch (err) {
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;

    try {
      // Si suppression avec produits, d'abord supprimer les produits
      if (deleteWithProducts) {
        const { error: productsError } = await supabase
          .from('products')
          .delete()
          .eq('supplier_id', deletingSupplier.id);

        if (productsError) {
          toast.error('Erreur lors de la suppression des produits');
          return;
        }
      } else {
        // Sinon, mettre à null le supplier_id des produits
        const { error: updateError } = await supabase
          .from('products')
          .update({ supplier_id: null })
          .eq('supplier_id', deletingSupplier.id);

        if (updateError) {
          toast.error('Erreur lors de la dissociation des produits');
          return;
        }
      }

      // Supprimer le fournisseur
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', deletingSupplier.id);

      if (error) {
        toast.error('Erreur lors de la suppression du fournisseur');
        return;
      }

      toast.success(
        deleteWithProducts 
          ? 'Fournisseur et produits supprimés avec succès' 
          : 'Fournisseur supprimé avec succès'
      );
      setDeleteDialogOpen(false);
      setDeletingSupplier(null);
      setDeleteWithProducts(false);

      // Refresh suppliers
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (data) setSuppliers(data);
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="text-muted-foreground mt-1">Gérez votre réseau de fournisseurs</p>
        </div>
        {isAdminOrSuperAdmin && (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un fournisseur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un fournisseur</DialogTitle>
              <DialogDescription>
                Enregistrez les coordonnées d&apos;un nouveau fournisseur
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du fournisseur</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: TechDistribution SA"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+33..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Personne de contact</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Rue de la Tech"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Paris"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="75001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="France"
                />
              </div>
              <Button type="submit" className="w-full">
                Ajouter le fournisseur
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Dialog key={supplier.id}>
              <DialogTrigger asChild>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => {
                    setSelectedSupplier(supplier);
                    fetchSupplierProducts(supplier.id);
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{supplier.name}</CardTitle>
                    {supplier.contact_person && (
                      <CardDescription>{supplier.contact_person}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.city && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {supplier.city}
                          {supplier.postal_code && ` ${supplier.postal_code}`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{selectedSupplier?.name}</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="details" className="w-full">
                  <TabsList>
                    <TabsTrigger value="details">Détails</TabsTrigger>
                    <TabsTrigger value="products">Produits ({supplierProducts.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {selectedSupplier?.contact_person && (
                        <div>
                          <p className="text-sm text-muted-foreground">Personne de contact</p>
                          <p className="font-medium">{selectedSupplier.contact_person}</p>
                        </div>
                      )}
                      {selectedSupplier?.email && (
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium break-all">{selectedSupplier.email}</p>
                        </div>
                      )}
                      {selectedSupplier?.phone && (
                        <div>
                          <p className="text-sm text-muted-foreground">Téléphone</p>
                          <p className="font-medium">{selectedSupplier.phone}</p>
                        </div>
                      )}
                      {selectedSupplier?.address && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Adresse</p>
                          <p className="font-medium">
                            {selectedSupplier.address}
                            {selectedSupplier.postal_code && ` ${selectedSupplier.postal_code}`}
                            {selectedSupplier.city && ` ${selectedSupplier.city}`}
                            {selectedSupplier.country && ` ${selectedSupplier.country}`}
                          </p>
                        </div>
                      )}
                    </div>
                    {isAdminOrSuperAdmin && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setEditingSupplier(selectedSupplier);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setDeletingSupplier(selectedSupplier);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                    )}
                  </TabsContent>
                  <TabsContent value="products" className="space-y-4">
                    {supplierProducts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun produit associé
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {supplierProducts.map((product) => (
                          <Card key={product.id}>
                            <CardContent className="pt-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-sm text-muted-foreground">{product.sku}</p>
                                </div>
                                <Badge variant="outline">
                                  Stock: {product.product_sizes?.reduce((s: number, ps: any) => s + (ps.quantity || 0), 0) ?? 0}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}

      {/* Edit Supplier Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le fournisseur</DialogTitle>
            <DialogDescription>
              Modifier les informations de {editingSupplier?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSupplier} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                value={editingSupplier?.name || ''}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                placeholder="Nom du fournisseur"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingSupplier?.email || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  placeholder="contact@..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editingSupplier?.phone || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  placeholder="+33..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact">Personne de contact</Label>
              <Input
                id="edit-contact"
                value={editingSupplier?.contact_person || ''}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Adresse</Label>
              <Input
                id="edit-address"
                value={editingSupplier?.address || ''}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                placeholder="123 Rue..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">Ville</Label>
                <Input
                  id="edit-city"
                  value={editingSupplier?.city || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, city: e.target.value })}
                  placeholder="Paris"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-postal">Code postal</Label>
                <Input
                  id="edit-postal"
                  value={editingSupplier?.postal_code || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, postal_code: e.target.value })}
                  placeholder="75001"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">Pays</Label>
              <Input
                id="edit-country"
                value={editingSupplier?.country || ''}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, country: e.target.value })}
                placeholder="France"
              />
            </div>
            <Button type="submit" className="w-full">
              Enregistrer les modifications
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deletingSupplier?.name}</strong> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <input
                type="checkbox"
                id="delete-with-products"
                checked={deleteWithProducts}
                onChange={(e) => setDeleteWithProducts(e.target.checked)}
                className="mt-1 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <div className="flex-1">
                <label htmlFor="delete-with-products" className="text-sm font-medium text-yellow-800 cursor-pointer">
                  Supprimer aussi les produits associés
                </label>
                <p className="text-xs text-yellow-600 mt-1">
                  {deleteWithProducts 
                    ? 'Tous les produits de ce fournisseur seront supprimés définitivement.' 
                    : 'Les produits seront conservés mais dissociés de ce fournisseur.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteWithProducts(false);
            }}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteSupplier}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteWithProducts ? 'Supprimer tout' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
