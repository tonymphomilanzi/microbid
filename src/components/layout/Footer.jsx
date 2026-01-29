export default function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Microbid. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built by Sendoofy
          </p>
        </div>
      </div>
    </footer>
  );
}