'use client';

import { ProtectedRoute } from '@/lib/protected-route';
import useSWR from 'swr';
import { fetcher, getApiClient } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface Sale {
  id: number;
  product_name: string;
  quantity: number;
  sale_price: number;
  total_price: number;
  sold_at: string;
}

interface Product {
  id: number;
  name: string;
  shell_price: number;
  initial_quantity: number;
}

export default function EmployerSalesPage() {
  return (
    <ProtectedRoute requiredRoles={['employer']}>
      <EmployerSalesContent />
    </ProtectedRoute>
  );
}

function EmployerSalesContent() {
  const { data: sales, error, isLoading, mutate: mutateSales } = useSWR<Sale[]>(
    '/sales/',
    fetcher
  );
  const { data: products } = useSWR<Product[]>('/products/', fetcher);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    product: '',
    quantity: '',
    sale_price: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await getApiClient().post('/sales/', {
        product: parseInt(formData.product),
        quantity: parseInt(formData.quantity),
        sale_price: parseFloat(formData.sale_price),
      });

      setFormData({ product: '', quantity: '', sale_price: '' });
      setIsDialogOpen(false);
      mutateSales();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      alert('Erreur lors de l\'enregistrement de la vente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products?.find(
    (p) => p.id === parseInt(formData.product || '0')
  );

  const totalSales = sales?.reduce((sum, sale) => sum + sale.total_price, 0) || 0;
  const totalQuantity = sales?.reduce((sum, sale) => sum + sale.quantity, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Erreur lors du chargement des ventes</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes ventes</h1>
          <p className="text-gray-600">
            Total: {totalSales.toFixed(2)} € ({totalQuantity} articles)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle vente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer une vente</DialogTitle>
              <DialogDescription>
                Remplissez les informations de la vente
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Produit *</label>
                <Select
                  value={formData.product}
                  onValueChange={(value) =>
                    setFormData({ ...formData, product: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} ({product.initial_quantity} en stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantité *</label>
                <Input
                  type="number"
                  min="1"
                  max={selectedProduct?.initial_quantity || 999}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  placeholder="Quantité"
                  required
                />
                {selectedProduct && (
                  <p className="text-xs text-gray-600">
                    Stock disponible: {selectedProduct.initial_quantity}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Prix de vente (€) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={(e) =>
                    setFormData({ ...formData, sale_price: e.target.value })
                  }
                  placeholder="Prix de vente"
                  required
                />
                {selectedProduct && formData.sale_price && formData.quantity && (
                  <p className="text-xs text-green-600 font-semibold">
                    Total: {(parseFloat(formData.sale_price) * parseInt(formData.quantity)).toFixed(2)} €
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isSubmitting || !formData.product || !formData.quantity || !formData.sale_price}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la vente'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {sales && sales.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Nombre de ventes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{sales.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Quantité vendue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{totalQuantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Montant total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {totalSales.toFixed(2)} €
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Historique de mes ventes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Produit</th>
                  <th className="text-right py-3 px-4 font-semibold">Quantité</th>
                  <th className="text-right py-3 px-4 font-semibold">P. Unitaire</th>
                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales && sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{sale.product_name}</td>
                      <td className="py-3 px-4 text-right">{sale.quantity}</td>
                      <td className="py-3 px-4 text-right text-blue-600">
                        {sale.sale_price.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">
                        {sale.total_price.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {new Date(sale.sold_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Aucune vente enregistrée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
