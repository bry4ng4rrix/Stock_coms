'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Download, Pencil, Trash2, X, ImagePlus, Upload, Loader2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';

const MEDIA_BASE = (process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000/api')
  .replace('/api', '');

const CATEGORIES = [
  'Soins visage', 'Maquillage', 'Corps', 'Cheveux', 'Parfum', 'Bain & Douche', 'Solaire',
  'Homme', 'Femme', 'Enfant', 'Accessoires', 'Autre',
];

function getStatus(p: any) {
  const qty = p.initial_quantity ?? 0;
  const threshold = p.alert_threshold ?? 5;
  if (qty === 0) return 'out_of_stock';
  if (qty <= threshold) return 'low';
  return 'in_stock';
}

function getExpiryInfo(expiryDate: string | null) {
  if (!expiryDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)  return { days, label: 'Périmé',    cls: 'bg-red-100 text-red-800',    icon: true };
  if (days <= 7)  return { days, label: `${days}j !`, cls: 'bg-red-100 text-red-800',    icon: true };
  if (days <= 30) return { days, label: `${days}j`,   cls: 'bg-orange-100 text-orange-800', icon: false };
  return { days, label: `${days}j`, cls: 'bg-green-100 text-green-800', icon: false };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path}`;
}

const EMPTY_FORM = {
  reference: '', name: '', brand: '', description: '', category: '',
  shell_price: '', unit_price: '', magasin: '', initial_quantity: '0', alert_threshold: '5',
  expiry_date: '',
};

export default function ProductsPage() {
  const { isAdmin, isManager, user } = useCurrentUser();
  const canCreate = isManager;
  const canEdit = isAdmin;
  const canDelete = isAdmin;

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const expiringProducts = products
    .filter(p => p.expiry_date)
    .map(p => ({ ...p, expiryInfo: getExpiryInfo(p.expiry_date)! }))
    .filter(p => p.expiryInfo && p.expiryInfo.days <= 30)
    .sort((a, b) => a.expiryInfo.days - b.expiryInfo.days);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await djangoClient.products.list();
      setProducts(data);
    } catch (err: any) {
      toast.error('Erreur de chargement des produits: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    if (!isAdmin) return;
    setStoresLoading(true);
    try {
      const data = await djangoClient.get<any[]>('/users/magasins/users/');
      setStores(data);
    } catch (err: any) {
      toast.error('Erreur de chargement des magasins: ' + (err.message || err));
    } finally {
      setStoresLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (isAdmin && dialogOpen) {
      fetchStores();
    }
  }, [isAdmin, dialogOpen, fetchStores]);

  const filteredProducts = products.filter(p => {
    const status = getStatus(p);
    const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchStatus = selectedStatus === 'all' || status === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const statusColor = (s: string) => ({
    in_stock:     'bg-green-100 text-green-800',
    low:          'bg-orange-100 text-orange-800',
    out_of_stock: 'bg-red-100 text-red-800',
  }[s] ?? '');
  const statusLabel = (s: string) => ({ in_stock: 'En stock', low: 'Faible', out_of_stock: 'Rupture' }[s] ?? s);

  const handleExportExcel = () => {
    const rows = products.map(p => ({
      Référence: p.reference,
      Nom: p.name,
      Marque: p.brand || '',
      Catégorie: p.category || '',
      'Prix vente (Ar)': p.shell_price,
      'Prix achat (Ar)': isAdmin ? p.unit_price : '',
      Quantité: p.initial_quantity ?? 0,
      'Seuil alerte': p.alert_threshold ?? 5,
      Statut: statusLabel(getStatus(p)),
      'Date péremption': p.expiry_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export Excel réussi !');
  };

  const handleAddProduct = async () => {
    if (!form.reference || !form.name || !form.category || !form.shell_price) {
      toast.error('Veuillez remplir les champs obligatoires (Référence, Nom, Catégorie, Prix de vente)');
      return;
    }
    if (isAdmin && !form.magasin) {
      toast.error('Veuillez sélectionner un magasin.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('reference', form.reference);
      fd.append('name', form.name);
      fd.append('category', form.category);
      fd.append('shell_price', form.shell_price);
      fd.append('initial_quantity', form.initial_quantity || '0');
      fd.append('alert_threshold', form.alert_threshold || '5');
      if (form.brand) fd.append('brand', form.brand);
      if (form.description) fd.append('description', form.description);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      if (isAdmin) {
        if (form.magasin) fd.append('magasin', String(form.magasin));
        if (form.unit_price) fd.append('unit_price', form.unit_price);
      } else {
        fd.append('unit_price', form.shell_price);
      }
      if (imageFile) fd.append('image1', imageFile);

      await djangoClient.postFormData('/users/products/', fd);
      toast.success('Produit ajouté avec succès');
      setForm({ ...EMPTY_FORM });
      setImageFile(null);
      setDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    setEditSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editingProduct.name);
      fd.append('reference', editingProduct.reference);
      fd.append('category', editingProduct.category);
      fd.append('shell_price', String(editingProduct.shell_price));
      fd.append('alert_threshold', String(editingProduct.alert_threshold ?? 5));
      fd.append('initial_quantity', String(editingProduct.initial_quantity ?? 0));
      if (editingProduct.brand) fd.append('brand', editingProduct.brand);
      if (editingProduct.description) fd.append('description', editingProduct.description);
      if (editingProduct.expiry_date) fd.append('expiry_date', editingProduct.expiry_date);
      if (editingProduct.unit_price) fd.append('unit_price', String(editingProduct.unit_price));

      await djangoClient.patchFormData(`/users/products/${editingProduct.id}/`, fd);
      toast.success('Produit modifié');
      setEditDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la modification');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleteLoading(true);
    try {
      await djangoClient.products.delete(deletingProduct.id);
      toast.success('Produit supprimé');
      setDeleteDialogOpen(false);
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground mt-1">Gestion du catalogue et des stocks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />Exporter
          </Button>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>
                <ProductForm
                  form={form} setForm={setForm} isAdmin={isAdmin}
                  stores={stores} storesLoading={storesLoading}
                  imageFile={imageFile} setImageFile={setImageFile}
                  onSubmit={handleAddProduct} onCancel={() => setDialogOpen(false)}
                  saving={saving} submitLabel="Ajouter"
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Expiry alert */}
      {expiringProducts.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-800 dark:text-orange-300">
                {expiringProducts.filter(p => p.expiryInfo.days < 0).length > 0
                  ? `${expiringProducts.filter(p => p.expiryInfo.days < 0).length} produit(s) périmé(s) — ` : ''}
                {expiringProducts.filter(p => p.expiryInfo.days >= 0).length} produit(s) expirant dans 30 jours
              </p>
              <ul className="mt-2 space-y-1">
                {expiringProducts.slice(0, 5).map(p => (
                  <li key={p.id} className="text-sm text-orange-700 flex items-center gap-2">
                    <span className="font-mono text-xs bg-orange-100 px-1 rounded">{p.reference}</span>
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${p.expiryInfo.cls}">
                      {p.expiryInfo.days < 0 ? 'PÉRIMÉ' : `expire le ${fmtDate(p.expiry_date)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input placeholder="Rechercher par nom, référence ou marque..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1" />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low">Faible</SelectItem>
            <SelectItem value="out_of_stock">Rupture</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Catalogue ({filteredProducts.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Image</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Prix vente</TableHead>
                    {isAdmin && <TableHead className="text-right">Prix achat</TableHead>}
                    <TableHead>Péremption</TableHead>
                    <TableHead>Statut</TableHead>
                    {(canEdit || canDelete) && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucun produit trouvé</TableCell>
                    </TableRow>
                  ) : filteredProducts.map(product => {
                    const status = getStatus(product);
                    const expiry = getExpiryInfo(product.expiry_date);
                    const img = imageUrl(product.image1);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                            {img
                              ? <img src={img} alt={product.name} className="w-full h-full object-cover" />
                              : <span className="text-[10px] text-muted-foreground">img</span>
                            }
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.reference}</TableCell>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.brand || ''}</p>
                        </TableCell>
                        <TableCell className="text-sm">{product.category || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{product.initial_quantity ?? 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(product.shell_price || 0).toLocaleString('fr-MG')} Ar</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {product.unit_price != null ? `${Number(product.unit_price).toLocaleString('fr-MG')} Ar` : '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          {expiry ? (
                            <div className="flex items-center gap-1">
                              {expiry.icon && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                              <Badge className={expiry.cls}>{expiry.label}</Badge>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
                        </TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell>
                            <div className="flex gap-1">
                              {canEdit && (
                                <Button variant="ghost" size="sm" onClick={() => { setEditingProduct({ ...product }); setEditDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => { setDeletingProduct(product); setDeleteDialogOpen(true); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le produit</DialogTitle><DialogDescription>Informations du produit</DialogDescription></DialogHeader>
          {editingProduct && (
            <ProductForm
              form={editingProduct} setForm={setEditingProduct} isAdmin={isAdmin}
              imageFile={null} setImageFile={() => {}}
              onSubmit={handleUpdateProduct} onCancel={() => setEditDialogOpen(false)}
              saving={editSaving} submitLabel="Enregistrer" hideImage
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer le produit</DialogTitle><DialogDescription>Cette action est irréversible.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ProductFormProps {
  form: any; setForm: (v: any) => void; isAdmin: boolean;
  stores?: any[]; storesLoading?: boolean;
  imageFile: File | null; setImageFile: (f: File | null) => void;
  onSubmit: () => void; onCancel: () => void;
  saving: boolean; submitLabel: string; hideImage?: boolean;
}

function ProductForm({ form, setForm, isAdmin, stores = [], storesLoading = false, imageFile, setImageFile, onSubmit, onCancel, saving, submitLabel, hideImage }: ProductFormProps) {
  const [storeFilter, setStoreFilter] = useState('');
  const set = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const filteredStores = stores.filter((store) => {
    const label = String(store.shop_name || store.manager?.full_name || '').toLowerCase();
    return storeFilter === '' || label.includes(storeFilter.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {!hideImage && (
        <div className="space-y-2">
          <Label>Image du produit</Label>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => document.getElementById('prod-img-input')?.click()}
          >
            {imageFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <ImagePlus className="h-5 w-5 text-green-500" /><span>{imageFile.name}</span>
                <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); }} className="text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Glissez ou cliquez</p></>
            )}
            <input id="prod-img-input" type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Référence / SKU *</Label>
          <Input placeholder="Ex: CREM-001" value={form.reference || ''} onChange={e => set('reference', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nom du produit *</Label>
          <Input placeholder="Ex: Crème hydratante" value={form.name || ''} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Marque</Label>
          <Input placeholder="Ex: L'Oréal" value={form.brand || ''} onChange={e => set('brand', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Catégorie *</Label>
          <Select value={form.category || ''} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div className="space-y-2 md:col-span-2">
            <Label>Magasin *</Label>
            <Input
              placeholder="Rechercher un magasin..."
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
            />
            <Select
              value={form.magasin ? String(form.magasin) : ''}
              onValueChange={v => set('magasin', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={storesLoading ? 'Chargement des magasins...' : 'Choisir un magasin'} />
              </SelectTrigger>
              <SelectContent>
                {storesLoading ? (
                  <SelectItem value="__loading__" disabled>Chargement...</SelectItem>
                ) : filteredStores.length > 0 ? (
                  filteredStores.map(store => (
                    <SelectItem key={store.magasin_id || store.id || store.shop_name} value={String(store.magasin_id || store.id || '')}>
                      {store.shop_name || store.manager?.full_name || 'Magasin inconnu'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none__" disabled>Aucun magasin trouvé</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea placeholder="Description du produit..." rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Prix de vente (Ar) *</Label>
          <Input type="number" step="0.01" placeholder="0.00" value={form.shell_price || ''} onChange={e => set('shell_price', e.target.value)} />
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label>Prix d'achat (Ar)</Label>
            <Input type="number" step="0.01" placeholder="0.00" value={form.unit_price || ''} onChange={e => set('unit_price', e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Quantité initiale</Label>
          <Input type="number" min="0" placeholder="0" value={form.initial_quantity ?? ''} onChange={e => set('initial_quantity', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Seuil d'alerte</Label>
          <Input type="number" min="0" placeholder="5" value={form.alert_threshold ?? ''} onChange={e => set('alert_threshold', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="flex items-center gap-2">
            Date de péremption
            <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
          </Label>
          <Input
            type="date" value={form.expiry_date || ''}
            onChange={e => set('expiry_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{submitLabel}
        </Button>
      </div>
    </div>
  );
}
