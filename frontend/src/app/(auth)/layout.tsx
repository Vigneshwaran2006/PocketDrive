import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ConfirmDialog />
      {children}
    </>
  );
}