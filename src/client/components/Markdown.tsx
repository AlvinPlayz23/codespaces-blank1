import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";
import { useEffect, useMemo, useRef } from "react";

marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  return DOMPurify.sanitize(html);
}

export function Markdown({ source, streaming = false }: { source: string; streaming?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);

  useEffect(() => {
    if (streaming) return;
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
      if (code.dataset.enhanced === "true") return;
      code.dataset.enhanced = "true";
      try {
        hljs.highlightElement(code);
      } catch {
        // Unknown language: leave the block unstyled.
      }
      const pre = code.parentElement;
      if (!pre) return;
      const language = code.className.match(/language-([\w+-]+)/)?.[1] ?? "text";
      const header = document.createElement("div");
      header.className = "code-header";
      const label = document.createElement("span");
      label.textContent = language;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy";
      button.addEventListener("click", () => {
        void navigator.clipboard.writeText(code.innerText).then(() => {
          button.textContent = "Copied";
          window.setTimeout(() => {
            button.textContent = "Copy";
          }, 1200);
        });
      });
      header.append(label, button);
      pre.prepend(header);
    });
  }, [html, streaming]);

  return (
    <div
      ref={ref}
      className={streaming ? "markdown streaming" : "markdown"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
