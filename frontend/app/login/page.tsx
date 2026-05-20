'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authAPI } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      const { access, refresh } = response.data;
      
      // Store tokens
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Identifiants invalides. Veuillez réessayer.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold">Dashboard</CardTitle>
          <p className="text-sm text-gray-600">Gestion de stock multi-rôles</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Connexion en cours...
                </div>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
            <p className="font-semibold mb-2">Comptes de démonstration :</p>
            <ul className="space-y-1 text-xs">
              <li>• Admin: admin@example.com</li>
              <li>• Magasin: magasin@example.com</li>
              <li>• Employer: employer@example.com</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
