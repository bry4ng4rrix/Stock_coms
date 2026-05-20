'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown, Plus, Search, Package } from 'lucide-react';
import { toast } from 'sonner';
import { AIAnalysis } from '@/components/ai-analysis';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

const GENDERS = [
  { value: 'homme',   label: 'Homme' },
  { value: 'femme',   label: 'Femme' },
  { value: 'enfant',  label: 'Enfant' },
  { value: 'unisexe', label: 'Unisexe' },
];

const genderLabel = (g: string) => GENDERS.find(x => x.value === g)?.label ?? g;

export default function MovementsPage() {
  const { user, isAdminOrSuperAdmin } = useCurrentUser();
  const [movements, setMovements]   = useState<any[]>([]);
  const [products, setProducts]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [movementType, setMovementType]           = useState<'entry' | 'exit'>('entry');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedGender, setSelectedGender]       = useState('');
  const [selectedSize, setSelectedSize]           = useState('');
  const [quantity, setQuantity]                   = useState('');
  const [notes, setNotes]                         = useState('');
  const [searchTerm, setSearchTerm]               = useState('');
  const [currentUserName, setCurrentUserName]     = useState('');

  const supabase = createClient();

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const isVariable = selectedProduct?.product_type === 'variable';

  const filteredProducts = useMemo(
    () => products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
    [products, searchTerm],
  );

  // Available genders for selected variable product
  const availableGenders = useMemo(() => {
    if (!isVariable || !selectedProduct?.product_sizes) return [];
    const unique = [...new Set(selectedProduct.product_sizes.map((s: any) => s.gender))];
    return GENDERS.filter((g) => unique.includes(g.value));
  }, [isVariable, selectedProduct]);

  // Available sizes for selected gender
  const availableSizes = useMemo(() => {
    if (!isVariable || !selectedGender || !selectedProduct?.product_sizes) return [];
    return selectedProduct.product_sizes.filter((s: any) => s.gender === selectedGender);
  }, [isVariable, selectedGender, selectedProduct]);

  // Selected variant (gender + size)
  const selectedVariant = useMemo(() => {
    if (!isVariable || !selectedGender || !selectedSize) return null;
    return selectedProduct?.product_sizes?.find(
      (s: any) => s.gender === selectedGender && s.size === selectedSize,
    ) ?? null;
  }, [isVariable, selectedGender, selectedSize, selectedProduct]);

  const currentStock = isVariable
    ? (selectedVariant?.quantity ?? null)
    : (selectedProduct?.quantity ?? null);

  // ── Load data ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('users').select('full_name').eq('id', authUser.id).single();
        if (profile) setCurrentUserName(profile.full_name);
      }

      let movementsQuery = supabase
        .from('stock_movements')
        .select('*, products:product_id(name, sku), users:user_id(full_name, stores:store_id(name)), product_sizes:product_size_id(gender, size)')
        .order('created_at', { ascending: false })
        .limit(100);

      // employer/magasinier voient uniquement leurs propres mouvements
      if (!isAdminOrSuperAdmin && authUser) {
        movementsQuery = movementsQuery.eq('user_id', authUser.id);
      }

      const [{ data: movementsData }, { data: productsData }] = await Promise.all([
        movementsQuery,
        supabase
          .from('products')
          .select('id, name, sku, quantity, reorder_level, status, product_type, expiry_date, product_sizes(id, gender, size, quantity)')
          .order('name'),
      ]);

      if (movementsData) setMovements(movementsData);
      if (productsData)  setProducts(productsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, isAdminOrSuperAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset gender/size when product changes
  useEffect(() => {
    setSelectedGender('');
    setSelectedSize('');
  }, [selectedProductId]);

  useEffect(() => {
    setSelectedSize('');
  }, [selectedGender]);

  // ── Stats ─────────────────────────────────────────────────────
  const movementStats = useMemo(() => {
    const statsMap: Record<string, { name: string; outQty: number }> = {};
    movements.forEach((m) => {
      if (!m.products?.name || m.type !== 'exit') return;
      if (!statsMap[m.products.name]) statsMap[m.products.name] = { name: m.products.name, outQty: 0 };
      statsMap[m.products.name].outQty += m.quantity;
    });
    products.forEach((p) => {
      if (!statsMap[p.name]) statsMap[p.name] = { name: p.name, outQty: 0 };
    });
    const sorted = Object.values(statsMap).sort((a, b) => b.outQty - a.outQty);
    return {
      fastest: sorted.slice(0, 5),
      slowest: sorted.filter((s) => s.outQty === 0).slice(0, 5),
    };
  }, [movements, products]);

  const expiringProducts = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    return products
      .filter(p => p.expiry_date && new Date(p.expiry_date) <= thirtyDaysFromNow)
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())
      .slice(0, 5);
  }, [products]);

  // ── Add movement ──────────────────────────────────────────────
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) { toast.error('Veuillez sélectionner un produit'); return; }

    if (isVariable) {
      if (!selectedGender) { toast.error('Veuillez sélectionner un genre'); return; }
      if (!selectedSize)   { toast.error('Veuillez sélectionner une taille'); return; }
      if (!selectedVariant) { toast.error('Variante introuvable'); return; }
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { toast.error('La quantité doit être un nombre positif'); return; }

    if (movementType === 'exit' && currentStock !== null && qty > currentStock) {
      const label = isVariable
        ? `Stock insuffisant (${genderLabel(selectedGender)} / ${selectedSize}) : ${currentStock} unité(s)`
        : `Stock insuffisant : ${currentStock} unité(s)`;
      toast.error(label);
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { error } = await supabase.from('stock_movements').insert([{
        product_id:      selectedProductId,
        product_size_id: isVariable && selectedVariant ? selectedVariant.id : null,
        type:            movementType,
        quantity:        qty,
        notes:           notes.trim() || null,
        user_id:         authUser?.id ?? null,
      }]);

      if (error) throw error;

      const stockAfter = currentStock !== null
        ? movementType === 'exit' ? currentStock - qty : currentStock + qty
        : null;

      const variantInfo = isVariable ? ` (${genderLabel(selectedGender)} / ${selectedSize})` : '';
      toast.success(
        movementType === 'exit'
          ? `Sortie de ${qty} unité(s)${variantInfo}. Stock restant : ${stockAfter ?? '?'}`
          : `Entrée de ${qty} unité(s)${variantInfo}. Nouveau stock : ${stockAfter ?? '?'}`,
      );

      setOpenDialog(false);
      setSelectedProductId('');
      setSelectedGender('');
      setSelectedSize('');
      setQuantity('');
      setNotes('');
      setMovementType('entry');
      setSearchTerm('');

      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mouvements de stock</h1>
          <p className="text-muted-foreground mt-1">Traçabilité complète des entrées et sorties</p>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ajouter un mouvement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mouvement de stock</DialogTitle>
              <DialogDescription>Enregistré par {currentUserName || 'Utilisateur'}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddMovement} className="space-y-4 pt-2">
              {/* Type + Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entrée</SelectItem>
                      <SelectItem value="exit">Sortie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantité *</Label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
                </div>
              </div>

              {/* Product search */}
              <div className="space-y-2">
                <Label>Produit *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"
                  />
                </div>

                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Aucun produit</p>
                  ) : filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-b-0 ${
                        selectedProductId === product.id ? 'border-l-4 border-l-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {product.product_type === 'variable' && (
                            <Badge variant="outline" className="text-[10px] px-1">Tailles</Badge>
                          )}
                          <Badge variant={product.quantity > 10 ? 'default' : product.quantity > 0 ? 'secondary' : 'destructive'}>
                            <Package className="h-3 w-3 mr-1" />{product.quantity ?? 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variable product: gender + size selectors */}
              {isVariable && selectedProductId && (
                <div className="space-y-3 p-3 rounded-md bg-muted/40 border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sélectionner la variante</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Genre *</Label>
                      <Select value={selectedGender} onValueChange={setSelectedGender}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Genre" /></SelectTrigger>
                        <SelectContent>
                          {availableGenders.map((g) => (
                            <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Taille *</Label>
                      <Select value={selectedSize} onValueChange={setSelectedSize} disabled={!selectedGender}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Taille" /></SelectTrigger>
                        <SelectContent>
                          {availableSizes.map((s: any) => (
                            <SelectItem key={s.id} value={s.size}>
                              {s.size} — {s.quantity} en stock
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Stock info */}
              {selectedProduct && currentStock !== null && (
                <div className={`p-3 rounded-md text-sm ${
                  movementType === 'exit' && currentStock <= 0
                    ? 'bg-red-50 text-red-700'
                    : movementType === 'exit' && currentStock <= (selectedProduct.reorder_level ?? 5)
                    ? 'bg-orange-50 text-orange-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {isVariable && selectedVariant ? (
                    <p className="font-medium">
                      Stock {genderLabel(selectedGender)} / {selectedSize} : {currentStock} unité(s)
                    </p>
                  ) : !isVariable ? (
                    <p className="font-medium">Stock actuel : {currentStock} unité(s)</p>
                  ) : (
                    <p className="text-muted-foreground">Sélectionnez une variante</p>
                  )}
                  {movementType === 'exit' && currentStock <= 0 && (
                    <p className="text-xs mt-1">Stock épuisé — sortie impossible</p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire optionnel..." rows={2} />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer le mouvement'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-green-600">
              <ArrowUp className="mr-2 h-5 w-5" />Produits les plus vendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movementStats.fastest.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pas encore de données.</p>
              ) : movementStats.fastest.map((p, i) => (
                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                  <span className="font-medium text-sm">{p.name}</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">{p.outQty} sorties</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-orange-600">
              <ArrowDown className="mr-2 h-5 w-5" />Produits sans mouvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movementStats.slowest.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tous les produits ont des mouvements.</p>
              ) : movementStats.slowest.map((p, i) => (
                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                  <span className="font-medium text-sm">{p.name}</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">0 sortie</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AIAnalysis 
        fastest={movementStats.fastest} 
        slowest={movementStats.slowest} 
        expiring={expiringProducts}
      />

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des mouvements</CardTitle>
          <CardDescription>{movements.length} mouvement(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Aucun mouvement enregistré
                      </TableCell>
                    </TableRow>
                  ) : movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{formatDate(m.created_at)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{m.products?.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.products?.sku}</p>
                      </TableCell>
                      <TableCell>
                        {m.product_sizes ? (
                          <Badge variant="secondary" className="text-xs">
                            {genderLabel(m.product_sizes.gender)} / {m.product_sizes.size}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.type === 'entry' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                          {m.type === 'entry'
                            ? <><ArrowDown className="h-3 w-3 mr-1" />Entrée</>
                            : <><ArrowUp className="h-3 w-3 mr-1" />Sortie</>
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.users?.full_name || 'Système'}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                          {m.users?.stores?.name || '-'}
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

      <DailyMovementsTable movements={movements} />
    </div>
  );
}

function DailyMovementsTable({ movements }: { movements: any[] }) {
  const todayKey = new Date().toISOString().split('T')[0];

  const grouped = movements.reduce((acc: Record<string, any[]>, m) => {
    const key = new Date(m.created_at).toISOString().split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).filter((d) => d !== todayKey).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return null;

  const label = (dateKey: string) => {
    const d = new Date(dateKey);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const same = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, yesterday)) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Mouvements par jour</h2>
      {sortedDates.map((dateKey) => (
        <Card key={dateKey}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 capitalize">
              {label(dateKey)}
              <Badge variant="outline">{grouped[dateKey].length} mouvement(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[dateKey].map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.products?.name}</TableCell>
                      <TableCell>
                        {m.product_sizes ? (
                          <Badge variant="secondary" className="text-xs">
                            {genderLabel(m.product_sizes.gender)} / {m.product_sizes.size}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.type === 'entry' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                          {m.type === 'entry'
                            ? <><ArrowUp className="h-3 w-3 mr-1" />Entrée</>
                            : <><ArrowDown className="h-3 w-3 mr-1" />Sortie</>
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.users?.full_name || 'Système'}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                          {m.users?.stores?.name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
