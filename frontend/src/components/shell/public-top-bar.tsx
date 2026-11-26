import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";

/**
 * Brand bar for public pages (landing, authorize, email-change callback). The
 * account buttons only show to signed-out visitors; sign in and sign up show
 * the brand panel instead of this bar.
 */
export function PublicTopBar() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-sidebar-border border-b bg-sidebar">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md text-[15px] font-semibold text-sidebar-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark />
          <span>NeoGym</span>
        </Link>
        {isLoading || isAuthenticated ? null : (
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Create account</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
