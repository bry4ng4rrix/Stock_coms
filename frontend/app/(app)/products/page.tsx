'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
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
  Plus, Download, Pencil, Trash2, X, ImagePlus, Upload, Loader2, Layers, AlertTriangle,
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

const CATEGORIES = [
  'Soins visage', 'Maquillage', 'Corps', 'Cheveux', 'Parfum', 'Bain & Douche', 'Solaire',
  'Homme', 'Femme', 'Enfant', 'Accessoires', 'Autre',
];
const SIZES   = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const GENDERS = [
  { value: 'homme',   label: 'Homme' },
  { value: 'femme',   label: 'Femme' },
  { value: 'enfant',  label: 'Enfant' },
  { value: 'unisexe', label: 'Unisexe' },
];

const EMPTY_FORM = {
  sku: '', name: '', brand: '', description: '', category: '',
  supplier_id: '', location: '', unit_price: '', color: '',
  quantity: 0, reorder_level: 5,
  product_type: 'simple',
  expiry_date: '',
  sizes: [] as { gender: string; size: string; quantity: number }[],
};

// ── Expiry helpers ────────────────────────────────────────────────────────────
function getExpiryInfo(expiryDate: string | null) {
  if (!expiryDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)  return { days, label: 'Périmé',       cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',    icon: true };
  if (days <= 7)  return { days, label: `${days}j !`,   cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',    icon: true };
  if (days <= 30) return { days, label: `${days}j`,     cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: false };
  return { days, label: `${days}j`, cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: false };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ProductsPage() { return <ProductsContent />; }

function ProductsContent() {
  const { isAdmin, isAdminOrSuperAdmin, user } = useCurrentUser();
  const supabase = createClient();

  const [products, setProducts]   = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  const [searchTerm, setSearchTerm]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus]     = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [saving, setSaving]         = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editSaving, setEditSaving]         = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct]   = useState<any>(null);
  const [deleteLoading, setDeleteLoading]       = useState(false);

  const [sizesDialogOpen, setSizesDialogOpen] = useState(false);
  const [sizesProduct, setSizesProduct]       = useState<any>(null);
  const [addSizeGender, setAddSizeGender]     = useState('');
  const [addSizeSize, setAddSizeSize]         = useState('');
  const [addingSizeRow, setAddingSizeRow]     = useState(false);

  const [imagesModalOpen, setImagesModalOpen]                   = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState<any>(null);
  const [newImageFile, setNewImageFile]   = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Computed from products
  const expiringProducts = products
    .filter(p => p.product_type === 'simple' && p.expiry_date)
    .map(p => ({ ...p, expiryInfo: getExpiryInfo(p.expiry_date)! }))
    .filter(p => p.expiryInfo.days <= 30)
    .sort((a, b) => a.expiryInfo.days - b.expiryInfo.days);

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [{ data: productsData }, { data: suppliersData }] = await Promise.all([
        supabase
          .from('products')
          .select('*, suppliers:supplier_id(name), product_images(id, image_url, is_primary), product_sizes(id, gender, size, quantity)')
          .order('name'),
        supabase.from('suppliers').select('id, name').order('name'),
      ]);
      if (productsData) setProducts(productsData);
      if (suppliersData) setSuppliers(suppliersData);

      // Créer notifications de péremption une fois par jour
      if (productsData && user?.store_id) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const checkKey = `expiry_notif_${today.toISOString().split('T')[0]}_${user.store_id}`;

        if (!localStorage.getItem(checkKey)) {
          const expiring = productsData.filter(p => {
            if (!p.expiry_date || p.product_type !== 'simple') return false;
            const diff = Math.ceil((new Date(p.expiry_date).getTime() - today.getTime()) / 86_400_000);
            return diff <= 30;
          });

          if (expiring.length > 0) {
            const notifs = expiring.map(p => {
              const diff = Math.ceil((new Date(p.expiry_date).getTime() - today.getTime()) / 86_400_000);
              return {
                store_id: user.store_id,
                type: 'system',
                title: diff <= 0
                  ? `Produit périmé : ${p.name}`
                  : `Péremption dans ${diff} jour(s) : ${p.name}`,
                message: diff <= 0
                  ? `${p.name} (${p.sku}) a dépassé sa date de péremption (${fmtDate(p.expiry_date)}).`
                  : `${p.name} (${p.sku}) expire le ${fmtDate(p.expiry_date)}.`,
                related_entity_id: p.id,
              };
            });
            await supabase.from('notifications').insert(notifs);
            localStorage.setItem(checkKey, '1');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filters ───────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat    = selectedCategory === 'all' || p.category === selectedCategory;
    const matchStatus = selectedStatus   === 'all' || p.status   === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const statusColor = (s: string) => ({
    in_stock:     'bg-green-100 text-green-800',
    low:          'bg-orange-100 text-orange-800',
    out_of_stock: 'bg-red-100 text-red-800',
  }[s] ?? '');
  const statusLabel = (s: string) => ({ in_stock: 'En stock', low: 'Faible', out_of_stock: 'Rupture' }[s] ?? s);
  const genderLabel = (g: string) => GENDERS.find(x => x.value === g)?.label ?? g;

  // ── Excel export ──────────────────────────────────────────────
  const handleExportExcel = () => {
    const rows: any[] = [];
    products.forEach((p) => {
      if (p.product_type === 'variable' && p.product_sizes?.length) {
        p.product_sizes.forEach((s: any) => {
          rows.push({ SKU: p.sku, Nom: p.name, Type: 'Variable', Genre: genderLabel(s.gender), Taille: s.size, Quantité: s.quantity ?? 0, 'Prix (Ar)': p.unit_price, Statut: statusLabel(p.status) });
        });
      } else {
        rows.push({ SKU: p.sku, Nom: p.name, Marque: p.brand || '', Catégorie: p.category || '', Type: 'Simple', Genre: '', Taille: '', Quantité: p.quantity ?? 0, 'Prix (Ar)': p.unit_price, Statut: statusLabel(p.status), 'Date péremption': p.expiry_date || '' });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export Excel réussi !');
  };

  // ── Image upload ──────────────────────────────────────────────
  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('products').upload(`public/${fileName}`, file);
    if (error || !data) return null;
    return supabase.storage.from('products').getPublicUrl(`public/${fileName}`).data.publicUrl;
  };

  // ── Add product ───────────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!form.sku || !form.name || !form.category || !form.unit_price) {
      toast.error('Veuillez remplir les champs obligatoires (SKU, Nom, Catégorie, Prix)'); return;
    }
    if (!user?.store_id) { toast.error('Compte non associé à un magasin.'); return; }
    if (form.product_type === 'variable' && form.sizes.length === 0) {
      toast.error('Ajoutez au moins une taille pour un produit variable.'); return;
    }

    setSaving(true);
    try {
      const image_url = imageFile ? await uploadImage(imageFile) : null;

      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          sku: form.sku, name: form.name, brand: form.brand || null,
          description: form.description || null, category: form.category,
          supplier_id: form.supplier_id || null, location: form.location || null,
          unit_price: parseFloat(form.unit_price), color: form.color || null,
          quantity: form.product_type === 'simple' ? parseInt(form.quantity.toString()) || 0 : 0,
          reorder_level: parseInt(form.reorder_level.toString()) || 5,
          product_type: form.product_type,
          expiry_date: form.product_type === 'simple' && form.expiry_date ? form.expiry_date : null,
          store_id: user.store_id,
        })
        .select().single();

      if (productError) throw productError;

      if (image_url) {
        await supabase.from('product_images').insert({
          product_id: productData.id, image_url,
          qr_code_data: `${productData.sku}-${Date.now()}`, is_primary: true,
        });
      }

      if (form.product_type === 'simple') {
        const qty = parseInt(form.quantity.toString()) || 0;
        if (qty > 0) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          await supabase.from('stock_movements').insert({
            product_id: productData.id, type: 'entry', quantity: qty,
            notes: 'Stock initial', user_id: authUser?.id ?? null,
          });
        }
      } else {
        const validSizes = form.sizes.filter(s => s.gender && s.size);
        if (validSizes.length > 0) {
          const { data: sizeRows, error: sizeErr } = await supabase
            .from('product_sizes')
            .insert(validSizes.map(s => ({ product_id: productData.id, gender: s.gender, size: s.size, quantity: 0 })))
            .select();
          if (sizeErr) throw sizeErr;
          if (sizeRows) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const movements = sizeRows
              .map((row, i) => ({ row, qty: validSizes[i].quantity || 0 }))
              .filter(({ qty }) => qty > 0)
              .map(({ row, qty }) => ({
                product_id: productData.id, product_size_id: row.id,
                type: 'entry', quantity: qty, notes: 'Stock initial', user_id: authUser?.id ?? null,
              }));
            if (movements.length > 0) await supabase.from('stock_movements').insert(movements);
          }
        }
      }

      toast.success('Produit ajouté avec succès');
      setForm({ ...EMPTY_FORM }); setImageFile(null); setDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  // ── Update product ────────────────────────────────────────────
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    if (!editingProduct.sku || !editingProduct.name || !editingProduct.category || !editingProduct.unit_price) {
      toast.error('Veuillez remplir les champs obligatoires'); return;
    }
    setEditSaving(true);
    try {
      const { error } = await supabase.from('products').update({
        sku: editingProduct.sku, name: editingProduct.name, brand: editingProduct.brand || null,
        description: editingProduct.description || null, category: editingProduct.category,
        supplier_id: editingProduct.supplier_id || null, location: editingProduct.location || null,
        unit_price: parseFloat(editingProduct.unit_price), color: editingProduct.color || null,
        reorder_level: parseInt(editingProduct.reorder_level) || 5,
        expiry_date: editingProduct.product_type === 'simple' && editingProduct.expiry_date ? editingProduct.expiry_date : null,
      }).eq('id', editingProduct.id);
      if (error) throw error;
      toast.success('Produit modifié');
      setEditDialogOpen(false); await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la modification');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', deletingProduct.id);
      if (error) throw error;
      toast.success('Produit supprimé');
      setDeleteDialogOpen(false);
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Sizes management ──────────────────────────────────────────
  const openSizesDialog = (product: any) => {
    setSizesProduct(product); setAddSizeGender(''); setAddSizeSize(''); setSizesDialogOpen(true);
  };
  const handleAddSizeVariant = async () => {
    if (!addSizeGender || !addSizeSize || !sizesProduct) return;
    if (sizesProduct.product_sizes?.some((s: any) => s.gender === addSizeGender && s.size === addSizeSize)) {
      toast.error('Cette combinaison existe déjà'); return;
    }
    setAddingSizeRow(true);
    try {
      const { error } = await supabase.from('product_sizes').insert({
        product_id: sizesProduct.id, gender: addSizeGender, size: addSizeSize, quantity: 0,
      });
      if (error) throw error;
      toast.success('Variante ajoutée (stock 0 — créez un mouvement d\'entrée)');
      setAddSizeGender(''); setAddSizeSize('');
      await fetchData();
      setSizesProduct(products.find(p => p.id === sizesProduct.id) ?? sizesProduct);
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur');
    } finally {
      setAddingSizeRow(false);
    }
  };
  const handleDeleteSizeVariant = async (sizeId: string, qty: number) => {
    if (qty > 0) { toast.error('Impossible de supprimer une variante avec du stock'); return; }
    try {
      await supabase.from('product_sizes').delete().eq('id', sizeId);
      toast.success('Variante supprimée'); await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur');
    }
  };

  // ── Images ────────────────────────────────────────────────────
  const handleAddAdditionalImage = async () => {
    if (!selectedProductForImages || !newImageFile) return;
    if ((selectedProductForImages.product_images?.length ?? 0) >= 3) { toast.error('Maximum 3 images'); return; }
    setUploadingImage(true);
    try {
      const image_url = await uploadImage(newImageFile);
      if (!image_url) throw new Error('Upload échoué');
      await supabase.from('product_images').insert({
        product_id: selectedProductForImages.id, image_url,
        qr_code_data: `${selectedProductForImages.sku}-${Date.now()}`,
        is_primary: !selectedProductForImages.product_images?.length,
      });
      toast.success('Image ajoutée'); setNewImageFile(null); await fetchData();
    } catch { toast.error('Erreur upload'); } finally { setUploadingImage(false); }
  };
  const handleRemoveImage = async (imageId: string) => {
    try { await supabase.from('product_images').delete().eq('id', imageId); toast.success('Image supprimée'); await fetchData(); }
    catch { toast.error('Erreur suppression'); }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground mt-1">Cosmétiques, vêtements et accessoires</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />Exporter
          </Button>
          {isAdminOrSuperAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>
                <ProductForm
                  form={form} setForm={setForm} suppliers={suppliers}
                  imageFile={imageFile} setImageFile={setImageFile}
                  onSubmit={handleAddProduct} onCancel={() => setDialogOpen(false)}
                  saving={saving} submitLabel="Ajouter"
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Expiry alert banner ───────────────────────────────── */}
      {expiringProducts.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-800 dark:text-orange-300">
                {expiringProducts.filter(p => p.expiryInfo.days < 0).length > 0
                  ? `${expiringProducts.filter(p => p.expiryInfo.days < 0).length} produit(s) périmé(s) — `
                  : ''
                }
                {expiringProducts.filter(p => p.expiryInfo.days >= 0).length} produit(s) expirant dans les 30 jours
              </p>
              <ul className="mt-2 space-y-1">
                {expiringProducts.slice(0, 5).map(p => (
                  <li key={p.id} className="text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
                    <span className="font-mono text-xs bg-orange-100 dark:bg-orange-900/40 px-1 rounded">{p.sku}</span>
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="flex-shrink-0">—</span>
                    <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${p.expiryInfo.cls}`}>
                      {p.expiryInfo.days < 0 ? 'PÉRIMÉ' : `expire le ${fmtDate(p.expiry_date)}`}
                    </span>
                  </li>
                ))}
                {expiringProducts.length > 5 && (
                  <li className="text-xs text-orange-600">... et {expiringProducts.length - 5} autre(s)</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input placeholder="Rechercher par nom, SKU ou marque..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
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
                    <TableHead>SKU</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Péremption</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead>Statut</TableHead>
                    {isAdminOrSuperAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdminOrSuperAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">Aucun produit trouvé</TableCell>
                    </TableRow>
                  ) : filteredProducts.map((product) => {
                    const expiry = product.product_type === 'simple' ? getExpiryInfo(product.expiry_date) : null;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div
                            className="w-10 h-10 rounded overflow-hidden bg-muted cursor-pointer hover:opacity-80 border flex-shrink-0"
                            onClick={() => { setSelectedProductForImages(product); setImagesModalOpen(true); }}
                          >
                            {product.product_images?.[0]
                              ? <img src={product.product_images[0].image_url} alt={product.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">img</div>
                            }
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.brand || ''}</p>
                        </TableCell>
                        <TableCell className="text-sm">{product.category || '-'}</TableCell>
                        <TableCell>
                          {product.product_type === 'variable' ? (
                            <div className="space-y-1">
                              <Badge variant="outline">{product.quantity ?? 0} total</Badge>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {product.product_sizes?.slice(0, 4).map((s: any) => (
                                  <Badge key={s.id} variant="secondary" className="text-[10px] px-1 py-0">
                                    {genderLabel(s.gender)[0]}/{s.size}={s.quantity}
                                  </Badge>
                                ))}
                                {(product.product_sizes?.length ?? 0) > 4 && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">+{product.product_sizes.length - 4}</Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">{product.quantity ?? 0}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {expiry ? (
                            <div className="flex items-center gap-1">
                              {expiry.icon && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                              <Badge className={expiry.cls}>{expiry.label}</Badge>
                              {expiry.days >= 0 && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(product.expiry_date)}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{product.unit_price} Ar</TableCell>
                        <TableCell>
                          <Badge className={statusColor(product.status)}>{statusLabel(product.status)}</Badge>
                        </TableCell>
                        {isAdminOrSuperAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingProduct({ ...product }); setEditDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {product.product_type === 'variable' && (
                                <Button variant="ghost" size="sm" onClick={() => openSizesDialog(product)}>
                                  <Layers className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdminOrSuperAdmin && (
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
              form={editingProduct} setForm={setEditingProduct} suppliers={suppliers}
              imageFile={null} setImageFile={() => {}}
              onSubmit={handleUpdateProduct} onCancel={() => setEditDialogOpen(false)}
              saving={editSaving} submitLabel="Enregistrer" hideQuantity
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

      {/* Sizes Dialog */}
      <Dialog open={sizesDialogOpen} onOpenChange={setSizesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tailles — {sizesProduct?.name}</DialogTitle>
            <DialogDescription>Le stock se modifie via les mouvements.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Genre</TableHead><TableHead>Taille</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  {isAdminOrSuperAdmin && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!sizesProduct?.product_sizes?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Aucune variante</TableCell></TableRow>
                ) : sizesProduct.product_sizes.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{genderLabel(s.gender)}</TableCell>
                    <TableCell><Badge variant="outline">{s.size}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{s.quantity ?? 0}</TableCell>
                    {isAdminOrSuperAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled={(s.quantity ?? 0) > 0} onClick={() => handleDeleteSizeVariant(s.id, s.quantity ?? 0)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isAdminOrSuperAdmin && (
              <div className="border-t pt-4 space-y-2">
                <Label className="text-sm font-medium">Ajouter une variante</Label>
                <div className="flex gap-2">
                  <Select value={addSizeGender} onValueChange={setAddSizeGender}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Genre" /></SelectTrigger>
                    <SelectContent>{GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={addSizeSize} onValueChange={setAddSizeSize}>
                    <SelectTrigger className="w-28"><SelectValue placeholder="Taille" /></SelectTrigger>
                    <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={handleAddSizeVariant} disabled={!addSizeGender || !addSizeSize || addingSizeRow}>
                    {addingSizeRow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Images Modal */}
      <Dialog open={imagesModalOpen} onOpenChange={setImagesModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Images — {selectedProductForImages?.name}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              {selectedProductForImages?.product_images?.map((img: any) => (
                <div key={img.id} className="relative group rounded-md overflow-hidden border aspect-square">
                  <img src={img.image_url} alt="Product" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveImage(img.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {img.is_primary && <div className="absolute top-2 left-2"><Badge variant="secondary">Principal</Badge></div>}
                </div>
              ))}
              {!selectedProductForImages?.product_images?.length && (
                <div className="col-span-3 text-center py-8 text-muted-foreground bg-muted/20 rounded-md border border-dashed">Aucune image</div>
              )}
            </div>
            {isAdminOrSuperAdmin && (selectedProductForImages?.product_images?.length ?? 0) < 3 && (
              <div className="space-y-3 border-t pt-4">
                <Label>Ajouter une image ({selectedProductForImages?.product_images?.length ?? 0}/3)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors" onClick={() => document.getElementById('extra-img-input')?.click()}>
                  {newImageFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <ImagePlus className="h-5 w-5 text-green-500" />
                      <span>{newImageFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setNewImageFile(null); }} className="text-red-500"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Cliquez pour parcourir</p></>
                  )}
                  <input id="extra-img-input" type="file" accept="image/*" className="hidden" onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={handleAddAdditionalImage} disabled={!newImageFile || uploadingImage} className="w-full">
                  {uploadingImage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Ajouter
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── ProductForm ───────────────────────────────────────────────────────────────
interface ProductFormProps {
  form: any; setForm: (v: any) => void; suppliers: any[];
  imageFile: File | null; setImageFile: (f: File | null) => void;
  onSubmit: () => void; onCancel: () => void;
  saving: boolean; submitLabel: string; hideQuantity?: boolean;
}

function ProductForm({ form, setForm, suppliers, imageFile, setImageFile, onSubmit, onCancel, saving, submitLabel, hideQuantity }: ProductFormProps) {
  const set = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const isVariable = form.product_type === 'variable';

  const addSizeRow    = () => set('sizes', [...(form.sizes || []), { gender: '', size: '', quantity: 0 }]);
  const updateSizeRow = (i: number, field: string, value: any) => {
    const updated = [...(form.sizes || [])]; updated[i] = { ...updated[i], [field]: value }; set('sizes', updated);
  };
  const removeSizeRow = (i: number) => set('sizes', (form.sizes || []).filter((_: any, idx: number) => idx !== i));

  return (
    <div className="space-y-5">
      {/* Image */}
      {!hideQuantity && (
        <div className="space-y-2">
          <Label>Image du produit</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors" onClick={() => document.getElementById('prod-img-input')?.click()}>
            {imageFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <ImagePlus className="h-5 w-5 text-green-500" /><span>{imageFile.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Glissez ou cliquez</p></>
            )}
            <input id="prod-img-input" type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type toggle */}
        <div className="space-y-2 md:col-span-2">
          <Label>Type de produit</Label>
          <div className="flex gap-2">
            <Button type="button" variant={!isVariable ? 'default' : 'outline'} size="sm" onClick={() => set('product_type', 'simple')}>
              Simple (cosmétique, accessoire…)
            </Button>
            <Button type="button" variant={isVariable ? 'default' : 'outline'} size="sm" onClick={() => set('product_type', 'variable')}>
              Variable (vêtement avec tailles)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>SKU *</Label>
          <Input placeholder="Ex: CREM-001" value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nom du produit *</Label>
          <Input placeholder="Ex: Crème hydratante" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Marque</Label>
          <Input placeholder="Ex: L'Oréal" value={form.brand || ''} onChange={(e) => set('brand', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Catégorie *</Label>
          <Select value={form.category || ''} onValueChange={(v) => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea placeholder="Description du produit..." rows={2} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Prix unitaire (Ar) *</Label>
          <Input type="number" step="0.01" placeholder="0.00" value={form.unit_price || ''} onChange={(e) => set('unit_price', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Couleur</Label>
          <Input placeholder="Ex: Rouge, Bleu marine..." value={form.color || ''} onChange={(e) => set('color', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fournisseur</Label>
          <Select value={form.supplier_id || 'none'} onValueChange={(v) => set('supplier_id', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Emplacement</Label>
          <Input placeholder="Ex: Rayon B2" value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
        </div>

        {/* Date de péremption — simple products only */}
        {!isVariable && (
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-2">
              Date de péremption
              <span className="text-xs font-normal text-muted-foreground">(optionnel — cosmétiques uniquement)</span>
            </Label>
            <Input
              type="date"
              value={form.expiry_date || ''}
              onChange={(e) => set('expiry_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            {form.expiry_date && (() => {
              const info = getExpiryInfo(form.expiry_date);
              return info ? (
                <p className={`text-xs flex items-center gap-1 ${info.days < 0 ? 'text-red-600' : info.days <= 30 ? 'text-orange-600' : 'text-green-600'}`}>
                  {info.icon && <AlertTriangle className="h-3 w-3" />}
                  {info.days < 0 ? 'Date déjà dépassée !' : `Expire dans ${info.days} jour(s)`}
                </p>
              ) : null;
            })()}
          </div>
        )}

        {/* Simple quantity */}
        {!hideQuantity && !isVariable && (
          <>
            <div className="space-y-2">
              <Label>Quantité initiale</Label>
              <Input type="number" min="0" placeholder="0" value={form.quantity || ''} onChange={(e) => set('quantity', parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Seuil d'alerte</Label>
              <Input type="number" min="0" placeholder="5" value={form.reorder_level || ''} onChange={(e) => set('reorder_level', parseInt(e.target.value) || 5)} />
            </div>
          </>
        )}

        {/* Edit mode reorder */}
        {hideQuantity && (
          <div className="space-y-2">
            <Label>Seuil d'alerte</Label>
            <Input type="number" min="0" placeholder="5" value={form.reorder_level || ''} onChange={(e) => set('reorder_level', parseInt(e.target.value) || 5)} />
          </div>
        )}

        {/* Variable sizes */}
        {!hideQuantity && isVariable && (
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tailles et stocks initiaux</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSizeRow}>
                <Plus className="h-3 w-3 mr-1" />Ajouter une taille
              </Button>
            </div>
            {!(form.sizes || []).length ? (
              <p className="text-sm text-muted-foreground border rounded p-3 text-center">Cliquez sur "Ajouter une taille" pour définir les variantes</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 text-xs text-muted-foreground px-1">
                  <span>Genre</span><span>Taille</span><span>Stock init.</span><span></span>
                </div>
                {(form.sizes || []).map((row: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                    <Select value={row.gender || ''} onValueChange={(v) => updateSizeRow(i, 'gender', v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Genre" /></SelectTrigger>
                      <SelectContent>{GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={row.size || ''} onValueChange={(v) => updateSizeRow(i, 'size', v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Taille" /></SelectTrigger>
                      <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min="0" placeholder="0" className="h-8" value={row.quantity || ''}
                      onChange={(e) => updateSizeRow(i, 'quantity', parseInt(e.target.value) || 0)} />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeSizeRow(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Seuil d'alerte (total)</Label>
              <Input type="number" min="0" placeholder="5" value={form.reorder_level || ''} onChange={(e) => set('reorder_level', parseInt(e.target.value) || 5)} />
            </div>
          </div>
        )}
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
