import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  return (
    <div
      className={
        "prose prose-sm dark:prose-invert max-w-none " +
        "prose-p:leading-relaxed prose-p:my-1 " +
        "prose-headings:mt-3 prose-headings:mb-1 " +
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 " +
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-lg " +
        "prose-code:text-primary prose-code:before:content-none prose-code:after:content-none " +
        "prose-a:text-primary prose-a:underline " +
        "prose-strong:text-inherit " +
        "prose-blockquote:border-primary/30 " +
        "text-sm md:text-[15px] break-words"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
