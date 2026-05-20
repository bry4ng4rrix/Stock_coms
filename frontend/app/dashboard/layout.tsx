import { AuthProvider } from '@/lib/auth-context';
import { DashboardNav } from '@/components/dashboard-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        <main>{children}</main>
      </div>
    </AuthProvider>
  );
}
