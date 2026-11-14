import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const MCP_URL = import.meta.env.VITE_MCP_URL ?? "http://localhost:3000";

/** Agent access: the MCP endpoint users point Claude, Cursor or other MCP clients at. */
export function McpConnectCard() {
  const [copied, setCopied] = useState(false);

  async function copyMcpUrl() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy the URL manually");
    }
  }

  return (
    <section
      aria-labelledby="mcp-heading"
      className="grid gap-x-8 gap-y-3 rounded-xl border bg-card px-5 py-5 md:grid-cols-2 md:px-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="mcp-heading" className="text-[15px] font-semibold">
          Agent access (MCP)
        </h2>
        <p className="text-[13px] leading-normal text-muted-foreground">
          Point Claude, Cursor or any{" "}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            MCP
          </a>{" "}
          client at this URL to log workouts and query your data.
        </p>
      </div>
      <div className="flex min-w-0 items-center gap-2 self-start">
        <code className="flex h-10 min-w-0 flex-1 items-center rounded-[9px] border border-muted bg-surface-inset px-3 font-mono text-[12.5px] font-medium text-foreground/90">
          <span className="min-w-0 truncate">{MCP_URL}</span>
        </code>
        <Button type="button" variant="outline" onClick={copyMcpUrl}>
          {copied ? "Copied" : "Copy"}
          <span className="sr-only"> MCP URL</span>
        </Button>
        <span role="status" className="sr-only">
          {copied ? "MCP URL copied" : ""}
        </span>
      </div>
    </section>
  );
}
