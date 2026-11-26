import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AUTH_INPUT_CLASS } from "@/components/auth-card";
import { Input } from "@/components/ui/input";

const classAttribute = /class="([^"]+)"/;

test("auth fields keep the shared 16 px mobile font after merging classes", () => {
  const html = renderToStaticMarkup(<Input className={AUTH_INPUT_CLASS} />);
  const classes = html.match(classAttribute)?.[1]?.split(" ") ?? [];
  expect(classes).toContain("text-base");
  expect(classes).not.toContain("text-[15px]");
  expect(classes).toContain("md:text-[15px]");
});
