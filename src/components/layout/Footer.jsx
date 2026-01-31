import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span>Microbid</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A marketplace for buying and selling social pages, channels, and digital assets with an escrow-first workflow.
            </p>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Company</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground transition" to="/about">
                  About
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/sellers">
                  Sellers
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/contact">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Escrow */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Escrow</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground transition" to="/escrow-service">
                  Escrow Service
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/fees">
                  Fees & Pricing
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/safety">
                  Safe Deal Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Legal</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground transition" to="/privacy-policy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/cookies-policy">
                  Cookies Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground transition" to="/terms">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {year} Microbid. All rights reserved.
          </p>

          <p className="text-sm text-muted-foreground">
            Built by <span className="text-foreground">Sendoofy</span>
          </p>
        </div>
      </div>
    </footer>
  );
}