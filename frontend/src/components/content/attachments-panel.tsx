"use client";

import { useRef, useState } from "react";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { downloadFile, subjectsApi, type AttachmentItem } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { formatBytes, timeAgo } from "@/lib/utils";

export function AttachmentsPanel({
  subjectId,
  nodeId,
  items,
  canManage,
  onChange,
}: {
  subjectId: string;
  nodeId: string | null;
  items: AttachmentItem[];
  canManage: boolean;
  onChange: () => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await subjectsApi.uploadAttachment(subjectId, f, { nodeId });
      }
      toast.success(files.length > 1 ? `${files.length} files uploaded` : "File uploaded");
      onChange();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: AttachmentItem) => {
    if (!confirm(`Delete ${a.filename}?`)) return;
    try {
      await subjectsApi.deleteAttachment(a.id);
      onChange();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items.length && !canManage) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <Paperclip className="h-4 w-4 text-gray-400" /> Attachments
          <span className="text-xs font-normal text-gray-500">{items.length}</span>
        </h4>
        {canManage && (
          <>
            <button
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:underline disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Add"}
            </button>
            <input ref={input} type="file" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          </>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-500">No files. Up to 25 MB each.</p>
      ) : (
        <ul className="divide-y divide-gray-800">
          {items.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 px-4 py-2 text-sm">
              <button
                onClick={() => downloadFile(`/api/attachments/${a.id}`, a.filename).catch(toast.error)}
                className="min-w-0 flex-1 text-left"
                title="Download"
              >
                <span className="block truncate text-gray-200 hover:text-indigo-300">{a.filename}</span>
                <span className="text-[11px] text-gray-500">
                  {formatBytes(a.sizeBytes)} · @{a.uploadedBy.username} · {timeAgo(a.createdAt)}
                </span>
              </button>
              <Download className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              {canManage && (
                <button onClick={() => remove(a)} className="rounded p-1 text-gray-500 opacity-0 hover:text-red-400 group-hover:opacity-100" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
