"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { formatFileSize } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "My Files", href: "/folder/root", icon: "📁" },
  { label: "Favorites", href: "/favorites", icon: "⭐" },
  { label: "Print Queue", href: "/print-queue", icon: "🖨️" },
  { label: "Search", href: "/search", icon: "🔍" },
  { label: "Activity", href: "/activity", icon: "📋" },
  { label: "Trash", href: "/trash", icon: "🗑️" },
  { label: "Scan QR", href: "/qr-scanner", icon: "📷" },
];

const TOTAL_STORAGE = 5 * 1024 * 1024 * 1024;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const storageUsed = user?.storage_used || 0;
  const storagePercentage = Math.min(
    (storageUsed / TOTAL_STORAGE) * 100,
    100
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/folder/root") return pathname.startsWith("/folder");
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 bg-white rounded-lg shadow-md border border-gray-200"
        aria-label="Open menu"
      >
        <svg
          className="w-5 h-5 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-64 h-screen bg-white border-r border-gray-100 flex flex-col
          fixed left-0 top-0 z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + Close */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">📁</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">
                PocketDrive
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Document Vault</p>
            </div>
          </Link>

          {/* Close button — mobile only */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
                {isActive(item.href) && (
                  <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* Storage Usage */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Storage</span>
              <span className="text-xs text-gray-400">
                {formatFileSize(storageUsed)} / 5 GB
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  storagePercentage > 90
                    ? "bg-red-500"
                    : storagePercentage > 70
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {storagePercentage.toFixed(1)}% used
            </p>
          </div>
        </div>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.full_name || "User"}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}