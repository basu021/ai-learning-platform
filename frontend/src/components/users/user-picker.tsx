"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { usersApi, type UserSummary } from "@/lib/api";
import { Input } from "@/components/ui/input";

/** Pick users by username with autocomplete. */
export function UserPicker({
  value,
  onChange,
  placeholder = "Type a username…",
  single,
}: {
  value: UserSummary[];
  onChange: (users: UserSummary[]) => void;
  placeholder?: string;
  single?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.replace(/^@/, "").length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      usersApi.search(term).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const add = (u: UserSummary) => {
    if (!value.some((v) => v.id === u.id)) onChange(single ? [u] : [...value, u]);
    setQ("");
    setResults([]);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 py-0.5 pl-2.5 pr-1 text-xs text-indigo-200">
              {u.name} <span className="text-indigo-400/70">@{u.username}</span>
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== u.id))} className="rounded-full p-0.5 hover:bg-indigo-500/20" aria-label={`Remove ${u.username}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {(!single || value.length === 0) && (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {results.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => add(u)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-800">
                    <span className="text-gray-200">{u.name}</span>
                    <span className="text-xs text-gray-500">@{u.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
