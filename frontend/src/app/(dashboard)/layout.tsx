import { AuthGuard } from "@/components/auth/AuthGuard";
import { ToastContainer } from "@/components/ui/Toast";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ToastContainer />
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-64 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}