'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

export function DashboardNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      magasin: 'Gérant Magasin',
      employer: 'Employé',
    };
    return labels[role] || role;
  };

  const getNavLinks = () => {
    if (!user) return [];

    const baseLinks = [
      { href: '/dashboard', label: 'Accueil', icon: BarChart3 },
    ];

    if (user.role === 'admin') {
      return [
        ...baseLinks,
        { href: '/dashboard/admin/analytics', label: 'Analyses', icon: BarChart3 },
        { href: '/dashboard/admin/products', label: 'Produits', icon: Package },
        { href: '/dashboard/admin/sales', label: 'Ventes', icon: ShoppingCart },
        { href: '/dashboard/admin/users', label: 'Utilisateurs', icon: Users },
        { href: '/dashboard/admin/stores', label: 'Magasins', icon: Settings },
      ];
    }

    if (user.role === 'magasin') {
      return [
        ...baseLinks,
        { href: '/dashboard/magasin/analytics', label: 'Analyses', icon: BarChart3 },
        { href: '/dashboard/magasin/products', label: 'Produits', icon: Package },
        { href: '/dashboard/magasin/sales', label: 'Ventes', icon: ShoppingCart },
        { href: '/dashboard/magasin/employees', label: 'Employés', icon: Users },
      ];
    }

    if (user.role === 'employer') {
      return [
        ...baseLinks,
        { href: '/dashboard/employer/sales', label: 'Mes ventes', icon: ShoppingCart },
        { href: '/dashboard/employer/products', label: 'Produits', icon: Package },
      ];
    }

    return baseLinks;
  };

  const navLinks = getNavLinks();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="font-bold text-lg text-gray-900">Stock Manager</h1>
            <p className="text-xs text-gray-500">{user && getRoleLabel(user.role)}</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-700 hover:text-blue-600"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Mobile Menu + User Menu */}
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-700">
                {user?.full_name || user?.username}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled className="text-xs text-gray-600">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 p-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
