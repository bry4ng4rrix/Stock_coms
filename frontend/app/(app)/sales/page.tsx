'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Plus,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { toast } from 'sonner';

interface Sale {
  id: number;
  product?: number;
  product_name?: string;
  seller_name?: string;
  shop_name?: string;
  customer_name?: string;
  quantity: number;
  sale_price: number;
  total_price: number;
  sold_at: string;
  is_paid: boolean;
  payment_amount?: number;
  payment_due_date?: string;
  payment_date?: string;
}

interface Product {
  id: number;
  name: string;
  reference?: string;
  sell_price?: number;
  sale_price?: number;
  shell_price?: number;
  initial_quantity: number;
  alert_threshold?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MG', {
    minimumFractionDigits: 0,
  }).format(Math.round(n));

export default function SalesPage() {
  const { user, isManager } = useCurrentUser();

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] =
    useState(false);

  const [quantity, setQuantity] = useState('1');
  const [salePrice, setSalePrice] = useState('');

  const [customerName, setCustomerName] = useState('');

  const [isPaid, setIsPaid] = useState(true);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [salesData, productsData] = await Promise.all([
        djangoClient.sales.list(),
        djangoClient.products.list(),
      ]);

      setSales(Array.isArray(salesData) ? salesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error: any) {
      toast.error(
        error?.message || 'Erreur lors du chargement des données'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filters
  const filteredSales = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return sales.filter((sale) => {
      return (
        !term ||
        sale.product_name?.toLowerCase().includes(term) ||
        sale.seller_name?.toLowerCase().includes(term) ||
        sale.customer_name?.toLowerCase().includes(term)
      );
    });
  }, [sales, searchTerm]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase();

    return products
      .filter((product) => {
        return (
          !term ||
          product.name?.toLowerCase().includes(term) ||
          product.reference?.toLowerCase().includes(term)
        );
      })
      .filter((product) => product.initial_quantity > 0);
  }, [products, productSearch]);

  // Stats
  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return sales.filter((sale) =>
      sale.sold_at?.startsWith(today)
    );
  }, [sales]);

  const totalRevenue = useMemo(() => {
    return sales.reduce(
      (sum, sale) => sum + Number(sale.total_price || 0),
      0
    );
  }, [sales]);

  const todayRevenue = useMemo(() => {
    return todaySales.reduce(
      (sum, sale) => sum + Number(sale.total_price || 0),
      0
    );
  }, [todaySales]);

  const unpaidSales = useMemo(() => {
    return sales.filter((sale) => !sale.is_paid);
  }, [sales]);

  const unpaidSalesCount = unpaidSales.length;

  const unpaidSalesAmount = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => {
      const total = Number(sale.total_price || 0);
      const paid = Number(sale.payment_amount || 0);

      return sum + Math.max(0, total - paid);
    }, 0);
  }, [unpaidSales]);

  // Product select
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);

    setProductSearch(product.name);

    const productPrice =
      product.sell_price ||
      product.sale_price ||
      product.shell_price ||
      0;

    setSalePrice(String(productPrice));

    setShowProductDropdown(false);
  };

  // Reset form
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

  // Due info
  const paymentDueInfo = useMemo(() => {
    if (isPaid || !paymentDueDate) {
      return null;
    }

    const dueDate = new Date(paymentDueDate);
    const today = new Date();

    const diffDays = Math.ceil(
      (today.getTime() - dueDate.getTime()) / 86400000
    );

    return {
      dueDate,
      daysLate: diffDays,
      isOverdue: diffDays >= 0,
      daysUntil: Math.max(
        0,
        Math.ceil(
          (dueDate.getTime() - today.getTime()) / 86400000
        )
      ),
    };
  }, [isPaid, paymentDueDate]);

  // Create sale
  const handleCreateSale = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast.error('Veuillez sélectionner un produit');
      return;
    }

    const qty = parseInt(quantity);

    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantité invalide');
      return;
    }

    const price = parseFloat(salePrice);

    if (isNaN(price) || price <= 0) {
      toast.error('Prix invalide');
      return;
    }

    if (qty > selectedProduct.initial_quantity) {
      toast.error(
        `Stock insuffisant. Disponible : ${selectedProduct.initial_quantity}`
      );
      return;
    }

    const paymentAmountValue = parseFloat(paymentAmount || '0');

    const payload: any = {
      product: selectedProduct.id,
      quantity: qty,
      sale_price: price,
      customer_name: customerName,
      is_paid: isPaid,
    };

    if (paymentAmountValue > 0) {
      payload.payment_amount = paymentAmountValue;
    }

    if (!isPaid) {
      if (paymentDueDate) {
        payload.payment_due_date = paymentDueDate;
      } else {
        const defaultDate = new Date();

        defaultDate.setDate(defaultDate.getDate() + 7);

        payload.payment_due_date = defaultDate
          .toISOString()
          .split('T')[0];
      }
    }

    setSubmitting(true);

    try {
      await djangoClient.sales.create(payload);

      toast.success('Vente enregistrée avec succès');

      setDialogOpen(false);

      resetForm();

      await fetchData();
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Erreur lors de l’enregistrement de la vente'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Date
  const formatDate = (date: string) => {
    if (!date) return '-';

    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderPaymentDueDate = (sale: Sale) => {
    if (sale.is_paid) return <span className="text-muted-foreground">—</span>;
    if (!sale.payment_due_date) return <span className="text-muted-foreground">—</span>;

    const formatted = formatDueDate(sale.payment_due_date);
    
    // Check if overdue
    const dueDate = new Date(sale.payment_due_date);
    dueDate.setHours(23, 59, 59, 999);
    const today = new Date();
    
    const isOverdue = today > dueDate;
    
    if (isOverdue) {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-red-600">{formatted}</span>
          <span className="text-[10px] text-red-500 font-medium">Retard de {diffDays} j.</span>
        </div>
      );
    }
    
    return <span className="font-medium text-amber-600">{formatted}</span>;
  };

  const currentStock = selectedProduct?.initial_quantity ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            Ventes
          </h1>

          <p className="mt-1 text-muted-foreground">
            {user?.full_name
              ? `Bonjour, ${user.full_name}`
              : 'Gestion des ventes'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Rechercher..."
            className="max-w-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? 'animate-spin' : ''
              }`}
            />
            Actualiser
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);

              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle vente
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Enregistrer une vente
                </DialogTitle>

                <DialogDescription>
                  Ajouter une nouvelle vente
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={handleCreateSale}
                className="space-y-4"
              >
                {/* PRODUCT */}
                <div className="space-y-2">
                  <Label>Produit</Label>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      className="pl-9"
                      placeholder="Rechercher un produit..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);

                        setSelectedProduct(null);

                        setSalePrice('');

                        setShowProductDropdown(true);
                      }}
                      onFocus={() =>
                        setShowProductDropdown(true)
                      }
                      onBlur={() => {
                        setTimeout(() => {
                          setShowProductDropdown(false);
                        }, 150);
                      }}
                    />

                    {showProductDropdown &&
                      filteredProducts.length > 0 && (
                        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                          {filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              className="flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left hover:bg-muted"
                              onMouseDown={(e) =>
                                e.preventDefault()
                              }
                              onClick={() =>
                                handleProductSelect(product)
                              }
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {product.name}
                                </p>

                                <p className="font-mono text-xs text-muted-foreground">
                                  {product.reference}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-sm font-semibold">
                                  {fmt(
                                    Number(
                                      product.sell_price ||
                                        product.sale_price ||
                                        product.shell_price ||
                                        0
                                    )
                                  )}{' '}
                                  Ar
                                </p>

                                <Badge
                                  variant={
                                    product.initial_quantity > 5
                                      ? 'default'
                                      : 'destructive'
                                  }
                                  className="text-[10px]"
                                >
                                  <Package className="mr-1 h-3 w-3" />
                                  {product.initial_quantity}
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>

                {/* STOCK */}
                {selectedProduct && (
                  <div
                    className={`rounded-md p-3 text-sm ${
                      currentStock <=
                      (selectedProduct.alert_threshold || 5)
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    Stock disponible :{' '}
                    <strong>{currentStock}</strong>
                  </div>
                )}

                {/* CUSTOMER */}
                <div className="space-y-2">
                  <Label>Nom du client</Label>

                  <Input
                    placeholder="Nom du client"
                    value={customerName}
                    onChange={(e) =>
                      setCustomerName(e.target.value)
                    }
                  />
                </div>

                {/* QTY + PRICE */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité</Label>

                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prix de vente</Label>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={salePrice}
                      onChange={(e) =>
                        setSalePrice(e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* PAYMENT */}
                <div className="space-y-2">
                  <Label>Paiement</Label>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={
                        isPaid ? 'secondary' : 'outline'
                      }
                      onClick={() => setIsPaid(true)}
                    >
                      Payé
                    </Button>

                    <Button
                      type="button"
                      variant={
                        !isPaid ? 'secondary' : 'outline'
                      }
                      onClick={() => setIsPaid(false)}
                    >
                      Non payé
                    </Button>
                  </div>
                </div>

                {!isPaid && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant versé</Label>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Échéance</Label>

                      <Input
                        type="date"
                        value={paymentDueDate}
                        onChange={(e) =>
                          setPaymentDueDate(e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                {!isPaid && paymentDueInfo && (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      paymentDueInfo.isOverdue
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {paymentDueInfo.isOverdue ? (
                      <p>
                        Retard de paiement :{' '}
                        {paymentDueInfo.daysLate} jour(s)
                      </p>
                    ) : (
                      <p>
                        Échéance dans{' '}
                        {paymentDueInfo.daysUntil} jour(s)
                      </p>
                    )}
                  </div>
                )}

                {/* TOTAL */}
                {quantity && salePrice && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700">
                        Total
                      </span>

                      <span className="text-lg font-bold text-green-800">
                        {fmt(
                          Number(quantity) *
                            Number(salePrice)
                        )}{' '}
                        Ar
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    submitting ||
                    !selectedProduct ||
                    currentStock <= 0
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer la vente'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Aujourd'hui
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {todaySales.length}
                </div>

                <p className="text-xs text-muted-foreground">
                  {fmt(todayRevenue)} Ar
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-500" />
              Revenus
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-xl font-bold">
                {fmt(totalRevenue)} Ar
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Transactions
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {sales.length}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-orange-500" />
              Unités
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {sales.reduce(
                  (sum, sale) => sum + sale.quantity,
                  0
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Impayées
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {unpaidSalesCount}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-red-500" />
              Montant dû
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-xl font-bold">
                {fmt(unpaidSalesAmount)} Ar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des ventes</CardTitle>

          <CardDescription>
            {filteredSales.length} vente(s)
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-12 w-full"
                />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground/30" />

              <p className="text-lg font-medium text-muted-foreground">
                Aucune vente enregistrée
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">
                      Qté
                    </TableHead>
                    <TableHead className="text-right">
                      Prix
                    </TableHead>
                    <TableHead className="text-right">
                      Total
                    </TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Échéance</TableHead>

                    {isManager && (
                      <TableHead>Vendeur</TableHead>
                    )}

                    {isManager && (
                      <TableHead>Magasin</TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {formatDate(sale.sold_at)}
                      </TableCell>

                      <TableCell>
                        {sale.customer_name || '—'}
                      </TableCell>

                      <TableCell>
                        <p className="font-medium">
                          {sale.product_name ||
                            `Produit #${sale.product}`}
                        </p>
                      </TableCell>

                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {sale.quantity}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {fmt(Number(sale.sale_price || 0))} Ar
                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {fmt(Number(sale.total_price || 0))} Ar
                      </TableCell>

                      <TableCell>
                        {sale.is_paid ? (
                          <Badge className="bg-green-600">
                            Payé
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Non payé
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {renderPaymentDueDate(sale)}
                      </TableCell>

                      {isManager && (
                        <TableCell>
                          {sale.seller_name || '—'}
                        </TableCell>
                      )}

                      {isManager && (
                        <TableCell>
                          <Badge variant="outline">
                            {sale.shop_name || '-'}
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