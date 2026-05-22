'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus, ShoppingCart, TrendingUp, DollarSign, Package, Search, RefreshCw, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', { minimumFractionDigits: 0 }).format(Math.round(n));

export default function SalesPage() {
  const { user, isManager } = useCurrentUser();

  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // New sale form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesData, productsData] = await Promise.all([
        djangoClient.sales.list(),
        djangoClient.products.list(),
      ]);
      setSales(salesData);
      setProducts(productsData);
    } catch (err: any) {
      toast.error('Erreur de chargement: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredSales = useMemo(() =>
    sales.filter(s => {
      const term = searchTerm.toLowerCase();
      return !term ||
        (s.product_name || '').toLowerCase().includes(term) ||
        (s.seller_name || '').toLowerCase().includes(term);
    }),
    [sales, searchTerm]
  );

  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sales.filter(s => s.sold_at?.startsWith(today));
  }, [sales]);

  const totalRevenue = useMemo(() =>
    sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0), [sales]);

  const todayRevenue = useMemo(() =>
    todaySales.reduce((sum, s) => sum + Number(s.total_price || 0), 0), [todaySales]);

  const filteredProducts = useMemo(() =>
    products.filter(p => {
      const term = productSearch.toLowerCase();
      return !term ||
        (p.name || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term);
    }).filter(p => (p.initial_quantity ?? 0) > 0),
    [products, productSearch]
  );

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setSalePrice(String(product.shell_price || ''));
    setShowProductDropdown(false);
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('1');
    setSalePrice('');
    setCustomerName('');
    setIsPaid(true);
    setPaymentAmount('');
    setPaymentDueDate('');
    setShowProductDropdown(false);
  };

  const paymentDueInfo = useMemo(() => {
    if (isPaid || !paymentDueDate) return null;
    const dueDate = new Date(paymentDueDate);
    const today = new Date();
    const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / 86_400_000);
    return {
      dueDate,
      daysLate: diffDays,
      isOverdue: diffDays >= 0,
      daysUntil: Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)),
    };
  }, [isPaid, paymentDueDate]);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { toast.error('Veuillez sélectionner un produit'); return; }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { toast.error('Quantité invalide'); return; }
    const price = parseFloat(salePrice);
    if (isNaN(price) || price <= 0) { toast.error('Prix de vente invalide'); return; }
    if (qty > (selectedProduct.initial_quantity ?? 0)) {
      toast.error(`Stock insuffisant. Disponible : ${selectedProduct.initial_quantity} unité(s)`);
      return;
    }

    const paymentAmountValue = parseFloat(paymentAmount || '0');
    const payload: any = {
      product: selectedProduct.id,
      quantity: qty,
      sale_price: price,
      customer_name: customerName || '',
      is_paid: isPaid,
    };
    if (paymentAmountValue > 0) payload.payment_amount = paymentAmountValue;
    if (!isPaid) {
      if (paymentDueDate) {
        payload.payment_due_date = paymentDueDate;
      } else {
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 7);
        payload.payment_due_date = defaultDue.toISOString().split('T')[0];
      }
    }

    setSubmitting(true);
    try {
      await djangoClient.sales.create(payload);
      toast.success(`Vente enregistrée — ${qty} × ${selectedProduct.name}`);
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const currentStock = selectedProduct?.initial_quantity ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            Ventes
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.full_name ? `Bonjour, ${user.full_name}` : 'Enregistrez et suivez vos ventes'}
            {user?.shop_name ? ` — ${user.shop_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher une vente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle vente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enregistrer une vente</DialogTitle>
                <DialogDescription>Sélectionnez le produit et la quantité vendue</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSale} className="space-y-4 pt-2">
                {/* Product search */}
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher un produit..."
                      value={productSearch}
                      onChange={e => {
                        setProductSearch(e.target.value);
                        setSelectedProduct(null);
                        setSalePrice('');
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
                    />
                    {showProductDropdown && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 rounded-md border bg-white shadow-lg max-h-52 overflow-y-auto">
                        {filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-muted text-left border-b last:border-b-0"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleProductSelect(p)}
                          >
                            <div>
                              <div className="font-medium text-sm">{p.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{p.reference}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold">{fmt(Number(p.shell_price || 0))} Ar</div>
                              <Badge variant={p.initial_quantity > 5 ? 'default' : 'destructive'} className="text-[10px] px-1">
                                <Package className="h-3 w-3 mr-1" />{p.initial_quantity}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showProductDropdown && filteredProducts.length === 0 && productSearch && (
                      <div className="absolute z-50 w-full mt-1 rounded-md border bg-white shadow-lg p-3 text-sm text-muted-foreground text-center">
                        Aucun produit en stock trouvé
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock info */}
                {selectedProduct && (
                  <div className={`p-3 rounded-md text-sm ${
                    currentStock === 0 ? 'bg-red-50 text-red-700' :
                    currentStock !== null && currentStock <= (selectedProduct.alert_threshold ?? 5) ? 'bg-orange-50 text-orange-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    <p className="font-medium">
                      {selectedProduct.name} — Stock disponible : <strong>{currentStock}</strong> unité(s)
                    </p>
                    {currentStock === 0 && <p className="text-xs mt-1">Stock épuisé — vente impossible</p>}
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Nom du client</Label>
                  <Input
                    placeholder="Nom du client"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <Input
                      type="number" min="1"
                      max={selectedProduct?.initial_quantity || undefined}
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix de vente (Ar) *</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={salePrice}
                      onChange={e => setSalePrice(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status de paiement</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={isPaid ? 'secondary' : 'outline'}
                        size="sm"
                        className="w-full"
                        onClick={() => setIsPaid(true)}
                      >Payé</Button>
                      <Button
                        type="button"
                        variant={!isPaid ? 'secondary' : 'outline'}
                        size="sm"
                        className="w-full"
                        onClick={() => setIsPaid(false)}
                      >Pas encore</Button>
                    </div>
                  </div>
                </div>
                {!isPaid && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant versé (optionnel)</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Échéance de paiement</Label>
                      <Input
                        type="date"
                        value={paymentDueDate}
                        onChange={e => setPaymentDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {!isPaid && paymentDueInfo && (
                  <div className={`rounded-md p-3 text-sm ${paymentDueInfo.isOverdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                    {paymentDueInfo.isOverdue ? (
                      <p>Retard de paiement : {paymentDueInfo.daysLate} jour(s).</p>
                    ) : (
                      <p>Échéance de paiement dans {paymentDueInfo.daysUntil} jour(s).</p>
                    )}
                    <p className="text-xs text-muted-foreground">Échéance : {paymentDueDate}</p>
                  </div>
                )}

                {/* Total preview */}
                {quantity && salePrice && !isNaN(parseFloat(salePrice)) && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-700">Total de la vente</span>
                      <span className="text-lg font-bold text-green-800">
                        {fmt(parseInt(quantity || '0') * parseFloat(salePrice || '0'))} Ar
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !selectedProduct || currentStock === 0}
                >
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement…</> : 'Enregistrer la vente'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />Ventes aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <>
                <div className="text-2xl font-bold">{todaySales.length}</div>
                <p className="text-xs text-muted-foreground mt-1">{fmt(todayRevenue)} Ar</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />Chiffre d'affaires total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-xl font-bold">{fmt(totalRevenue)} Ar</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />Total transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold">{sales.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />Unités vendues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold">
                {sales.reduce((sum, s) => sum + (s.quantity || 0), 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique de mes ventes</CardTitle>
          <CardDescription>{filteredSales.length} vente(s) affichée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Aucune vente enregistrée</p>
              <p className="text-sm text-muted-foreground mt-1">Cliquez sur "Nouvelle vente" pour commencer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix unitaire</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Paiement</TableHead>
                    {isManager && <TableHead>Vendeur</TableHead>}
                    {isManager && <TableHead>Magasin</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.sold_at)}</TableCell>
                      <TableCell className="text-sm">{s.customer_name || '—'}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{s.product_name || `Produit #${s.product}`}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{s.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmt(Number(s.sale_price || 0))} Ar</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(s.total_price || 0))} Ar</TableCell>
                      <TableCell className="text-sm">
                        {s.is_paid ? (
                          <div className="space-y-1">
                            <span className="font-semibold text-green-700">Payé</span>
                            {s.payment_date && <span className="text-xs text-muted-foreground">{new Date(s.payment_date).toLocaleDateString('fr-FR')}</span>}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-semibold text-orange-700">Non payé</span>
                            {s.payment_due_date ? (
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  const due = new Date(s.payment_due_date);
                                  const diff = Math.ceil((new Date().getTime() - due.getTime()) / 86_400_000);
                                  return diff >= 0 ? `Retard ${diff} j` : `Dans ${Math.abs(diff)} j`;
                                })()}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Aucune échéance</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      {isManager && <TableCell className="text-sm">{s.seller_name || '—'}</TableCell>}
                      {isManager && (
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="font-normal border-blue-200 text-blue-700 bg-blue-50/50">
                            {s.shop_name || '-'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
