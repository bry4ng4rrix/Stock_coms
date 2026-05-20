"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {Card,CardContent,CardDescription,CardHeader,CardTitle,} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow,} from "@/components/ui/table";
import { BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,PieChart,Pie,Cell,} from "recharts";
import {Download,AlertTriangle,Loader2,}from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGuard } from "@/components/auth/admin-guard";

interface ProductStat {
  id: string;
  product_id: string;
  size: string;
  total_sold: number;
  total_purchased: number;
  movement_count: number;
  last_movement_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    category_id: string;
  };
}

interface CategoryData {
  name: string;
  products: number;
  totalSold: number;
  totalPurchased: number;
}

interface SizeDistribution {
  size: string;
  count: number;
  percentage: number;
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

export default function ReportsPage() {
  return (
    <AdminGuard>
      <ReportsContent />
    </AdminGuard>
  );
}

function ReportsContent() {
  const [stats, setStats] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<
    "overview" | "products" | "categories" | "sizes"
  >("overview");
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [sizeDistribution, setSizeDistribution] = useState<SizeDistribution[]>(
    [],
  );
  const [exportLoading, setExportLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);

      // Load product stats
      const { data: statsData, error: statsError } = await supabase
        .from("product_stats")
        .select(
          `
          *,
          product:product_id(id, name, sku, category_id)
        `,
        )
        .order("total_sold", { ascending: false });

      if (statsError) throw statsError;

      const formattedStats =
        statsData?.map((stat: any) => ({
          ...stat,
          product: stat.product?.[0] || null,
        })) || [];

      setStats(formattedStats);

      // Calculate category data
      const categoryMap = new Map<string, CategoryData>();
      formattedStats.forEach((stat: ProductStat) => {
        const categoryName = stat.product?.category_id || "Sans catégorie";
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            name: categoryName,
            products: 0,
            totalSold: 0,
            totalPurchased: 0,
          });
        }
        const cat = categoryMap.get(categoryName)!;
        cat.products += 1;
        cat.totalSold += stat.total_sold;
        cat.totalPurchased += stat.total_purchased;
      });

      setCategories(Array.from(categoryMap.values()));

      // Calculate size distribution
      const sizeMap = new Map<string, number>();
      formattedStats.forEach((stat: ProductStat) => {
        sizeMap.set(
          stat.size,
          (sizeMap.get(stat.size) || 0) + stat.movement_count,
        );
      });

      const totalMovements = Array.from(sizeMap.values()).reduce(
        (a, b) => a + b,
        0,
      );
      const sizeData = Array.from(sizeMap.entries()).map(([size, count]) => ({
        size,
        count,
        percentage:
          totalMovements > 0 ? Math.round((count / totalMovements) * 100) : 0,
      }));

      setSizeDistribution(
        sizeData.sort((a, b) => {
          const order = { S: 0, M: 1, XL: 2, XXL: 3 };
          return (
            (order[a.size as keyof typeof order] || 999) -
            (order[b.size as keyof typeof order] || 999)
          );
        }),
      );
    } catch (error) {
      console.error("[v0] Error loading report data:", error);
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setExportLoading(true);

      // Prepare data for export
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Product Statistics
      const productData = stats.map((stat) => ({
        Produit: stat.product?.name || "N/A",
        SKU: stat.product?.sku || "N/A",
        Taille: stat.size,
        "Mouvements totaux": stat.movement_count,
        Vendu: stat.total_sold,
        Acheté: stat.total_purchased,
        "Dernier mouvement": stat.last_movement_at
          ? new Date(stat.last_movement_at).toLocaleDateString()
          : "N/A",
      }));

      const productSheet = XLSX.utils.json_to_sheet(productData);
      XLSX.utils.book_append_sheet(workbook, productSheet, "Produits");

      // Sheet 2: Category Summary
      const categoryData = categories.map((cat) => ({
        Catégorie: cat.name,
        "Nombre de produits": cat.products,
        "Total vendu": cat.totalSold,
        "Total acheté": cat.totalPurchased,
      }));

      const categorySheet = XLSX.utils.json_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(workbook, categorySheet, "Catégories");

      // Sheet 3: Size Distribution
      const sizeData = sizeDistribution.map((dist) => ({
        Taille: dist.size,
        Mouvements: dist.count,
        Pourcentage: `${dist.percentage}%`,
      }));

      const sizeSheet = XLSX.utils.json_to_sheet(sizeData);
      XLSX.utils.book_append_sheet(workbook, sizeSheet, "Distribution tailles");

      // Download
      XLSX.writeFile(
        workbook,
        `rapport-vetements-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast.success("Rapport téléchargé");
    } catch (error) {
      console.error("[v0] Error exporting report:", error);
      toast.error("Erreur lors de l'export du rapport");
    } finally {
      setExportLoading(false);
    }
  };

  const topProducts = stats.slice(0, 10);
  const slowMovingProducts = stats
    .filter((s) => s.movement_count < 5)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rapports</h1>
          <p className="text-slate-500 mt-1">
            Analyse complète de votre stock de vêtements
          </p>
        </div>
        <Button
          onClick={exportToExcel}
          disabled={exportLoading}
          className="gap-2"
        >
          {exportLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Exporter Excel
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total mouvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.reduce((sum, s) => sum + s.movement_count, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total vendu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {stats.reduce((sum, s) => sum + s.total_sold, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Ajouter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {stats.reduce((sum, s) => sum + s.total_purchased, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(stats.map((s) => s.product_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 produits par ventes</CardTitle>
            <CardDescription>Produits les plus vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="product.name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_sold" fill="#ef4444" name="Vendu" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution par taille</CardTitle>
            <CardDescription>Mouvements par taille</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sizeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ size, percentage }) => `${size} (${percentage}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {sizeDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} mouvements`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance par catégorie</CardTitle>
            <CardDescription>Ventes et achats par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalSold" fill="#ef4444" name="Vendu" />
                <Bar dataKey="totalPurchased" fill="#10b981" name="Acheté" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Slow Moving Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Produits lents
            </CardTitle>
            <CardDescription>Moins de 5 mouvements</CardDescription>
          </CardHeader>
          <CardContent>
            {slowMovingProducts.length > 0 ? (
              <div className="space-y-3">
                {slowMovingProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {product.product?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Taille {product.size}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {product.movement_count} mouvements
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                Aucun produit lent
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Détail complet des produits</CardTitle>
          <CardDescription>Statistiques de tous les produits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead className="text-right">Mouvements</TableHead>
                  <TableHead className="text-right">Vendu</TableHead>
                  <TableHead className="text-right">Acheté</TableHead>
                  <TableHead>Dernier mouvement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell className="font-medium">
                      {stat.product?.name || "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {stat.product?.sku}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{stat.size}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.movement_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-500 font-semibold">
                        {stat.total_sold}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-500 font-semibold">
                        {stat.total_purchased}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {stat.last_movement_at
                        ? new Date(stat.last_movement_at).toLocaleDateString()
                        : "Jamais"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
