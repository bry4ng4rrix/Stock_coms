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
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Employee {
  id: number;
  full_name: string;
  email: string;
  position: string;
  is_confirmed: boolean;
  sales_count?: number;
  total_sales?: number;
}

export default function MagasinEmployeesPage() {
  return (
    <ProtectedRoute requiredRoles={['magasin']}>
      <MagasinEmployeesContent />
    </ProtectedRoute>
  );
}

function MagasinEmployeesContent() {
  const { data: employees, error, isLoading, mutate } = useSWR<Employee[]>(
    '/employees/',
    fetcher
  );
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const handleApprove = async (employeeId: number) => {
    setApprovingId(employeeId);
    try {
      await getApiClient().put(`/approve/${employeeId}/`);
      mutate();
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      alert('Erreur lors de l\'approbation');
    } finally {
      setApprovingId(null);
    }
  };

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
        <AlertDescription>Erreur lors du chargement des employés</AlertDescription>
      </Alert>
    );
  }

  const confirmedEmployees = employees?.filter((e) => e.is_confirmed) || [];
  const pendingEmployees = employees?.filter((e) => !e.is_confirmed) || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion des employés</h1>
        <p className="text-gray-600">
          Confirmés: {confirmedEmployees.length} | En attente: {pendingEmployees.length}
        </p>
      </div>

      {/* Pending Approvals */}
      {pendingEmployees.length > 0 && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            {pendingEmployees.length} employé(s) en attente d&apos;approbation
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Employees */}
      {pendingEmployees.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900">
              En attente d&apos;approbation ({pendingEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
              >
                <div>
                  <p className="font-medium">{employee.full_name}</p>
                  <p className="text-sm text-gray-600">{employee.email}</p>
                  <p className="text-xs text-gray-500">{employee.position}</p>
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(employee.id)}
                  disabled={approvingId === employee.id}
                >
                  Approuver
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Confirmed Employees */}
      {confirmedEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Employés confirmés ({confirmedEmployees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Nom</th>
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Poste</th>
                    <th className="text-right py-3 px-4 font-semibold">Ventes</th>
                    <th className="text-right py-3 px-4 font-semibold">Total</th>
                    <th className="text-center py-3 px-4 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{employee.full_name}</td>
                      <td className="py-3 px-4 text-gray-600">{employee.email}</td>
                      <td className="py-3 px-4">{employee.position}</td>
                      <td className="py-3 px-4 text-right">
                        {employee.sales_count || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">
                        {(employee.total_sales || 0).toFixed(2)} €
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Actif
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {employees && employees.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Aucun employé trouvé
          </CardContent>
        </Card>
      )}
    </div>
  );
}
