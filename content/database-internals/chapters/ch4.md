@chapter 4. Implementing B-Trees
@summary The practical details that turn the textbook B-Tree into a real index: headers, links, overflow pages, optimizations and maintenance.

## Why this chapter matters

Chapters 2 and 3 gave you the B-Tree algorithm and the page format. Real engines add many details on top, and those details are what you deal with as a DBA:

- **large values** (`TEXT`, `BLOB`, `JSON`) that don't fit in a page
- **auto-increment keys** and the hot rightmost page
- **bulk loads** and index builds
- **compression**
- **fragmentation**, bloat and the maintenance jobs that fix them

## What you will learn

| Topic | The question it answers |
|---|---|
| Page header and links | What does each page store about itself and its neighbours? |
| Overflow pages | Where do values that don't fit in a page go? |
| Searching inside a page | How does binary search work over a slot array? |
| Walking back up the tree | How does a split find its way up to the parents? |
| Optimizations | Rebalancing, right-only appends, bulk loading, compression |
| Vacuum and maintenance | Why pages fragment, and how space is reclaimed |

@topic Page header and links
@summary What a B-Tree page records about itself, and how it points to its neighbours.

Every page starts with a **header**: information used to navigate, maintain and optimize the tree. Pages also often link to their **siblings** and, in some designs, store a **high key**.

This topic covers the header and magic numbers, sibling links, and how the "extra" rightmost pointer is handled.

@subtopic Page header and magic numbers
@summary Flags, counts and free-space bounds, plus a constant that proves the page is valid.

## What the header holds

Typical page header fields:

| Field | Used for |
|---|---|
| Page type / flags | Leaf or internal, fixed or variable-size cells, has overflow pages… |
| Number of cells | Binary search bounds, deciding when to split |
| **Lower / upper** free-space offsets | Where the next slot and the next cell go |
| Level in the tree | Knowing how far from the leaves you are |
| Sibling and rightmost pointers | Navigation |
| LSN (log sequence number) | Recovery: which log record last changed the page (Chapter 5) |
| Checksum | Detecting corruption (Chapter 3) |

Each engine has its own set:

| Engine | Some header contents |
|---|---|
| PostgreSQL | Page LSN, checksum, flags, `pd_lower`, `pd_upper`, page size and **layout version** |
| MySQL InnoDB | Number of heap records, **page level**, index id, previous/next page; FIL header with checksum, page number, LSN |
| SQLite | Number of cells, first freeblock, **rightmost pointer** |

## Magic numbers

A **magic number** is a fixed constant written into a file or page header. On read, the engine checks it is there.

For example, write the 4 bytes `50 41 47 45` (ASCII **"PAGE"**) at the start of every page. When reading, compare the first 4 bytes. If they don't match, the engine read the **wrong offset**, a **misaligned** page, or **garbage**. A random byte sequence is very unlikely to match by chance.

Magic numbers can also mark the **page kind** or **format version**.

> **Familiar example:** files themselves use magic numbers. PDF files start with `%PDF`, PNG files with `\x89PNG`, and the `file` command on Linux works by reading them.

@subtopic Sibling links
@summary Pointers to the left and right neighbours make scans faster, but make splits harder.

Without sibling links, finding the **next page on the same level** means going back up to the parent, and possibly further up, then down again.

![Finding a neighbour through the parent versus following a sibling link](img:c4-siblings)

With **sibling links** in the header:

- **forward link** → the next page, used for range scans
- **backward link** → the previous page, used for descending scans (`ORDER BY … DESC`)

## The cost

Links must be **kept correct during splits and merges**. When a page that is not the rightmost one splits, its old right neighbour's **backward** link must now point to the **new** page. That is a change to a *third* page, which needs extra locking.

| | Without sibling links | With sibling links |
|---|---|---|
| Range scan to next leaf | Up to parent (maybe root) and down again | One hop |
| Split / merge | Touches the node and its parent | Also touches the neighbour |

> **In practice:** InnoDB index pages have `FIL_PAGE_PREV` and `FIL_PAGE_NEXT`; PostgreSQL B-Tree pages store `btpo_prev` and `btpo_next`. Both use them for range scans in either direction.

@subtopic Rightmost pointers and high keys
@summary An internal node has one more pointer than keys; engines handle that extra pointer differently.

An internal node with **N** keys has **N + 1** child pointers. If cells are stored as **(key, pointer)** pairs, one pointer is left over: the **rightmost** one, for keys ≥ the last key.

## Option 1: store it separately

Keep the extra pointer in the **page header** (SQLite does this). When the rightmost child splits:

1. a new cell (promoted key → old child) is appended to the parent
2. the header's rightmost pointer is changed to point at the **new** child

## Option 2: high keys (B-link trees)

Instead, every node stores one extra key, the **high key**: the largest key allowed in this node's subtree. Now every pointer has a key, and cells can always be stored in pairs.

![A node with an implicit +∞ bound compared with a node that stores a high key](img:c4-highkey)

| | Rightmost pointer | High key |
|---|---|---|
| Upper bound of last subtree | Implicit +∞ | Stored explicitly |
| Cells | One pointer is unpaired | Every pointer has a key |
| Main benefit | Simple | Fewer edge cases; also helps **concurrency** (Chapter 5) |
| Used by | SQLite | **PostgreSQL** (Lehman & Yao B-link trees) |

> **In practice:** in PostgreSQL B-Tree pages, every page except the rightmost on its level stores the high key as its **first item**. `pageinspect`'s `bt_page_items()` shows it as item 1.

@topic Overflow pages
@summary Where values that don't fit into a page go.

Page size is **fixed**, but values are not. A few large values can fill a page long before the B-Tree considers the node "full".

Copying a page into a bigger region is impractical, so engines **chain extra pages**: **overflow pages**.

This topic explains the mechanism, then how real databases store large values.

@subtopic How overflow pages work
@summary Keep a fixed prefix in the page and spill the rest into linked overflow pages.

## The idea

- Each cell may store at most **`max_payload_size`** bytes in the primary page, roughly *page size ÷ fanout*. So a page always has room for its expected number of cells.
- Anything beyond that **spills** into an **overflow page**, linked from the primary page.
- If one overflow page is not enough, overflow pages link to the **next** one, forming a chain.

![A primary page whose large cells continue in an overflow page](img:c4-overflow)

## Keys vs values

- **Keys** usually differ early, so keeping a **prefix** in the primary page means most comparisons never touch the overflow page.
- **Values** must be fully read only when returned to the user. That is less frequent, so the extra reads are acceptable.

Overflow pages need **bookkeeping** too: they fragment, and they must be freed when no longer used.

> **Rule of thumb:** if most of your values are large, consider storing them **outside the tree** altogether (specialized blob storage), and keep only references in the index.

@subtopic Large values in real databases
@summary TOAST, InnoDB off-page columns, Oracle LOBs and row chaining.

Each major database implements the overflow idea in its own way:

| Database | Mechanism | When it kicks in |
|---|---|---|
| **PostgreSQL** | **TOAST**: large values are compressed and/or moved to a separate TOAST table, in ~2 KB chunks | A row exceeds ~2 KB (`TOAST_TUPLE_THRESHOLD`) |
| **MySQL InnoDB** | **Off-page columns**: `DYNAMIC`/`COMPRESSED` row formats keep a 20-byte pointer in the row and store the value in overflow pages; `COMPACT` keeps a 768-byte prefix in the row | The row doesn't fit in about half a page |
| **Oracle** | **LOB segments** for `CLOB`/`BLOB`; **row chaining** when a row is larger than a block; **row migration** when an updated row no longer fits its block | Row larger than the block, or grows on update |
| **SQL Server** | `ROW_OVERFLOW_DATA` and `LOB_DATA` allocation units | Row over 8,060 bytes, or MAX types |

## Why a DBA cares

- `SELECT *` on a table with large columns reads the **overflow pages too**. Select only the columns you need.
- Large values make **updates expensive**: changing one byte may rewrite a whole chain of overflow pages.
- Oracle row **migration** adds an extra read for every access; check `CHAINED_ROWS` (after `ANALYZE … LIST CHAINED ROWS`) or the `table fetch continued row` statistic.

```sql
-- PostgreSQL: how big is the TOAST part of a table?
SELECT pg_size_pretty(pg_relation_size('docs'))       AS main,
       pg_size_pretty(pg_total_relation_size('docs')
                      - pg_relation_size('docs')
                      - pg_indexes_size('docs'))      AS toast;
```

@topic Searching inside a page
@summary Binary search over the sorted slot array, and what it returns.

Inside a page, keys are found with **binary search**. It only works on **sorted** data, which is why keeping keys in order is so important.

Two pages: the binary search result itself, and how it works through the slot array of a slotted page.

@subtopic Binary search and insertion points
@summary Found: the position. Not found: where the key would go.

Binary search takes a **sorted array** and a **key** and returns a number:

| Result | Meaning |
|---|---|
| **Zero or positive** | The key was found at this position |
| **Negative** | The key is not there; the value encodes the **insertion point** |

The **insertion point** is the index of the **first element greater than the key**. Many libraries (Java's `Arrays.binarySearch`, for example) return `-(insertion_point) - 1` so that "not found at position 0" can be told apart from "found at position 0".

```plaintext
keys:   [ 10, 20, 30, 40 ]
search 30  → 2              (found at index 2)
search 25  → -(2) - 1 = -3  (not found; would go at index 2)
```

To insert, every element from the insertion point onwards **shifts one position right**.

## On internal pages

Most searches on **internal** pages are **not exact matches**: we just want to know **which child** to follow. So the search looks for the first separator greater than the key and follows the pointer to its left.

@subtopic Binary search through a slot array
@summary Jump to the middle slot, follow it to the cell, compare, repeat.

In a slotted page, cells are stored in **insertion order**; only the **slot array** is sorted. So binary search runs over the slots, with one extra step per probe:

1. Pick the **middle slot**.
2. **Follow its offset** to the cell and read the key.
3. Compare with the searched key and continue **left or right**.
4. Repeat until found, or until the insertion point is known.

![Binary search that follows slot offsets to compare keys](img:c4-binsearch)

The extra indirection costs a little (a jump to a different place in the page), but it is what allows cells to stay in place while the order changes.

> **Why it's fast anyway:** the whole page is already in memory (one read), and a page holds a few hundred keys. About 8–9 comparisons find any key, so the CPU cost is tiny compared with a disk read.

@topic Walking back up the tree
@summary How splits and merges find the parent nodes they must update.

Splits and merges can **propagate upward**: a leaf split adds a key to the parent, which may split too, and so on up to the root.

So during an insert or delete, the engine needs a way to get **from a leaf back to its ancestors**. There are two approaches: parent pointers and breadcrumbs.

@subtopic Parent pointers
@summary Each node remembers its parent, but those links must be kept up to date.

A node can store a **pointer to its parent**.

- Parents are always read before their children (the tree is walked from the root), so these pointers don't even have to be **saved on disk**: they can be set in memory when the child is loaded.
- But they must be **updated** whenever a child moves to another parent: during **parent splits, merges and rebalancing**.

## A use beyond splits

Some engines (WiredTiger, for example) use parent pointers to move **between leaves** instead of sibling links. Sibling links followed in both directions by different threads can **deadlock**; going up through the parent and back down avoids that.

To find the next leaf this way: go up to the parent, take the next child pointer and go down. If the parent has no more children, go up another level, and so on.

@subtopic Breadcrumbs
@summary Remember the path from root to leaf on a stack, and pop it to walk back up.

Instead of storing parent pointers, the engine can simply **remember the path** it took on the way down.

During an insert or delete, we don't know whether a split or merge will happen until we reach the leaf. So on every step down, the engine pushes a **breadcrumb**: the **page** visited and the **index of the child pointer** it followed. A **stack** is the natural structure.

![Breadcrumbs collected on a stack while descending to a leaf](img:c4-breadcrumbs)

## Using the breadcrumbs after a split

1. The leaf splits. **Pop** the top breadcrumb: that is the leaf's parent, and the index tells where to insert the new separator.
2. If the parent has room, insert the separator and **stop**.
3. If the parent is full, split it too and **pop again** for its parent.
4. Stop when a level absorbs the change, or when the stack is empty (the root itself split, so add a new root).

The stack lives **only in memory**, only for the duration of the operation.

> **In practice:** PostgreSQL's B-Tree code does exactly this. The stack is called `BTStack`, built by `_bt_search()` while descending.

@topic Optimizations
@summary Rebalancing, right-only appends, bulk loading and compression.

The basic split/merge algorithm works, but real engines add optimizations for **better page fill**, **faster inserts** and **smaller data**.

| Optimization | Helps with |
|---|---|
| Rebalancing | Fuller pages, fewer splits |
| Right-only appends | Ever-increasing keys (auto-increment, timestamps) |
| Bulk loading | Building an index from sorted data |
| Compression | Smaller data on disk and in memory |

@subtopic Rebalancing
@summary Move entries to a neighbour before splitting; B*-Trees split two pages into three.

Instead of splitting as soon as a node overflows, some engines **move entries to a neighbour** that has room, and only split when that is no longer possible. On delete, they can **borrow** from a neighbour instead of merging.

![Moving entries from a fuller node to an emptier neighbour, and updating the parent](img:c4-rebalance)

Moving entries changes the **boundary** between the two nodes, so the **separator key in the parent must be updated** too.

## B*-Trees

A **B*-Tree** keeps redistributing between neighbours until **both are full**. Then, instead of splitting one node into two half-full nodes, it splits **two full nodes into three** nodes, each **⅔ full**.

| | Classic split | B*-Tree split |
|---|---|---|
| Nodes after split | 2, each ~½ full | 3, each ~⅔ full |
| Average occupancy | Lower | Higher |
| Tree height | Taller | Shorter (fewer page reads) |
| Cost | Simple | More code and bookkeeping |

SQLite uses this idea in its *balance-siblings* algorithm.

@subtopic Right-only appends
@summary Ever-increasing keys always land in the rightmost leaf, and engines optimize for it.

Many tables use an **auto-increment** or **timestamp** key. Every new key is bigger than all others, so **every insert goes to the rightmost leaf**, and all splits happen on the right edge.

Engines take advantage of that:

| Engine | Optimization |
|---|---|
| **PostgreSQL** (fastpath) | Remembers the rightmost leaf. If the new key is greater than that page's first key and the page has room, it inserts **without searching from the root**. |
| **SQLite** (quickbalance) | When the rightmost leaf is full, it starts a **new, empty rightmost page** instead of splitting 50/50, expecting it to fill soon. |
| **InnoDB** | Detects sequential inserts and splits the page at the insert point instead of the middle, so the old page stays **almost full** (leaving ~1/16 free). |

![Typical page fill: sequential keys versus random keys](img:c4-fill)

## Random keys are expensive

With **random keys** (for example UUIDv4), inserts land all over the index: more page splits, pages that stay only ~70% full on average, and a bigger working set to cache.

> **DBA takeaway:**
> - Prefer **monotonic keys** for clustered indexes (`BIGINT AUTO_INCREMENT`, identity columns, or **UUIDv7**, which is time-ordered).
> - At very high insert rates, the hot rightmost page can become a **contention** point. Oracle offers **reverse key indexes** and hash-partitioned indexes for this ("right-hand index contention").

@subtopic Bulk loading
@summary Build the tree bottom-up from sorted data, with no splits at all.

When the data is **already sorted** (or can be sorted first), the tree can be built far more efficiently than by inserting rows one by one:

1. Write **full leaf pages**, one after another, in key order.
2. For each finished leaf, add its first key to the parent level, which is also filled left to right.
3. Build the higher levels the same way, until one root remains.

There are **no splits and no merges**, and only the pages currently being filled (one per level) need to be in memory.

| | Inserting rows one by one | Bulk loading |
|---|---|---|
| Splits | Many | None |
| Page fill | ~50–70% | Chosen (often 90–100%) |
| I/O pattern | Random | Sequential |
| Speed | Slow | Much faster |

**Immutable** B-Trees (never modified after building) can fill pages **100%**, since no room is needed for later changes.

> **In practice:** `CREATE INDEX` sorts the data and builds bottom-up in every major database. So for big loads: **drop or delay secondary indexes, load the data, then create the indexes.**
> - PostgreSQL: give the build memory with `maintenance_work_mem`; set page fill with `WITH (fillfactor = 90)` (the B-Tree default is 90).
> - MySQL: InnoDB builds indexes with a sort (`innodb_sort_buffer_size`) and leaves free space according to `innodb_fill_factor`.
> - Oracle: `PCTFREE` reserves room in each block for future updates.

@subtopic Compression
@summary Trade CPU for space: per page, per row or per column.

Compression stores data in fewer bytes, so more fits in each read and in memory, at the cost of **CPU** to compress and decompress.

## At what level?

| Level | Pros | Cons |
|---|---|---|
| **Whole file** | Best compression ratio | Reading one page means decompressing a lot; any update means recompressing. Impractical for indexes. |
| **Per page** | Fits the page model: compress on flush, decompress on load | A compressed page rarely fills whole disk blocks, so reads may fetch extra bytes |
| **Per row or per column** | Independent of page management | Less context to compress, so a lower ratio |

## Choosing an algorithm

Engines usually let you choose a library: **LZ4**, **Snappy**, **Zstandard (zstd)**, **zlib**. Compare them on four things: **compression ratio**, **compression speed**, **decompression speed** and **memory use**. The best choice depends on your data.

> **In practice:**
> - **MySQL InnoDB:** `ROW_FORMAT=COMPRESSED` (zlib, with a `KEY_BLOCK_SIZE`), or transparent page compression `COMPRESSION='zlib'` or `'lz4'` (uses filesystem hole punching).
> - **PostgreSQL:** TOAST compresses large values: `pglz`, or `lz4` from version 14 (`ALTER TABLE … ALTER COLUMN … SET COMPRESSION lz4`).
> - **Oracle:** basic table compression, and Advanced Row/Index Compression (licensed).
> - **MyRocks / RocksDB:** per-level compression (LZ4 or Zstd).

@topic Vacuum and maintenance
@summary Why pages fill with garbage and fragment, and how background maintenance cleans up.

Besides serving queries, a database runs **background maintenance**: it reclaims space, removes garbage and keeps pages in good shape. Doing this in the background keeps **inserts, updates and deletes fast**: they don't have to clean up after themselves.

Three pages: how fragmentation happens, how it is fixed, and the maintenance commands you run as a DBA.

@subtopic How fragmentation happens
@summary Deletes and updates leave unreachable cells behind; free space gets scattered.

A record is **live** (addressable) if it can be reached from the root: root → … → leaf → slot → cell. Anything else in a page is **garbage**: it can't be read, so it is as good as gone, even though its bytes are still there. Engines usually **don't zero** garbage, because new data will overwrite it anyway.

## Where garbage comes from

| Operation | What it leaves behind |
|---|---|
| **Delete** | Only the **slot** is removed; the cell's bytes stay in the page |
| **Split** | The moved cells' slots are trimmed in the old page; their bytes remain until overwritten |
| **Update** | Often writes a **new version** of the cell; the old version stays until cleaned up |
| **MVCC** | Old row versions are kept **on purpose** while other transactions may still need to see them (Chapter 5) |

![A fragmented page: live cells, garbage cells and scattered free space](img:c4-fragmented)

The page may have plenty of free bytes **in total**, but not **in one piece**. A new cell needs **contiguous** space, so the page must be **defragmented** first.

> **Ghost records:** some engines (SQL Server, InnoDB) first mark deleted rows as *ghosts* or *delete-marked*, and a background task removes them once no transaction can need them.

@subtopic Page defragmentation
@summary Rewrite the live cells together, reclaim the gaps, and track freed pages.

The process that cleans this up is called **compaction**, **vacuum** or simply **maintenance**.

## Two ways it happens

- **Synchronously:** when an insert finds enough total space but no contiguous gap, the engine rewrites that page on the spot, which avoids creating an overflow page.
- **Asynchronously:** a background process walks through pages, removes garbage and rewrites them.

## What compaction does

1. Removes **dead cells** (garbage).
2. Rewrites live cells **in key order**, which also helps sequential reads.
3. May **move pages** to new places in the file.
4. Adds freed pages to a **free page list** (*freelist*). The freelist is **persisted**, so free space is not lost after a crash.

> **Example:** SQLite keeps unused pages in a linked list of *trunk pages*, each holding the numbers of free pages. `PRAGMA freelist_count;` shows how many there are, and `VACUUM` rebuilds the file without them.

@subtopic Maintenance as a DBA
@summary VACUUM, OPTIMIZE TABLE, REINDEX and friends: what they do and when to run them.

Here is how the ideas map to the commands you actually run.

| Database | Routine cleanup | Heavy rebuild (reclaims disk space) | Check bloat / fragmentation |
|---|---|---|---|
| **PostgreSQL** | `VACUUM` / **autovacuum**: removes dead tuples, marks space reusable | `VACUUM FULL` (locks the table), `REINDEX [CONCURRENTLY]`, or the `pg_repack` extension | `pgstattuple`, `pgstatindex()`, `pg_stat_user_tables.n_dead_tup` |
| **MySQL InnoDB** | **Purge threads** remove delete-marked rows and old versions automatically | `OPTIMIZE TABLE` (= `ALTER TABLE … ENGINE=InnoDB`, online rebuild) | `information_schema.TABLES.DATA_FREE`, `innodb_index_stats` |
| **Oracle** | Block space is reused automatically | `ALTER TABLE … SHRINK SPACE`, `ALTER INDEX … REBUILD [ONLINE]` / `COALESCE` | `DBA_TABLES`/`DBA_INDEXES` statistics, Segment Advisor |
| **SQL Server** | Ghost cleanup task | `ALTER INDEX … REBUILD` / `REORGANIZE` | `sys.dm_db_index_physical_stats` (`avg_fragmentation_in_percent`) |

## Practical guidance

- **Let the automatic cleanup work.** Tune it rather than replacing it: in PostgreSQL, make autovacuum more aggressive on busy tables (`autovacuum_vacuum_scale_factor`).
- **Long-running transactions block cleanup** everywhere: old versions can't be removed while a transaction might still read them. Watch for idle-in-transaction sessions and long reports.
- **Rebuild only with evidence.** A rebuild is heavy I/O. Do it when bloat is measured and hurts (wasted cache, slow scans), not on a fixed schedule.
- After a big `DELETE`, **space is reused** by later inserts, but the files don't shrink until a rebuild.

@topic Check yourself: Chapter 4
@summary Short questions on real B-Tree implementations. Answers are below.

1. **What is a magic number in a page header good for?**
2. **What extra work do sibling links cause during a split?**
3. **What is a high key, and which well-known database uses it?**
4. **A table has a 50 KB `TEXT` column. Where does PostgreSQL store it, and where does InnoDB (`DYNAMIC` row format) store it?**
5. **What does a binary search return when the key is not found?**
6. **What are breadcrumbs, and when are they used?**
7. **How does a B*-Tree split differ from a normal split?**
8. **Why are random UUIDv4 primary keys bad for an InnoDB table, and what is a better choice?**
9. **You need to load 200 million rows into a new table with five secondary indexes. In which order should you load and index, and why?**
10. **After deleting half the rows, a PostgreSQL table's file is still the same size. What reclaims the disk space, and what is the catch?**

---

> **1.** It is a constant checked on read. A mismatch means a wrong offset, a misaligned read or a corrupt page.
>
> **2.** The neighbour's link must be updated to point to the new page, which means modifying (and locking) a third page.
>
> **3.** The upper bound of keys allowed in a node's subtree, stored in the node itself. PostgreSQL (B-link trees).
>
> **4.** PostgreSQL compresses it and/or moves it into the table's TOAST table. InnoDB stores it in overflow pages, with a 20-byte pointer in the row.
>
> **5.** A negative number that encodes the insertion point: the index of the first element larger than the key.
>
> **6.** The pages (and child indexes) visited on the way from root to leaf, kept on a stack. They are popped to find the parents when a split or merge propagates upward.
>
> **7.** It redistributes entries until two neighbours are full, then splits two nodes into three, each about two-thirds full, instead of one node into two half-full ones.
>
> **8.** Random keys insert all over the clustered index: many page splits, half-empty pages, a larger working set and a bigger copy of the key in every secondary index. Use an auto-increment `BIGINT` or a time-ordered UUIDv7.
>
> **9.** Load the data first, then create the indexes. Each `CREATE INDEX` sorts and bulk-builds its tree bottom-up, with no splits and with sequential I/O, which is much faster than maintaining five indexes row by row.
>
> **10.** `VACUUM FULL` (or `pg_repack`) rewrites the table. `VACUUM FULL` takes an exclusive lock for the whole rewrite and needs extra disk space for the new copy.
