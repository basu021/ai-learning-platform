"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  SquareCode,
  Table as TableIcon,
  Link as LinkIcon,
  ImagePlus,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo2,
  Redo2,
  Rows3,
  Columns3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const lowlight = createLowlight(common);

const LANGUAGES = [
  "plaintext", "bash", "shell", "sql", "yaml", "json", "python", "javascript",
  "typescript", "go", "java", "php", "ruby", "xml", "ini", "dockerfile", "nginx", "diff",
];

function extensions(placeholder?: string) {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "bash" }),
    Image.configure({ inline: false }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight,
    Placeholder.configure({ placeholder: placeholder ?? "Write here…" }),
  ];
}

function ToolButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700/60 hover:text-gray-100 disabled:opacity-30",
        active && "bg-indigo-500/20 text-indigo-300",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-gray-700" />;

function Toolbar({
  editor,
  onPickImage,
  uploading,
}: {
  editor: Editor;
  onPickImage?: () => void;
  uploading: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    editor.on("transaction", rerender);
    return () => {
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");
  const inCode = editor.isActive("codeBlock");

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-800 bg-gray-900/95 px-2 py-1.5 backdrop-blur">
      <ToolButton title="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
      <ToolButton title="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
      <ToolButton title="Underline" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolButton>
      <ToolButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolButton>
      <ToolButton title="Highlight" active={editor.isActive("highlight")} onClick={() => c().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></ToolButton>
      <ToolButton title="Inline code" active={editor.isActive("code")} onClick={() => c().toggleCode().run()}><Code className="h-4 w-4" /></ToolButton>
      <Sep />
      <ToolButton title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolButton>
      <ToolButton title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolButton>
      <ToolButton title="Small heading" active={editor.isActive("heading", { level: 4 })} onClick={() => c().toggleHeading({ level: 4 }).run()}><Heading4 className="h-4 w-4" /></ToolButton>
      <Sep />
      <ToolButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
      <ToolButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
      <ToolButton title="Checklist" active={editor.isActive("taskList")} onClick={() => c().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></ToolButton>
      <ToolButton title="Quote / callout" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
      <ToolButton title="Code block" active={inCode} onClick={() => c().toggleCodeBlock().run()}><SquareCode className="h-4 w-4" /></ToolButton>
      {inCode && (
        <select
          className="ml-1 h-7 rounded border border-gray-700 bg-gray-800 px-1 text-xs text-gray-200"
          value={(editor.getAttributes("codeBlock").language as string) || "plaintext"}
          onChange={(e) => c().updateAttributes("codeBlock", { language: e.target.value }).run()}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}
      <ToolButton title="Divider" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolButton>
      <Sep />
      <ToolButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></ToolButton>
      <ToolButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></ToolButton>
      <ToolButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></ToolButton>
      <Sep />
      <ToolButton title="Link" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="h-4 w-4" /></ToolButton>
      {onPickImage && (
        <ToolButton title={uploading ? "Uploading…" : "Insert image"} disabled={uploading} onClick={onPickImage}>
          <ImagePlus className={cn("h-4 w-4", uploading && "animate-pulse")} />
        </ToolButton>
      )}
      <ToolButton title="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></ToolButton>
      {inTable && (
        <>
          <ToolButton title="Add row" onClick={() => c().addRowAfter().run()}><Rows3 className="h-4 w-4" /></ToolButton>
          <ToolButton title="Add column" onClick={() => c().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></ToolButton>
          <ToolButton title="Delete row" onClick={() => c().deleteRow().run()}><Rows3 className="h-4 w-4 text-red-400" /></ToolButton>
          <ToolButton title="Delete column" onClick={() => c().deleteColumn().run()}><Columns3 className="h-4 w-4 text-red-400" /></ToolButton>
          <ToolButton title="Delete table" onClick={() => c().deleteTable().run()}><Trash2 className="h-4 w-4 text-red-400" /></ToolButton>
        </>
      )}
      <span className="ml-auto" />
      <ToolButton title="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
      <ToolButton title="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
    </div>
  );
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  onUploadImage,
  minHeight = 280,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Upload an image and resolve with the URL to embed. */
  onUploadImage?: (file: File) => Promise<string>;
  minHeight?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;

  const insertFiles = async (editor: Editor, files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length || !uploadRef.current) return false;
    setUploading(true);
    setError("");
    try {
      for (const file of images) {
        const src = await uploadRef.current(file);
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
    return true;
  };

  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-content prose-editor focus:outline-none px-4 py-3" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.some((f) => f.type.startsWith("image/")) && editorRef.current) {
          void insertFiles(editorRef.current, files);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (files.some((f) => f.type.startsWith("image/")) && editorRef.current) {
          event.preventDefault();
          void insertFiles(editorRef.current, files);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });
  editorRef.current = editor;

  if (!editor) {
    return <div className="rounded-lg border border-gray-700 bg-gray-800/30" style={{ minHeight }} />;
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/30 focus-within:border-indigo-500/60">
      <Toolbar editor={editor} uploading={uploading} onPickImage={onUploadImage ? () => fileRef.current?.click() : undefined} />
      <div style={{ minHeight }} onClick={() => editor.chain().focus().run()} className="cursor-text">
        <EditorContent editor={editor} />
      </div>
      {error && <p className="border-t border-gray-800 px-4 py-2 text-xs text-red-400">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void insertFiles(editor, files);
        }}
      />
    </div>
  );
}

/** Read-only rendering with the same schema and code highlighting as the editor. */
export function RichView({ html, className }: { html: string | null | undefined; className?: string }) {
  const editor = useEditor({
    extensions: extensions(),
    content: html || "",
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "rich-content" } },
  });
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== (html || "")) {
      editor.commands.setContent(html || "", { emitUpdate: false });
    }
  }, [editor, html]);
  if (!html) return null;
  if (!editor) {
    // SSR / first paint: content is already sanitized by the API.
    return <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <EditorContent editor={editor} className={className} />;
}
