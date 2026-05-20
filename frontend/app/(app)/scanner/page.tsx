'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Barcode, QrCode, Camera } from 'lucide-react';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import { QRCodeCanvas } from 'qrcode.react';

export default function ScannerPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [scannedSKU, setScannedSKU] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('*, product_sizes(size, quantity)')
          .order('name');

        if (data) setProducts(data);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    fetchProducts();
  }, [supabase]);

  useEffect(() => {
    if (scannedSKU) {
      const product = products.find((p) => p.sku === scannedSKU);
      if (product) {
        setSelectedProduct(product);
      } else {
        toast.error('Produit non trouvé');
        setScannedSKU('');
      }
    }
  }, [scannedSKU, products]);

  useEffect(() => {
    if (selectedProduct && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, selectedProduct.sku, {
          format: 'CODE128',
          width: 2,
          height: 100,
        });
      } catch (err) {
        console.error('Error generating barcode:', err);
      }
    }
  }, [selectedProduct]);

  const handleScan = () => {
    if (!selectedProduct || !quantity) {
      toast.error('Veuillez sélectionner un produit');
      return;
    }

    toast.success(`Scannage enregistré: ${selectedProduct.name} x ${quantity}`);
    setScannedSKU('');
    setSelectedProduct(null);
    setQuantity('1');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Scanner</h1>
        <p className="text-muted-foreground mt-1">Scannez les code-barres et QR codes de vos produits</p>
      </div>

      <Tabs defaultValue="scan" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scan">
            <Camera className="h-4 w-4 mr-2" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="barcode">
            <Barcode className="h-4 w-4 mr-2" />
            Codes-barres
          </TabsTrigger>
          <TabsTrigger value="qrcode">
            <QrCode className="h-4 w-4 mr-2" />
            QR Codes
          </TabsTrigger>
        </TabsList>

        {/* Scanner Tab */}
        <TabsContent value="scan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interface de scan</CardTitle>
              <CardDescription>
                Entrez le SKU d&apos;un produit ou scannez directement avec un lecteur code-barres
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Camera placeholder */}
              <div className="bg-slate-900 rounded-lg h-96 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-300">Webcam - Cliquez pour activer</p>
                </div>
              </div>

              {/* Manual input */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Code SKU / Code-barres</Label>
                  <Input
                    id="sku"
                    value={scannedSKU}
                    onChange={(e) => setScannedSKU(e.target.value)}
                    placeholder="Scannez ou entrez le SKU..."
                    autoFocus
                  />
                </div>

                {selectedProduct && (
                  <>
                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Produit sélectionné</p>
                          <p className="text-lg font-bold">{selectedProduct.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">SKU: {selectedProduct.sku}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Stock actuel</p>
                            <p className="text-2xl font-bold">
                              {selectedProduct.product_sizes?.reduce((s: number, ps: any) => s + (ps.quantity || 0), 0) || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Prix unitaire</p>
                            <p className="text-2xl font-bold">Ar {selectedProduct.unit_price.toFixed(2)}</p>
                          </div>
                        </div>
                        <div>
                          <Badge className={
                            selectedProduct.status === 'in_stock'
                              ? 'bg-green-100 text-green-800'
                              : selectedProduct.status === 'low'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }>
                            {selectedProduct.status === 'in_stock'
                              ? 'En stock'
                              : selectedProduct.status === 'low'
                              ? 'Faible'
                              : 'Rupture'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantité à enregistrer</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleScan}>
                        Confirmer le scan
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setScannedSKU('');
                          setSelectedProduct(null);
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Barcode Tab */}
        <TabsContent value="barcode" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Générateur de codes-barres</CardTitle>
              <CardDescription>
                Générez et imprimez les codes-barres de vos produits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.slice(0, 6).map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-4 flex flex-col items-center space-y-4"
                  >
                    <svg ref={barcodeRef}></svg>
                    <div className="text-center">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedProduct(product)}>
                          Détails
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{product.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded flex justify-center">
                            <svg ref={barcodeRef}></svg>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">SKU</p>
                              <p className="font-medium">{product.sku}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Stock</p>
                              <p className="font-medium">{product.quantity}</p>
                            </div>
                          </div>
                          <Button className="w-full" variant="outline">
                            Imprimer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Code Tab */}
        <TabsContent value="qrcode" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Générateur de QR codes</CardTitle>
              <CardDescription>
                Générez et imprimez les QR codes de vos produits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.slice(0, 6).map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-4 flex flex-col items-center space-y-4"
                  >
                    <div className="bg-white p-2 rounded">
                      <QRCodeCanvas
                        value={product.sku}
                        size={128}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Détails
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{product.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded flex justify-center">
                            <QRCodeCanvas
                              value={product.sku}
                              size={256}
                              level="H"
                              includeMargin={true}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">SKU</p>
                              <p className="font-medium">{product.sku}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Stock</p>
                              <p className="font-medium">{product.quantity}</p>
                            </div>
                          </div>
                          <Button className="w-full" variant="outline">
                            Imprimer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
