'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validLink, setValidLink] = useState(false);

  // Gérer le code PKCE dans l'URL (Supabase v2)
  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get('code');
      const hash = window.location.hash;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError('Lien de réinitialisation invalide ou expiré. Veuillez demander un nouveau lien.');
          setVerifying(false);
          return;
        }
        setValidLink(true);
        setVerifying(false);
        return;
      }

      if (hash.includes('access_token')) {
        setValidLink(true);
        setVerifying(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidLink(true);
        setVerifying(false);
        return;
      }

      setError('Lien de réinitialisation invalide ou expiré. Veuillez demander un nouveau lien.');
      setVerifying(false);
    };

    exchangeCode();
  }, [searchParams, supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      toast.success('Mot de passe réinitialisé avec succès !');
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation');
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 pb-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <CardTitle className="text-xl font-bold">Vérification du lien…</CardTitle>
          <CardDescription>
            Veuillez patienter pendant que nous vérifions votre lien de réinitialisation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error && !validLink) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 pb-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Lien invalide</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => router.push('/login')}>
            Retour à la connexion
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 pb-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Mot de passe réinitialisé !</CardTitle>
          <CardDescription>
            Votre mot de passe a été changé avec succès. Vous allez être redirigé vers la page de connexion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push('/login')}>
            Aller à la connexion
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold">Nouveau mot de passe</CardTitle>
        <CardDescription>
          Choisissez un nouveau mot de passe pour votre compte
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-medium">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="new-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="pl-10 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="confirm-password"
                type={showConfirmPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showConfirmPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Réinitialisation…
              </>
            ) : (
              'Réinitialiser le mot de passe'
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Retour à la{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            page de connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
