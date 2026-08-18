"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Table as TableIcon,
  Eye,
  Pencil,
  Unlink,
} from "lucide-react";
import { looksLikeMarkdown, markdownToHtml } from "@/lib/markdown-to-html";
import { blogContentToHtml, renderBlogContent } from "@/lib/blog-html";
import { isRichHtml } from "@/lib/sanitize-html";

interface BlogRichTextEditorProps {
  value: string;
  contentFormat?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`p-2 rounded-md transition-colors ${
        active ? "bg-gold-500/25 text-navy-800" : "hover:bg-gray-200 dark:hover:bg-navy-700"
      }`}
    >
      {children}
    </button>
  );
}

function normalizeEditorContent(value: string, contentFormat?: string): string {
  if (!value?.trim()) return "";
  if (contentFormat === "markdown" || (!isRichHtml(value) && looksLikeMarkdown(value))) {
    return blogContentToHtml(value, contentFormat);
  }
  return value;
}

function insertPlainTextWithBreaks(editor: Editor, text: string) {
  const blocks = text.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const inner = trimmed.replace(/\n/g, "<br>");
      return `<p>${inner}</p>`;
    })
    .filter(Boolean)
    .join("");
  editor.commands.insertContent(html || `<p>${text.replace(/\n/g, "<br>")}</p>`);
}

export function BlogRichTextEditor({
  value,
  contentFormat = "html",
  onChange,
  placeholder = "Write your article...",
}: BlogRichTextEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        validate: (href) =>
          /^(https?:\/\/|mailto:|\/|#)/i.test(href.trim()),
        HTMLAttributes: { class: "text-gold-600 underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-2" },
        allowBase64: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: normalizeEditorContent(value, contentFormat),
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: "tiptap-editor blog-tiptap-editor min-h-[280px] px-4 py-3 text-sm focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        const clipboard = event.clipboardData;
        if (!ed || !clipboard) return false;

        const html = clipboard.getData("text/html");
        const text = clipboard.getData("text/plain");

        if (html && /<(table|h[1-6]|ul|ol|blockquote|img|thead|tbody|tr|th|td)\b/i.test(html)) {
          return false;
        }

        if (text && looksLikeMarkdown(text)) {
          event.preventDefault();
          ed.commands.insertContent(markdownToHtml(text));
          return true;
        }

        if (text && !html && text.includes("\n")) {
          event.preventDefault();
          insertPlainTextWithBreaks(ed, text);
          return true;
        }

        return false;
      },
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    const normalized = normalizeEditorContent(value, contentFormat);
    const current = editor.getHTML();
    if (normalized !== current && normalized !== "<p></p>") {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [editor, value, contentFormat]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const previewHtml = renderBlogContent(editor.getHTML(), "html");

  return (
    <div className="border border-gray-200 dark:border-border rounded-lg overflow-hidden bg-white dark:bg-card">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-border bg-cream/60 dark:bg-navy-900/50">
        <ToolbarButton
          label="Edit"
          active={mode === "edit"}
          onClick={() => setMode("edit")}
        >
          <Pencil className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Preview"
          active={mode === "preview"}
          onClick={() => setMode("preview")}
        >
          <Eye className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-gray-300 dark:bg-border mx-1" />
        {mode === "edit" && (
          <>
            <ToolbarButton
              label="Bold"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-4 h-4" />
            </ToolbarButton>
            <div className="w-px h-6 bg-gray-300 dark:bg-border mx-1" />
            <ToolbarButton
              label="Paragraph"
              active={editor.isActive("paragraph")}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <Pilcrow className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <span className="text-xs font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              label="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <span className="text-xs font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              label="Heading 3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <span className="text-xs font-bold">H3</span>
            </ToolbarButton>
            <ToolbarButton
              label="Blockquote"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Bullet list"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="w-4 h-4" />
            </ToolbarButton>
            <div className="w-px h-6 bg-gray-300 dark:bg-border mx-1" />
            <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={setLink}>
              <LinkIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Remove link"
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Insert table"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              <TableIcon className="w-4 h-4" />
            </ToolbarButton>
          </>
        )}
      </div>

      {mode === "edit" ? (
        <EditorContent editor={editor} />
      ) : (
        <div
          className="property-description min-h-[280px] px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{ __html: previewHtml || "<p class='text-gray-400'>Nothing to preview yet.</p>" }}
        />
      )}
    </div>
  );
}
