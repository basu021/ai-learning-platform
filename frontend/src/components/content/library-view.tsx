"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Library, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Spinner, Tabs } from "@/components/ui/field";
import { SubjectCard } from "@/components/content/subject-card";
import { categoriesApi, subjectsApi, type Category, type SubjectFilters, type SubjectListItem, type Visibility } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Scope = NonNullable<SubjectFilters["scope"]>;

function FacetButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm",
        active ? "bg-indigo-500/15 text-indigo-200" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined && <span className="text-xs text-gray-500">{count}</span>}
    </button>
  );
}

function LibraryView({ adminAll = false }: { adminAll?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin } = useSession();
  const [scope, setScope] = useState<Scope>(adminAll ? "all" : ((params.get("scope") as Scope) || "library"));
  const [q, setQ] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(q);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [visibility, setVisibility] = useState<Visibility | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [items, setItems] = useState<SubjectListItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setItems(null);
    subjectsApi
      .list({ scope, q: query || undefined, categoryId, visibility, tag })
      .then(setItems)
      .catch(() => setItems([]));
  }, [scope, query, categoryId, visibility, tag]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items?.forEach((s) => s.tags?.split(",").forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [items]);

  const scopes: { value: Scope; label: string }[] = adminAll
    ? [{ value: "all", label: "All subjects" }]
    : [
        { value: "library", label: "Everything" },
        { value: "mine", label: "My subjects" },
        { value: "shared", label: "Shared with me" },
        { value: "catalog", label: "Catalog" },
      ];
  const filtersActive = !!(categoryId || visibility || tag || query);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Library className="h-6 w-6 text-indigo-400" />
            {adminAll ? "All content" : "Library"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {adminAll
              ? "Every subject on the platform, including users' private subjects."
              : "Subjects you own, subjects shared with you, and the catalog."}
          </p>
        </div>
        <Button onClick={() => router.push("/subjects/new")}>
          <Plus className="mr-1 h-4 w-4" /> New subject
        </Button>
      </div>

      {!adminAll && <Tabs tabs={scopes} value={scope} onChange={setScope} />}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, summary, tags" className="pl-9" />
          </div>
          {(isAdmin || scope === "catalog" || scope === "library" || adminAll) && (
            <div>
              <h6 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Visibility</h6>
              <FacetButton active={!visibility} onClick={() => setVisibility(undefined)}>Any</FacetButton>
              {(["PUBLIC", "LISTED", "PRIVATE"] as Visibility[]).map((v) => (
                <FacetButton key={v} active={visibility === v} onClick={() => setVisibility(v)}>
                  {v[0] + v.slice(1).toLowerCase()}
                </FacetButton>
              ))}
            </div>
          )}
          {categories.length > 0 && (
            <div>
              <h6 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Category</h6>
              <FacetButton active={!categoryId} onClick={() => setCategoryId(undefined)}>All</FacetButton>
              {categories.map((c) => (
                <FacetButton key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                </FacetButton>
              ))}
            </div>
          )}
          {tagCounts.length > 0 && (
            <div>
              <h6 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Tags</h6>
              <div className="flex flex-wrap gap-1 px-1">
                {tagCounts.map(([t, n]) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? undefined : t)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px]",
                      tag === t ? "bg-indigo-500/25 text-indigo-200" : "bg-gray-800 text-gray-400 hover:text-gray-200",
                    )}
                  >
                    #{t} <span className="text-gray-500">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {filtersActive && (
            <button
              onClick={() => { setQ(""); setCategoryId(undefined); setVisibility(undefined); setTag(undefined); }}
              className="flex items-center gap-1 px-2 text-xs text-gray-400 hover:text-gray-200"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </aside>

        <section>
          {items === null ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState icon={Library} title={filtersActive ? "Nothing matches" : "No subjects here yet"}>
              {scope === "mine" || scope === "library" ? (
                <Link href="/subjects/new" className="text-indigo-400 hover:underline">Create your first subject</Link>
              ) : scope === "shared" ? (
                "When someone shares a subject with your username, it shows up here."
              ) : null}
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <SubjectCard key={s.id} s={s} onTag={setTag} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function LibraryPage({ adminAll }: { adminAll?: boolean }) {
  return (
    <Suspense fallback={<Spinner />}>
      <LibraryView adminAll={adminAll} />
    </Suspense>
  );
}
