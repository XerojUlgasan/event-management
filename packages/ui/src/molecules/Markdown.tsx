import MarkdownPreview from "@uiw/react-markdown-preview";
import rehypeSanitize from "rehype-sanitize";
import type { ComponentProps } from "react";

const normalizeMessageBreaks: NonNullable<
  ComponentProps<typeof MarkdownPreview>["rehypeRewrite"]
> = (node, index, parent) => {
  if (node.type !== "text" || index === undefined) return;
  const previous = parent?.children[index - 1];
  if (
    previous?.type === "element" &&
    previous.tagName === "br" &&
    node.value.startsWith("\n")
  ) {
    // pre-wrap already preserves newlines; the serializer's LF after <br>
    // must not add a second visible line break.
    node.value = node.value.slice(1);
  }
};

// Opening a conversation must not fetch images supplied by another sender.
const messageComponents = {
  img: ({ alt }: { alt?: string }) => <span>{alt || "Image"}</span>,
};

export function Markdown({
  source,
  variant = "document",
}: {
  source: string;
  variant?: "document" | "message";
}) {
  return (
    <MarkdownPreview
      source={source}
      className={`ui-markdown${variant === "message" ? " ui-markdown-message" : ""}`}
      rehypePlugins={[rehypeSanitize]}
      rehypeRewrite={variant === "message" ? normalizeMessageBreaks : undefined}
      components={variant === "message" ? messageComponents : undefined}
      wrapperElement={{ "data-color-mode": "light" }}
      disableCopy
    />
  );
}
