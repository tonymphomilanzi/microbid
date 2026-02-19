export default function PageContainer({ children, className = "" }) {
  return (
    <main className={`mx-auto w-full pb-24 sm:pb-0 max-w-6xl px-4 ${className}`}>
      {children}
    </main>
  );
}