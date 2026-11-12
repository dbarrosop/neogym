import { Check, Copy, Plug } from "lucide-react";
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
      className="grid gap-x-8 gap-y-3 rounded-xl border bg-card p-5 md:grid-cols-2 md:p-6"
    >
      <div className="space-y-1">
        <h2 id="mcp-heading" className="flex items-center gap-2 text-[15px] font-semibold">
          <Plug className="size-4 text-link" />
          Agent access (MCP)
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
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
        <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-lg border bg-surface-inset px-3 font-mono text-[12.5px]">
          {MCP_URL}
        </code>
        <Button type="button" variant="outline" onClick={copyMcpUrl} aria-label="Copy MCP URL">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </section>
  );
}
