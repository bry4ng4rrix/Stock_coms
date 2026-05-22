'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { djangoClient } from '@/lib/django-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Search, Package } from 'lucide-react';
import { toast } from 'sonner';

const QrScanner = dynamic(() => import('@yudiel/react-qr-scanner'), { ssr: false });

const MEDIA_BASE = (process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000/api')
  .replace('/api', '');

export default function ScannerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);

  const startScanning = () => setScanning(true);
  const stopScanning = () => setScanning(false);

  const fetchProductById = async (id: string) => {
    try {
      const product = await djangoClient.products.getById(Number(id));
      setScannedProduct(product);
      setResults([product]);
    } catch (err: any) {
      toast.error(err.message || 'Produit introuvable');
    }
  };

  const handleScan = (result: any) => {
    if (result?.text) {
      setScanning(false);
      fetchProductById(result.text);
    }
  };



  const addToCart = async (product: any) => {
    try {
      await djangoClient.post('/users/cart/', { product_id: product.id, quantity: 1 });
      toast.success('Produit ajouté au panier');
    } catch (err: any) {
      toast.error(err.message || "Erreur d'ajout au panier");
    }
  };

// Search products by query string
  const search = async (q: string) => {
    if (!q) {
      setResults([]);
      return;
    }
    try {
      setLoading(true);
      const data = await djangoClient.products.search(q);
      setResults(data);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query]);
  



  useEffect(() => { inputRef.current?.focus(); }, []);

  const stockStatus = (p: any) => {
    if (p.initial_quantity === 0) return { label: 'Rupture', class: 'bg-red-100 text-red-800' };
    if (p.initial_quantity <= p.alert_threshold) return { label: 'Faible', class: 'bg-orange-100 text-orange-800' };
    return { label: 'En stock', class: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <QrCode className="h-8 w-8 text-blue-600" />Scanner / Recherche
        </h1>
        <p className="text-muted-foreground mt-1">Recherchez un produit par nom, référence ou catégorie</p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Nom, référence, catégorie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="my-2">
        <Button onClick={startScanning} className="w-full">
          Scanner le QR code
        </Button>
      </div>
      {scanning && (
        <QrScanner
          onDecode={handleScan}
          constraints={{ facingMode: 'environment' }}
          style={{ width: '100%' }}
        />
      )}

      {/* Results */}
      {(query || results.length > 0) && (
        loading ? (
          <p className="text-muted-foreground text-sm">Recherche...</p>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <Package className="h-10 w-10" />
              <p>Aucun produit trouvé pour « {query} »</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((p) => {
              const status = stockStatus(p);
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge className={status.class}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{p.reference}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {p.image1 && (
                      <img
                        src={p.image1.startsWith('http') ? p.image1 : `${MEDIA_BASE}${p.image1}`}
                        alt={p.name}
                        className="w-full h-32 object-cover rounded-md"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Catégorie</p>
                        <p className="font-medium">{p.category || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Quantité</p>
                        <p className="font-semibold">{p.initial_quantity} u.</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Prix vente</p>
                        <p className="font-medium">{new Intl.NumberFormat('fr-MG').format(p.shell_price)} Ar</p>
                      </div>
                      <Button onClick={() => addToCart(p)} className="mt-2 w-full">
                        Ajouter au panier
                      </Button>
                      {p.expiry_date && (
                        <div>
                          <p className="text-muted-foreground text-xs">Expiration</p>
                          <p className="font-medium">{new Date(p.expiry_date).toLocaleDateString('fr-FR')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {!query && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground gap-3">
            <QrCode className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">Tapez pour rechercher un produit</p>
            <p className="text-sm">Utilisez la barre ci-dessus ou scannez un QR code</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
