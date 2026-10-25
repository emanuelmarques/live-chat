export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="empty">
      {children}
    </p>
  );
}
