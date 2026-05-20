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

interface MagasinUser {
  magasin_id: number;
  shop_name: string;
  manager: {
    id: number;
    full_name: string;
    email: string;
    is_confirmed: boolean;
    role: string;
  };
  employers: Array<{
    id: number;
    full_name: string;
    email: string;
    is_confirmed: boolean;
    position: string;
    role: string;
  }>;
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}

function AdminUsersContent() {
  const { data: magasins, error, isLoading, mutate } = useSWR<MagasinUser[]>(
    '/magasins/users/',
    fetcher
  );
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const handleApprove = async (userId: number) => {
    setApprovingId(userId);
    try {
      await getApiClient().put(`/approve/${userId}/`);
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
        <AlertDescription>Erreur lors du chargement des utilisateurs</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
        <p className="text-gray-600">
          Total magasins: {magasins?.length || 0}
        </p>
      </div>

      {magasins && magasins.map((magasin) => (
        <Card key={magasin.magasin_id}>
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-xl text-blue-900">
              {magasin.shop_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Manager */}
            <div className="mb-6 pb-6 border-b">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Gérant</h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{magasin.manager.full_name}</p>
                  <p className="text-sm text-gray-600">{magasin.manager.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {magasin.manager.is_confirmed ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Approuvé
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-orange-600">
                        <XCircle className="w-4 h-4" />
                        En attente
                      </span>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(magasin.manager.id)}
                        disabled={approvingId === magasin.manager.id}
                      >
                        Approuver
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Employers */}
            {magasin.employers.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-3">
                  Employés ({magasin.employers.length})
                </h3>
                <div className="space-y-2">
                  {magasin.employers.map((employer) => (
                    <div
                      key={employer.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{employer.full_name}</p>
                        <p className="text-sm text-gray-600">{employer.email}</p>
                        <p className="text-xs text-gray-500">{employer.position}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {employer.is_confirmed ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Approuvé
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-orange-600">
                              <XCircle className="w-4 h-4" />
                              En attente
                            </span>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(employer.id)}
                              disabled={approvingId === employer.id}
                            >
                              Approuver
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {magasin.employers.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                Aucun employé pour ce magasin
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
