import ResaleConsoleLayout from '@/components/ResaleConsoleLayout';

export default function ResaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResaleConsoleLayout>
      {children}
    </ResaleConsoleLayout>
  );
}
