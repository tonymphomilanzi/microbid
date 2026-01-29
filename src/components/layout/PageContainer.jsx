export default function PageContainer({ children, className = "" }) {
  return (
    <main className={`mx-auto w-full max-w-6xl px-4 ${className}`}>
      {children}
    </main>
  );
}