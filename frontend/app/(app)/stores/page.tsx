'use client';

import { useEffect, useState, useCallback } from 'react';
import { djangoClient } from '@/lib/django-client';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { Store, Users, RefreshCw, Loader2, Edit, ArrowLeftRight, ShoppingCart, Search, X, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function StoresPage() {
  const { user, isAdmin } = useCurrentUser();

  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');

  const [submittingStore, setSubmittingStore] = useState(false);

  const [editingStore, setEditingStore] = useState<any>(null);
  const [isEditStoreDialogOpen, setIsEditStoreDialogOpen] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreLogoFile, setEditStoreLogoFile] = useState<File | null>(null);
  const [editStoreLogoPreview, setEditStoreLogoPreview] = useState<string | null>(null);
  const [submittingEditStore, setSubmittingEditStore] = useState(false);

  // Transfer dialog state
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferSourceStore, setTransferSourceStore] = useState<any>(null);
  const [destinationStoreId, setDestinationStoreId] = useState<number | ''>('');
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [sourceProducts, setSourceProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [transferCart, setTransferCart] = useState<{ id: number; name: string; reference: string; quantity: number; maxQuantity: number }[]>([]);
  const [productQtyInputs, setProductQtyInputs] = useState<Record<number, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);


  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const data = await djangoClient.get<any[]>(
        '/users/magasins/users/'
      );

      let stats: any[] = [];
      let profitByMagasins: any[] = [];

      try {
        stats = await djangoClient.get<any[]>(
          '/users/magasins/stats/'
        );
      } catch (statsErr) {
        console.error(statsErr);
      }

      if (isAdmin) {
        try {
          const profitRes =
            await djangoClient.transfers.getProfitByMagasins();

          profitByMagasins =
            profitRes?.profit_by_magasins || [];
        } catch (profitErr) {
          console.error(profitErr);
        }
      }

      const merged = data.map((store) => {
        const storeStats =
          stats.find(
            (item) =>
              item.magasin_id === store.magasin_id
          ) || {
            total_products: 0,
            total_stock_value: 0,
            total_sold_value: 0,
            profit: 0,
          };

        const profitStats =
          profitByMagasins.find(
            (item) =>
              item.magasin_id === store.magasin_id
          );

        return {
          ...store,
          stats: {
            ...storeStats,
            profit:
              profitStats?.total_profit ??
              storeStats.profit ??
              0,
          },
        };
      });

      setStores(merged);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartEditStore = (store: any) => {
    setEditingStore(store);
    setEditStoreName(store.shop_name);
    setEditStoreLogoFile(null);
    setEditStoreLogoPreview(store.shop_logo || null);
    setIsEditStoreDialogOpen(true);
  };

  const handleEditStoreLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditStoreLogoFile(file);
      setEditStoreLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setSubmittingEditStore(true);
    try {
      const formData = new FormData();
      formData.append('shop_name', editStoreName);
      if (editStoreLogoFile) {
        formData.append('shop_logo', editStoreLogoFile);
      }
      
      await djangoClient.patchFormData(`/users/magasins/${editingStore.magasin_id}/`, formData);
      toast.success('Magasin mis à jour avec succès');
      setIsEditStoreDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmittingEditStore(false);
    }
  };

  const handleRegisterStore = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setSubmittingStore(true);

    try {
      const response =
        await djangoClient.auth.register(
          managerEmail,
          managerEmail,
          managerPassword,
          'magasin',
          {
            full_name: managerName,
            shop_name: storeName,
            admin_email: user?.email,
          }
        );

      if (response?.id) {
        await djangoClient.auth.approveUser(
          response.id
        );
      }

      toast.success('Magasin créé.');

      setStoreName('');
      setManagerName('');
      setManagerEmail('');
      setManagerPassword('');

      setIsRegisterDialogOpen(false);

      fetchData();
    } catch (err: any) {
      toast.error(
        err?.message ||
          'Erreur lors de la création.'
      );
    } finally {
      setSubmittingStore(false);
    }
  };

  const formatNumber = (
    value: number | string | null | undefined
  ) =>
    new Intl.NumberFormat('fr-FR').format(
      Number(value ?? 0)
    );

  const formatCurrency = (
    value: number | string | null | undefined
  ) =>
    `${new Intl.NumberFormat('fr-MG').format(
      Number(value ?? 0)
    )} Ar`;
  const resetTransferState = () => {
    setTransferSourceStore(null);
    setDestinationStoreId('');
    setDestinationSearchTerm('');
    setProductSearchTerm('');
    setSourceProducts([]);
    setTransferCart([]);
    setProductQtyInputs({});
  };

  const handleStartTransfer = (store: any) => {
    setTransferSourceStore(store);
    setDestinationStoreId('');
    setDestinationSearchTerm('');
    setProductSearchTerm('');
    setTransferCart([]);
    setProductQtyInputs({});
    setIsTransferDialogOpen(true);
  };

  const getProductQtyInput = (product: any) => {
    const stock = Number(product.initial_quantity ?? 0);
    const raw = productQtyInputs[product.id] ?? 1;
    return Math.min(Math.max(1, raw), Math.max(stock, 1));
  };

  const setProductQtyInput = (productId: number, value: number, max: number) => {
    const clamped = Math.min(Math.max(1, value), Math.max(max, 1));
    setProductQtyInputs((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleTransferDialogChange = (open: boolean) => {
    setIsTransferDialogOpen(open);
    if (!open) resetTransferState();
  };

  const addToTransferCart = (product: any) => {
    const stock = Number(product.initial_quantity ?? 0);
    if (stock <= 0) {
      toast.error(`${product.name} : stock insuffisant`);
      return;
    }
    if (transferCart.some((item) => item.id === product.id)) {
      toast.info(`${product.name} est déjà dans le panier`);
      return;
    }
    const quantity = getProductQtyInput(product);
    setTransferCart((prev) => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        reference: product.reference,
        quantity,
        maxQuantity: stock,
      },
    ]);
    toast.success(`${quantity} × ${product.name} ajouté au panier`);
  };

  const removeFromTransferCart = (productId: number) => {
    setTransferCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateTransferCartQuantity = (productId: number, value: number) => {
    setTransferCart((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.min(Math.max(1, value), item.maxQuantity) }
          : item
      )
    );
  };

  const transferCartTotalQty = transferCart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredSourceProducts = sourceProducts.filter((p) =>
    p.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.reference?.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const destinationStores = stores.filter(
    (s) =>
      s.magasin_id !== transferSourceStore?.magasin_id &&
      s.shop_name.toLowerCase().includes(destinationSearchTerm.toLowerCase())
  );

  const selectedDestinationStore = stores.find((s) => s.magasin_id === destinationStoreId);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceStore || !destinationStoreId || transferCart.length === 0) {
      toast.error('Sélectionnez des produits et un magasin de destination');
      return;
    }
    setSubmittingTransfer(true);
    try {
      await djangoClient.transfers.transfer(
        transferSourceStore.magasin_id,
        destinationStoreId as number,
        transferCart.map((p) => ({ product_id: p.id, quantity: p.quantity }))
      );
      toast.success('Transfert effectué');
      handleTransferDialogChange(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du transfert');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  useEffect(() => {
    const magasinId = transferSourceStore?.magasin_id;
    if (!magasinId) {
      setSourceProducts([]);
      return;
    }
    const fetchProducts = async () => {
      setLoadingProducts(true);
      setSourceProducts([]);
      setTransferCart([]);
      setProductQtyInputs({});
      try {
        const products = await djangoClient.products.list({ magasin_id: magasinId });
        const storeProducts = products.filter(
          (p) => Number(p.magasin) === Number(magasinId)
        );
        setSourceProducts(storeProducts);
      } catch (err) {
        console.error('Failed to load source products', err);
        toast.error('Erreur de chargement des produits');
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [transferSourceStore?.magasin_id]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">
              Magasins
            </h1>

            <p className="text-muted-foreground">
              {stores.length} magasin(s)
            </p>
          </div>

          <div className="flex gap-2">

            {isAdmin && (
              <Dialog
                open={isRegisterDialogOpen}
                onOpenChange={setIsRegisterDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    Créer un magasin
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Nouveau magasin
                    </DialogTitle>

                    <DialogDescription>
                      Ajouter un magasin
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    onSubmit={handleRegisterStore}
                    className="space-y-4"
                  >
                    <div>
                      <Label>
                        Nom du magasin
                      </Label>

                      <Input
                        value={storeName}
                        onChange={(e) =>
                          setStoreName(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div>
                      <Label>
                        Nom du gérant
                      </Label>

                      <Input
                        value={managerName}
                        onChange={(e) =>
                          setManagerName(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div>
                      <Label>Email</Label>

                      <Input
                        type="email"
                        value={managerEmail}
                        onChange={(e) =>
                          setManagerEmail(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div>
                      <Label>
                        Mot de passe
                      </Label>

                      <Input
                        type="password"
                        value={managerPassword}
                        onChange={(e) =>
                          setManagerPassword(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingStore}
                      className="w-full"
                    >
                      {submittingStore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Création...
                        </>
                      ) : (
                        'Créer'
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="outline"
              onClick={fetchData}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              />

              Actualiser
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map(
              (_, i) => (
                <Skeleton
                  key={i}
                  className="h-40 rounded-xl"
                />
              )
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 
            {stores.map((store) => (
              <Card
                key={store.magasin_id}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    {store.shop_logo ? (
                      <img src={store.shop_logo} alt="logo" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                    {store.shop_name}
                  </CardTitle>
                  {isAdmin && (
                   <div className='flex space-x-2'>
                                        {/*transfert products between stores  */}    
                    <Button 
                      size="icon"
                      variant='outline'
                      onClick={() => handleStartTransfer(store)}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStartEditStore(store)}
                    >
                     <Edit className="h-4 w-4" />
                    </Button>
                   </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">

                  {store.manager && (
                    <div className="border-b pb-3">
                      <p className="font-medium">
                        {store.manager.full_name}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {store.manager.email}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">

                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        Produits
                      </p>

                    <div>
                    <p className="font-bold">
                    {formatNumber(store.stats?.total_stock_quantity)} unité(s) sur {formatNumber(store.stats?.total_products)} produits
                      </p>

                    </div>
                    </div>

                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        Stock
                      </p>

                      <p className="font-bold">
                        {formatCurrency(
                          store.stats?.total_stock_value
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        Ventes
                      </p>

                      <p className="font-bold">
                        {formatCurrency(
                          store.stats?.total_sold_value
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-green-50">
                      <p className="text-xs text-muted-foreground">
                        Profit
                      </p>

                      <p className="font-bold text-green-700">
                        {formatCurrency(
                          store.stats?.profit
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4" />
                      Employés (
                      {store.employers?.length || 0})
                    </p>

                    <div className="space-y-2 mt-2">
                      {store.employers
                        ?.slice(0, 3)
                        .map((emp: any) => (
                          <div
                            key={emp.id}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm">
                              {emp.full_name}
                            </span>

                            <Badge variant="outline">
                              {emp.is_confirmed
                                ? 'Actif'
                                : 'Attente'}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            ))}

          </div>
        )}
      </div>

      <Dialog open={isTransferDialogOpen} onOpenChange={handleTransferDialogChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Transfert de produits</DialogTitle>
            <DialogDescription>
              Depuis <span className="font-medium text-foreground">{transferSourceStore?.shop_name}</span> — sélectionnez des produits et choisissez le magasin de destination.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransferSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1">
              {/* Produits du magasin source */}
              <div className="flex flex-col border rounded-lg min-h-0">
                <div className="p-3 border-b space-y-2">
                  <Label>Produits du magasin</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un produit..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-64 lg:h-72">
                  {loadingProducts ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Chargement...
                    </div>
                  ) : filteredSourceProducts.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      {sourceProducts.length === 0 ? 'Aucun produit dans ce magasin' : 'Aucun résultat'}
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredSourceProducts.map((product) => {
                        const inCart = transferCart.some((item) => item.id === product.id);
                        const stock = Number(product.initial_quantity ?? 0);
                        const qty = getProductQtyInput(product);
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.reference} · Stock : {stock}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                type="number"
                                min={1}
                                max={stock}
                                value={qty}
                                disabled={inCart || stock <= 0}
                                onChange={(e) =>
                                  setProductQtyInput(product.id, Number(e.target.value), stock)
                                }
                                className="w-16 h-8 text-center px-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant={inCart ? 'secondary' : 'outline'}
                                disabled={inCart || stock <= 0}
                                onClick={() => addToTransferCart(product)}
                              >
                                {inCart ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Sélectionné
                                  </>
                                ) : (
                                  'Sélectionner'
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Panier + magasin destination */}
              <div className="flex flex-col gap-4 min-h-0">
                <div className="flex flex-col border rounded-lg flex-1 min-h-0">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <Label>Panier de transfert</Label>
                    </div>
                    <Badge variant="secondary">{transferCartTotalQty} unité(s)</Badge>
                  </div>
                  <ScrollArea className="h-40">
                    {transferCart.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        Aucun produit sélectionné
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {transferCart.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.reference} · max {item.maxQuantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Input
                                type="number"
                                min={1}
                                max={item.maxQuantity}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateTransferCartQuantity(item.id, Number(e.target.value))
                                }
                                className="w-16 h-8 text-center px-1"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeFromTransferCart(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="flex flex-col border rounded-lg">
                  <div className="p-3 border-b space-y-2">
                    <Label>Magasin de destination</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un magasin..."
                        value={destinationSearchTerm}
                        onChange={(e) => setDestinationSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {selectedDestinationStore && (
                      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                        <Store className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{selectedDestinationStore.shop_name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 ml-auto shrink-0"
                          onClick={() => setDestinationStoreId('')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <ScrollArea className="h-28">
                    <div className="p-2 space-y-1">
                      {destinationStores.length === 0 ? (
                        <p className="p-2 text-sm text-muted-foreground text-center">
                          Aucun magasin trouvé
                        </p>
                      ) : (
                        destinationStores.map((store) => (
                          <button
                            key={store.magasin_id}
                            type="button"
                            onClick={() => setDestinationStoreId(store.magasin_id)}
                            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                              destinationStoreId === store.magasin_id
                                ? 'bg-primary/10 border border-primary/30 font-medium'
                                : 'border border-transparent'
                            }`}
                          >
                            {store.shop_logo ? (
                              <img src={store.shop_logo} alt="" className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            {store.shop_name}
                            {destinationStoreId === store.magasin_id && (
                              <Check className="h-4 w-4 ml-auto text-primary shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submittingTransfer || transferCart.length === 0 || !destinationStoreId}
              className="w-full"
            >
              {submittingTransfer ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transfert en cours...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transférer {transferCartTotalQty > 0 ? `${transferCartTotalQty} unité(s)` : ''}
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditStoreDialogOpen} onOpenChange={setIsEditStoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le magasin</DialogTitle>
            <DialogDescription>
              Modifier le nom et le logo du magasin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateStore} className="space-y-4">
            <div>
              <Label>Nom du magasin</Label>
              <Input
                value={editStoreName}
                onChange={(e) => setEditStoreName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label>Logo du magasin</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleEditStoreLogoChange}
              />
              {editStoreLogoPreview && (
                <div className="mt-2 flex justify-center">
                  <img
                    src={editStoreLogoPreview}
                    alt="Logo magasin"
                    className="h-20 w-20 object-contain rounded-md border"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={submittingEditStore}
              className="w-full"
            >
              {submittingEditStore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}