@chapter 6. B-Tree Variants
@summary Copy-on-write, lazy, FD, Bw and cache-oblivious B-Trees: how they fix the weak spots of the classic design.

## Why this chapter matters

The classic B-Tree was designed for spinning disks. On SSDs and many-core CPUs, three weaknesses show up:

| Weakness | What it means |
|---|---|
| **Write amplification** | Changing a few bytes rewrites a whole page; splits and merges rewrite even more pages |
| **Space amplification** | Pages keep free space for future inserts, so you store and transfer empty bytes |
| **Concurrency complexity** | Latches, crabbing and B-link tricks are hard to get right and can become bottlenecks |

Each variant in this chapter attacks some of these using the ideas from Chapter 1: **buffering**, **immutability** and **ordering**.

| Variant | Main idea | Fixes | Used in |
|---|---|---|---|
| **Copy-on-write B-Tree** | Never modify a page; copy it and switch the root pointer | Concurrency, crash safety | LMDB, Btrfs-style filesystems |
| **Lazy B-Tree** | Buffer changes in memory per node and apply them later | Write amplification | **WiredTiger** (MongoDB) |
| **FD-Tree** | Small mutable head tree plus immutable sorted runs | Random writes | Research (flash indexing) |
| **Bw-Tree** | Append small delta records; swap pointers atomically | All three | SQL Server **Hekaton** (in-memory OLTP), Azure Cosmos DB |
| **Cache-oblivious B-Tree** | A layout that works well at every memory level | Tuning for block sizes | Mostly academic |

> As a DBA you may never implement these, but you will **run** systems built on them: MongoDB, OpenLDAP, SQL Server in-memory tables. Knowing their design explains their tuning knobs and failure modes.

@topic Copy-on-write B-Trees
@summary Never change a page in place: copy the path, then switch the root.

Instead of complex latching, some engines guarantee integrity with **copy-on-write (CoW)**: a page is **never modified**. To change it, the engine copies it, changes the copy, and builds a **new version of the tree** next to the old one.

Two pages: how copy-on-write works, and LMDB, the best-known engine that uses it.

@subtopic How copy-on-write works
@summary Copy every page on the path to the root, then publish the new root atomically.

To update a leaf:

1. **Copy** the leaf and change the copy.
2. Its parent must now point to the new leaf, so **copy the parent** too, and so on up to the root. B-Trees are shallow, so that's only a few pages.
3. All **untouched pages are shared** between the old and new tree.
4. **Atomically switch** the root pointer to the new root.

![Copy-on-write: the new tree shares unchanged pages with the old one](img:c6-cow)

## Benefits

- **Readers need no latches.** Pages they read never change.
- **Readers never block writers**, and writers never block readers.
- **No half-written state is ever visible.** A crash leaves either the old root or the new one, so there is no corruption and no need for complex recovery.
- **Free MVCC.** Each root is a consistent snapshot.

## Costs

- **Extra space:** old page versions stay until the last reader using them finishes.
- **Extra CPU and I/O:** whole pages are copied, along with the path to the root.
- Writers to the same pages must still **wait** for each other.

Because B-Trees are shallow, the simplicity often outweighs these costs.

@subtopic LMDB
@summary A memory-mapped copy-on-write B-Tree with no cache, no WAL and no compaction.

**LMDB** (Lightning Memory-Mapped Database) is a key-value store built for **OpenLDAP**, and embedded in many other projects. Thanks to copy-on-write, it needs **no page cache, no write-ahead log, no checkpoints and no compaction**.

## How it works

- **Single-level store:** the database file is **memory-mapped**. Reads go straight to the mapped pages, with no copying into a separate buffer.
- **Updates** copy every node on the path from the root to the target leaf; the other nodes are shared.
- Only **two root versions** exist: the latest committed root and the one being written. All writes pass through the root, so that's enough.
- Old pages are **reused** once no reader still references them.
- **No sibling pointers:** an append-only copy-on-write tree can't keep them up to date cheaply, so range scans climb back to the parent to find the next leaf.

Every version is a full snapshot, so **readers never take locks** and never interfere with the single writer.

> **Operational notes:**
> - LMDB allows **one writer at a time**.
> - A **long-lived read transaction** stops old pages from being reused, so the file **grows**. It's the same "long transaction" problem as MVCC in Chapter 5.
> - The map size must be set big enough in advance (`mapsize` / `olcDbMaxSize` in OpenLDAP).

@topic Lazy B-Trees
@summary Buffer updates in memory per node and apply them in batches: WiredTiger and LA-Trees.

**Lazy B-Trees** don't apply every change to the page right away. They collect updates in lightweight in-memory structures and **apply them later, in batches**. This cuts down on page rewrites (write amplification).

Three pages: how nodes can be represented in memory, WiredTiger, and the Lazy-Adaptive Tree.

@subtopic Node representations in memory
@summary Raw bytes, native objects or wrappers: three ways to work with a page in memory.

Before a page can be updated on disk, its **in-memory form** must be updated. There are three common ways to represent a node in memory:

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Raw bytes + casts** | Point straight at the page bytes (in the page cache or a memory map) and read them as structures | No copying, no extra memory | Needs an unmanaged language (C/C++); concurrent access is tricky |
| **Materialized objects** | Decode the page into native objects; change those; encode back on flush | Simpler concurrency: raw page and objects are separate | **Two copies** of each page in memory |
| **Wrapper objects** | An object over the page buffer that applies changes to the bytes immediately | Works well in managed languages (Java, Go) | Every access goes through the wrapper |

Keeping the **on-disk page**, the **cached page** and the **in-memory representation** separate lets them have **different lifecycles**. For example, updates can be **buffered** in memory and **merged** with the on-disk version only when reading or flushing. Lazy B-Trees are built on exactly this.

@subtopic WiredTiger
@summary MongoDB's default engine: in-memory pages with skiplist update buffers, reconciled on flush.

**WiredTiger** is MongoDB's default storage engine. Its B-Tree uses **different formats in memory and on disk**.

![WiredTiger: a clean page and a dirty page with its update buffer](img:c6-wiredtiger)

## How it works

- When a page is read, WiredTiger builds an **in-memory index** from the on-disk **page image**. That is a **clean** page.
- Updates go into an **update buffer** attached to the page, implemented as a **skiplist** (Chapter 7). Skiplists perform like search trees but handle **concurrency** better. The page is now **dirty**.
- **Reads** merge the on-disk image with the update buffer to return the newest data.
- On flush, **reconciliation** combines the image and the buffer into a new on-disk page. If the result is too big, it is **split** into several pages.

The big advantage: page rewrites and **structural changes (splits, merges) run in background threads**, so reads and writes don't wait for them.

> **In practice (MongoDB):**
> - The WiredTiger cache defaults to roughly **50% of (RAM − 1 GB)**, set with `storage.wiredTiger.engineConfig.cacheSizeGB`.
> - A **checkpoint** writes a consistent snapshot every **60 seconds**, and the journal (WAL) covers the time in between.
> - If dirty data grows faster than eviction can write it, application threads are pulled into **eviction** and latency spikes. Watch `db.serverStatus().wiredTiger.cache` (the "tracked dirty bytes" and "pages evicted by application threads" counters).

@subtopic Lazy-Adaptive Tree (LA-Tree)
@summary Attach update buffers to subtrees and flush them down level by level.

The **LA-Tree** buffers updates per **subtree** instead of per node.

![An LA-Tree: buffers attached to subtrees cascade changes downward](img:c6-latree)

## How it works

1. A new record goes into the **root's update buffer**.
2. When that buffer is **full**, its entries are pushed down into the buffers of the **subtrees below**.
3. This **cascades** level by level until the changes reach the **leaves**.
4. At the leaves, the batched inserts, updates and deletes are applied **all at once**, including any splits and merges, which also propagate upward in batches.

Many updates to the same pages become **one write per page**, so there are fewer disk accesses and fewer structural changes.

| | WiredTiger | LA-Tree |
|---|---|---|
| Buffer attached to | Each page | Each **subtree** |
| Changes reach the page | On reconciliation (flush) | When buffers cascade down |
| Read cost | Merge the page with its update buffer | Check buffers on the path, then the leaf |

Both trade some extra **read work** (checking buffers, merging with stale disk data) for far fewer **writes**.

@topic FD-Trees
@summary A small mutable head tree plus immutable sorted runs, connected with fractional cascading.

Random writes are expensive: slow head movement on HDDs, extra garbage collection on SSDs. A B-Tree does lots of them: leaf writes, plus splits and merges going up.

The **FD-Tree** (Flash Disk Tree) avoids them by **appending** instead of updating nodes in place. This idea also inspired LSM Trees (Chapter 7).

Three pages: the overall structure, fractional cascading, and logarithmic runs with deletes.

@subtopic Head tree and sorted runs
@summary Random writes are confined to a tiny head tree; everything else is written sequentially.

An FD-Tree has two parts:

| Part | Mutable? | Role |
|---|---|---|
| **Head tree** | Yes: a small B-Tree | Absorbs all new writes. The **only** place with random writes. |
| **Sorted runs** L1, L2, … | **No**: immutable | Hold most of the data, written **sequentially** |

## How data flows

1. Writes go into the **head tree**.
2. When it **fills up**, its contents are written out as an **immutable sorted run** (level 1).
3. When a level gets **too big**, it is **merged** into the next level, and the merged result **replaces** the old run.

Data moves from small, recent levels to large, older levels, much like **compaction** in LSM Trees.

![FD-Tree: a head B-Tree on top of growing immutable sorted runs](img:c6-fdtree)

@subtopic Fractional cascading
@summary Bridges between sorted levels so each next search starts near the answer.

Searching many sorted arrays one after another costs a full binary search per array. **Fractional cascading** makes every search after the first one **much cheaper**.

## The idea

- Copy (**pull up**) every N-th element of each lower array into the array above it.
- Each pulled element keeps a **bridge** (the FD-Tree paper calls it a **fence**): a pointer to its position in the lower array.
- Search the **top** array with binary search. From the closest match, **follow the bridge**: you land **near** the answer in the next array, so only a short local search is needed.

## Example

Three sorted arrays:

```plaintext
A1 = [12, 24, 32, 34, 39]
A2 = [22, 25, 28, 30, 35]
A3 = [11, 16, 24, 26, 30]
```

Pull every other element up from the level below:

```plaintext
A1 = [12, 24, 25, 30, 32, 34, 39]      ← 25, 30 pulled from A2
A2 = [16, 22, 25, 26, 28, 30, 35]      ← 16, 26 pulled from A3
A3 = [11, 16, 24, 26, 30]
```

![Bridges between levels in fractional cascading](img:c6-cascading)

Why every N-th element? Bridging **every** element costs too much space. Bridging only elements that happen to exist on both levels can leave **big gaps**. Pulling a regular sample keeps every gap **small and bounded**.

@subtopic Logarithmic runs and deletes
@summary Runs grow by a factor k per level; deletes are tombstones that cancel older entries.

## Logarithmic runs

Each sorted run is about **k times bigger** than the one above it (levels L1, L2, L3, … grow geometrically).

- When the head tree fills, it is **merged into L1**, and the result replaces the old L1.
- When L1 passes its size limit, it is merged into **L2**, and so on.

FD-Trees use an adapted fractional cascading: the first key of each **lower-level page** is propagated up as a pointer, so a search continues from the closest match found on the level above.

## Deletes

Runs are **immutable**, so a key can't be removed from a run. And the same key may exist on **several levels**. So a delete inserts a **tombstone** (the paper calls it a *filter entry*): "this key is deleted; ignore older versions below."

- A read finds the tombstone first (upper levels are newer) and returns "not found".
- When the tombstone is merged all the way into the **lowest level**, nothing older remains to hide, and it can be **dropped**.

> You will meet this exact mechanism again, at scale, in **LSM Trees** (Chapter 7), which power RocksDB, Cassandra and many others.

@topic Bw-Trees
@summary Delta chains, a mapping table and compare-and-swap: a latch-free B-Tree.

The **Bw-Tree** (the "Buzzword Tree", from Microsoft Research) aims to fix all three B-Tree problems at once: **write amplification, space amplification and latching**.

Its ingredients:

- **append-only** storage for node changes
- nodes as **chains** of small changes
- an in-memory **mapping table** updated with a single atomic **compare-and-swap (CAS)**, which makes the tree **latch-free**

> **Where it runs:** the range indexes of SQL Server's **In-Memory OLTP (Hekaton)** memory-optimized tables are Bw-Trees, and Azure Cosmos DB uses one too.

Four pages: delta chains, the mapping table with CAS, splits and merges, and consolidation with garbage collection.

@subtopic Delta chains
@summary A node is a base page plus a linked list of small change records.

A Bw-Tree stores a **base node** once and never rewrites it for small changes. Each change is written as a small **delta node** (an insert, update or delete), and deltas form a **chain** from newest to oldest, ending at the base node.

![A Bw-Tree logical node: newest delta, older deltas, base node](img:c6-bwtree)

## Consequences

| Aspect | Classic B-Tree page | Bw-Tree node |
|---|---|---|
| Update | Rewrite the page | **Prepend** a small delta |
| Free space reserved | Yes (space amplification) | **None**: deltas are stored compactly |
| Fixed size / contiguous | Yes | **No**: a node is a *logical* entity |
| Read cost | Read one page | Walk the chain and apply the deltas to the base |

The read cost is similar to the LA-Tree: changes are kept **apart** from the main structure and **replayed on read**. That is why long chains get **consolidated** (see the last page of this topic).

@subtopic Mapping table and compare-and-swap
@summary Logical node ids map to physical locations; one atomic swap installs each change.

If parents pointed directly at the newest delta, every update would also have to rewrite the **parent**. Instead, a Bw-Tree uses an in-memory **mapping table**:

```plaintext
logical node id  ──▶  physical location of the newest delta (or the base)
```

Parents store **logical ids**, so adding a delta changes **only the mapping table entry**.

## Updating a node

1. Walk from the root to the target **logical leaf**, using the mapping table to resolve ids.
2. Create a new **delta node** that points to the current head of the chain.
3. **Compare-and-swap** the mapping table entry from the old head to the new delta.

CAS is **atomic**, so every concurrent read sees either the old chain or the new one, never a half-finished state, and **nobody blocks**:

- reads ordered **before** the swap follow the old pointer and don't see the delta
- reads ordered **after** see it
- if two threads try to add a delta to the **same node**, only one CAS succeeds; the other **retries**

That is how the Bw-Tree avoids **latches** altogether.

@subtopic Splits and merges (SMOs)
@summary Structure changes happen in steps marked by special deltas, and any thread can help finish them.

Bw-Tree nodes still overflow and underflow, so they need **structure modification operations (SMOs)**: splits and merges. They follow B-Tree logic but use **special delta records**.

## Split

First, **consolidate** the node (apply its deltas) and create a new page with the entries **right of the split point**. Then:

1. **Split delta:** append a split delta to the splitting node. It holds the **separator key** (entries above it now live elsewhere) and a **link to the new sibling**.
2. **Parent update:** add the new node to the **parent**.

Between steps 1 and 2 the tree is in a **half-split** state, just like a B-link tree: the new node is reachable through the old node's link. Updating the parent is only a **shortcut**.

## Merge

1. **Remove-node delta** on the right sibling: marks it for deletion.
2. **Merge delta** on the left sibling: makes the right sibling's contents a logical part of the left one.
3. **Parent update:** remove the pointer to the right sibling.

## Cooperation instead of latches

Since nothing is latched, **any thread may find an unfinished SMO**. It must **help complete it** before continuing, so the next thread takes the fast path. To stop conflicting SMOs on the same parent, an **abort delta** acts like a short write lock.

The tree grows taller when the **root splits**: a new root is created above the old root and its new sibling.

@subtopic Consolidation and garbage collection
@summary Collapse long delta chains into a new base, and free old nodes once no reader can see them.

## Consolidation

Long delta chains make **reads slower**. When a chain passes a **threshold length**, the node is **consolidated**:

1. Apply all the deltas to the base, producing a **new base node**.
2. Write it to a **new location**.
3. CAS the mapping table entry to point to it.

## Epoch-based reclamation

After consolidation, the old base and deltas are **unreachable** from the mapping table, but a reader that started earlier might **still be walking them**. Readers hold no latches, so the engine can't just ask who is using a node.

The solution is **epoch-based reclamation**:

- Time is divided into **epochs**, and each reader registers the epoch it started in.
- A node retired in epoch *E* is freed only after **every reader from epoch E or earlier has finished**.
- Readers that started later could never have seen it, so freeing it is safe.

> **Why the Bw-Tree matters:** it shows B-Trees can be **latch-free**, **append-only** and **cache-friendly** at once. Implementations include Microsoft's Hekaton and Cosmos DB, the experimental Rust engine *Sled*, and CMU's open-source **OpenBw-Tree**. Its log-structured storage layer (**LLAMA**) is covered in Chapter 7.

@topic Cache-oblivious B-Trees
@summary Structures that perform well at every level of the memory hierarchy without knowing block sizes.

Classic B-Trees are **cache-aware**: page size, node size and alignment are tuned for **one** pair of levels, such as page cache and disk.

**Cache-oblivious** structures are designed to be efficient **without knowing** cache line, block or page sizes, at **every** level of the hierarchy at once.

Two pages: the idea, and the van Emde Boas layout that makes it work.

@subtopic Cache-aware vs cache-oblivious
@summary Two-level thinking, multilevel benefits, and no parameters to tune.

## The two-level model

So far we've thought of memory as **two levels**: a fast, small **cache** and a slow, big **disk**, moving data in **blocks**. Designing for two levels is easy: tune for that one pair. That is **cache-aware** design.

Real machines have many levels: CPU caches (L1/L2/L3) → RAM → SSD → HDD or object storage. Tuning for each pair is hard, and the tuning doesn't carry over to other hardware.

## The cache-oblivious idea

Design the structure so that it is optimal for **any two adjacent levels**, without knowing their sizes. Then it is automatically near-optimal for the **whole hierarchy**, and the number of block transfers is within a **constant factor** of the best possible.

| | Cache-aware B-Tree | Cache-oblivious B-Tree |
|---|---|---|
| Needs block/page size | Yes, tuned per system | **No** |
| Optimal for | One pair of levels | **Every** pair of levels |
| Real-world use | Everywhere | **Mostly academic** so far |

@subtopic van Emde Boas layout and packed arrays
@summary Store recursive subtrees contiguously, and leave gaps in a packed array for inserts.

A cache-oblivious B-Tree has two parts: a **static tree** laid out in **van Emde Boas order**, and a **packed array** that holds the data.

## van Emde Boas layout

1. Cut the tree at the **middle level**: one top subtree and many bottom subtrees.
2. Lay out **each subtree contiguously** in memory, the top one first.
3. Repeat **recursively** inside every subtree. Each piece has about **√N** nodes.

![van Emde Boas layout: recursive subtrees stored contiguously](img:c6-veb)

Whatever the block size, there is some level of the recursion where a subtree **fits in one block**, so a root-to-leaf walk touches few blocks at **every** level of the hierarchy.

## Packed array

To allow inserts, the data lives in a **packed array**: contiguous, but with **gaps** left according to a density threshold.

```plaintext
[ 3 _ 7 9 _ _ 15 _ 21 24 _ 30 _ _ ]
```

- An insert goes into a **nearby gap**; elements move only when no gap is close.
- When a region gets too **dense** or too **sparse**, it is **rebalanced**, or the array is rebuilt.
- The static tree indexes the packed array and is updated when elements move.

## Why it isn't widely used

- Paging and eviction still happen **in blocks**, which cuts into the theoretical benefit.
- In **block transfers**, it has the same complexity as a well-tuned cache-aware B-Tree.
- It may become more relevant with fast, byte-addressable **non-volatile memory**.

@topic Check yourself: Chapter 6
@summary Questions on B-Tree variants. Answers are below.

1. **Name the three weaknesses of classic B-Trees that these variants try to fix.**
2. **In a copy-on-write B-Tree, which pages are copied when one leaf changes, and how is the change published?**
3. **Why does LMDB need no write-ahead log?**
4. **What problem can a long-running read transaction cause in LMDB?**
5. **How does WiredTiger handle an update to a page that is already in memory?**
6. **MongoDB latency spikes while "pages evicted by application threads" grows. What is happening?**
7. **In an FD-Tree, where do random writes happen?**
8. **What problem does fractional cascading solve?**
9. **How does a Bw-Tree add a change to a node without latches?**
10. **Why must Bw-Tree delta chains be consolidated, and why can't the old nodes be freed immediately?**
11. **What does "cache-oblivious" mean?**

---

> **1.** Write amplification, space amplification, and the complexity of concurrency control (latching).
>
> **2.** The leaf and every page on the path from it to the root. The new root is published with one atomic pointer switch.
>
> **3.** Pages are never modified in place, and the root switch is atomic, so a crash always leaves the old or the new consistent tree. There is nothing to redo or undo.
>
> **4.** Old pages it may still read can't be reused, so the database file keeps growing.
>
> **5.** The change goes into the page's skiplist update buffer. Reads merge the buffer with the page image, and reconciliation writes a new page image on flush.
>
> **6.** Dirty data is piling up faster than background eviction can write it, so application threads are made to evict pages themselves, which adds latency.
>
> **7.** Only in the small mutable head tree. The sorted runs are written sequentially and never modified.
>
> **8.** Searching many sorted arrays one by one. Bridges let each search after the first start close to the answer.
>
> **9.** It writes a delta node that points to the current chain head, then installs it with a compare-and-swap on the mapping table entry. If the CAS fails, it retries.
>
> **10.** Long chains make reads slow. Readers hold no latches and may still be walking the old chain, so old nodes are freed only after all readers from that epoch (or earlier) have finished: epoch-based reclamation.
>
> **11.** The structure performs near-optimally at every level of the memory hierarchy without knowing any block, page or cache-line sizes.
