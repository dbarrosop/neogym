import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";

/** Minimal chrome for signed-out pages; sign in and sign up show the brand panel instead. */
export function PublicTopBar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-glass backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Home" className="flex items-center gap-2 font-semibold">
          <BrandMark />
          <span>NeoGym</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
