@chapter 7. Log-Structured Storage
@summary LSM Trees, compaction, amplification trade-offs, Bloom filters, and how logs stack from the database down to the SSD.

## Why this chapter matters

> "Accountants don't use erasers, or they end up in jail." (Pat Helland)

An accountant never erases a wrong entry: they add a **correcting entry**, and the final balance is worked out by going through all the entries. **Log-structured storage** works the same way: data files are written once and **never modified**. New versions are appended, and reads reconcile them.

This design powers many of today's write-heavy databases:

| Engine | Used by |
|---|---|
| **RocksDB** / LevelDB | MyRocks (MySQL), TiKV/TiDB, CockroachDB (Pebble, a RocksDB-like engine), Kafka Streams, many embedded uses |
| **Cassandra / ScyllaDB** | Wide-column stores |
| **HBase**, Google Bigtable | Wide-column stores |
| **InfluxDB**, ClickHouse MergeTree (a related design) | Time-series and analytics |

## What you will learn

| Topic | The question it answers |
|---|---|
| Mutable vs immutable storage | What do you gain and lose by never overwriting? |
| LSM Tree basics | Memtables, flushes and disk tables |
| Updates, deletes and lookups | Tombstones, merge-iteration and reconciliation |
| Compaction | Leveled, size-tiered and time-window strategies |
| Read, write and space amplification | The RUM trade-off, and B-Tree vs LSM |
| Implementation details | SSTables, Bloom filters, skiplists, compression |
| Unordered log storage | Bitcask and WiscKey |
| Concurrency and log stacking | Safe flushes; logs on top of logs on top of SSDs |
| Part I conclusion | Buffering, immutability and ordering, revisited |

@topic Mutable vs immutable storage
@summary In-place updates favour reads; append-only storage favours writes.

| | **Mutable** (in-place update), e.g. B-Tree | **Immutable** (append-only), e.g. LSM Tree |
|---|---|---|
| A write must… | **Find** the record on disk, then overwrite it | Just **append**; no need to find anything |
| Copies of a key | One current version | **Several** versions, in different files |
| A read must… | Find the one record and return it | Find **all** versions, **reconcile** them, return the newest |
| Optimized for | **Reads** | **Writes** |
| I/O pattern | Mostly random | Mostly **sequential** |
| Free space in pages | Reserved for future writes | None: files are **fully packed** |
| Concurrency | Latches on pages | Written files never change, so readers need **no locks** on them |

## B-Tree pain points that immutability addresses

- Every write first needs to **locate** the page (random read), then **rewrite the whole page**, even for a one-byte change.
- Splits and merges **relocate** records already written.
- Pages keep free space and **fragment** over time.

Immutable files are also **safe** by nature: once written, they can be read by any number of threads concurrently, and their integrity can't be broken by later writes.

> Immutable structures still need **maintenance**, just of a different kind: B-Trees defragment pages; LSM Trees **merge files** (compaction).

@topic LSM Tree basics
@summary Buffer writes in a sorted memtable, flush it as an immutable sorted file, and merge files over time.

The **Log-Structured Merge Tree (LSM Tree)** was introduced by Patrick O'Neil and colleagues in 1996. The name comes from **log-structured filesystems**, which write every change to a log-like file.

- **Log-structured:** data is written **append-only**.
- **Merge:** files are combined over time, much like **merge sort**, both in background maintenance and during reads.

Four pages follow: why LSM Trees work, the memtable and flush, two- vs multi-component designs, and the life cycle of the components.

> LSM Trees are often contrasted with B-Trees, but they frequently **use** small B-Trees (or similar indexes) **inside** their immutable files to find records quickly.

@subtopic Why LSM Trees are fast at writes
@summary Writes go to memory and a log, never to random places on disk.

An LSM Tree applies two ideas from earlier chapters: **buffering** and **immutability**.

1. Writes go into a **sorted in-memory table** and a sequential **log**. There is no disk seek at all.
2. When the memory table is full, it is written to disk **in one sequential pass** as an immutable, **sorted** file.
3. Over time, files are **merged** to keep their number small.

## Benefits

| Benefit | Why |
|---|---|
| **High write throughput** | Inserts, updates and deletes never have to find existing records |
| **Sequential I/O** | Files are written in one pass, with no fragmentation |
| **Dense files** | No space reserved for future updates, and pages are 100% full |
| **Simpler concurrency** | On-disk files never change; only the in-memory structures and the list of files need protection |
| **Great for ingest** | Logs, metrics, events, IoT: writes outnumber reads |

## The price

Reads may need to check **several files**, and the same key may exist in several of them. Most of this chapter is about keeping that cost down: compaction, Bloom filters and good file indexes.

@subtopic Memtable, WAL and flush
@summary The memtable takes writes in memory, the WAL makes them durable, and a flush turns the memtable into a disk table.

![Write path of an LSM Tree: WAL, memtable, flush to sorted tables, compaction](img:c7-lsm)

## The memtable

- An in-memory, **mutable**, **sorted** structure, usually a **skiplist** or a balanced tree.
- **All writes** go here, and reads check it **first** (it holds the newest data).
- Updating it costs **no disk I/O**.

## The write-ahead log

The memtable is lost on a crash, so every write is first appended to a **WAL** (commit log). A write is acknowledged once it is **in the log and in the memtable**.

## Flush

When the memtable reaches its size limit (or after a timer):

1. **Switch:** a new, empty memtable takes all new writes. The full one becomes read-only (**flushing**).
2. Write the flushing memtable to disk **sequentially**. It is already sorted, so this is cheap.
3. The new **disk table** becomes readable, and the flushed memtable is dropped.
4. The **WAL segment** for that memtable can now be deleted.

> **In practice:**
> - **RocksDB:** `write_buffer_size` (memtable size), `max_write_buffer_number`.
> - **Cassandra:** `memtable_heap_space` / `memtable_offheap_space`, commit log in `commitlog_directory`. `nodetool flush` forces a flush, for example before a snapshot.

@subtopic Two-component vs multicomponent LSM Trees
@summary One big disk tree merged on every flush, or many disk tables merged by compaction.

## Two-component LSM Tree (the original design)

- **One** memory component and **one** disk component, which is a B-Tree with **100% full, read-only** pages.
- On flush, each part of the memtable is **merged with the matching subtree on disk**, and the merged result is written to a new place on disk. The old pieces are then discarded.
- A merge just advances two iterators (memory and disk) in step, because both are sorted.

![Two-component LSM Tree before and after a flush](img:c7-two-component)

During a flush:

1. New writes go to the **new** memtable.
2. Both the old disk subtree and the flushing memtable stay **readable**.
3. Publishing the merged result and discarding the old parts happens **atomically**.

The downside is high **write amplification**: every flush triggers a merge into the big disk tree. No well-known product uses this design.

## Multicomponent LSM Tree (what everyone uses)

- Each flush writes the **whole memtable** as a **new disk table**.
- The number of tables **keeps growing**, and a read may need to check many of them.
- A background process, **compaction**, picks some tables, **merges** them into a new one and deletes the old ones.

The rest of this chapter describes multicomponent LSM Trees.

@subtopic The LSM component life cycle
@summary Current memtable, flushing memtable, flush target, flushed tables, compacting and compacted tables.

At any moment, an LSM Tree is made of components in different states:

| Component | Reads? | Writes? | Notes |
|---|---|---|---|
| **Current memtable** | Yes | **Yes** | Receives all new writes |
| **Flushing memtable** | Yes | No | Being written to disk |
| **On-disk flush target** | No | Being written | Incomplete, so not yet readable |
| **Flushed tables** | Yes | No | Readable once the flushing memtable is dropped |
| **Compacting tables** | Yes | No | Being merged; readable until the result is ready |
| **Compacted tables** | Yes | No | Created from flushed or earlier compacted tables |

The **table view** (the set of components a read must consult) changes during flushes and compactions. Each change must be **atomic**: a read sees either the old set or the new set, never a mix.

> **Durability link:** until a memtable is fully flushed, the **WAL is the only copy on disk** of its data. Truncating the log too early, before the flush finishes, would lose data after a crash. The same rule as Chapter 5, applied to memtables instead of dirty pages.

@topic Updates, deletes and lookups
@summary Tombstones, range tombstones, merge-iteration with a priority queue, and timestamp-based reconciliation.

In an LSM Tree, no write ever looks for the old record. So:

- an **update** is simply a newer record for the same key
- a **delete** must be recorded **explicitly**
- a **read** must look at **several components** and combine what it finds

@subtopic Tombstones and range tombstones
@summary A delete is a special record that hides older values; a range tombstone hides a range of keys.

## Why deleting from the memtable isn't enough

Suppose a disk table holds `k1 → v1`, and the memtable holds the newer `k1 → v2`.

```plaintext
 Disk table        Memtable
 | k1 | v1 |       | k1 | v2 |
```

If we delete `k1` by just removing it from the memtable, the old `v1` **comes back to life**:

```plaintext
 Disk table        Memtable
 | k1 | v1 |       (empty)        → a read now returns v1!
```

## Tombstones

Instead, a delete writes a **tombstone**: a special record meaning "this key is deleted as of now".

```plaintext
 Disk table        Memtable
 | k1 | v1 |       | k1 | <tombstone> |   → a read returns "not found"
```

During reads and compaction, the tombstone **hides** all older values of that key.

## Range tombstones

To delete a **range** of keys, write one **range tombstone** instead of one tombstone per key, for example `DELETE … WHERE key >= 'k2' AND key < 'k4'`. Cassandra calls these **range tombstones**.

```plaintext
 Disk table 1      Disk table 2
 | k1 | v1 |       | k2 | <start, inclusive> |
 | k2 | v2 |       | k4 | <end, exclusive>   |
 | k3 | v3 |
 | k4 | v4 |       → k2 and k3 are hidden; k1 and k4 remain
```

Overlapping ranges and ranges that span table boundaries need careful rules.

> **DBA warning (Cassandra):** **too many tombstones** make reads slow, because each one must be read and skipped. Reads that scan more than `tombstone_warn_threshold` (1,000) log warnings and fail at `tombstone_failure_threshold` (100,000). Avoid patterns like "queue tables" that insert and delete constantly.

@subtopic Merge-iteration
@summary Combine sorted sources with a priority queue to read them in key order.

All components are **sorted**, so a read (or a compaction) combines them with a **multiway merge sort**.

## How it works

Each source (the memtable and each disk table) provides an **iterator**. A **priority queue** (min-heap) holds the **current head** of each iterator.

1. Fill the queue with the **first item** of each iterator.
2. Take the **smallest** item from the queue and output it.
3. **Refill** the queue from the iterator that item came from, unless that iterator is finished.
4. Repeat until all iterators are done or the query has what it needs.

![Merging two sorted iterators through a priority queue](img:c7-merge)

## Worked example

```plaintext
Iterator 1: {k2: v1} {k4: v2}
Iterator 2: {k1: v3} {k2: v4} {k3: v5}

queue: k1:v3, k2:v1           → output k1:v3, refill from iterator 2
queue: k2:v1, k2:v4           → two records for k2: reconcile, output one
queue: k3:v5, k4:v2           → output k3:v5, then k4:v2
result: k1:v3, k2:(reconciled), k3:v5, k4:v2
```

If two items with the **same key** reach the queue, they must come from **different** sources (each source has at most one record per key), so they are **reconciled** right there.

Cost: **O(N)** memory for N iterators, and **O(log N)** per item to keep the queue ordered.

@subtopic Reconciliation
@summary When sources disagree about a key, the newest record wins; inserts and updates are both upserts.

Several tables can hold records for the **same key**: an older value, a newer value, a tombstone. **Reconciliation** decides which one wins.

## The rule

Each record carries metadata, typically a **timestamp** or **sequence number**. The **newest** record wins; older ones are **shadowed**.

| Records found for k7 | Result |
|---|---|
| `v1 @t1`, `v2 @t5` | `v2` |
| `v2 @t5`, `<tombstone> @t9` | not found |
| `<tombstone> @t3`, `v4 @t8` | `v4` (written after the delete) |

Shadowed records are **not returned** to clients and are **dropped** when compaction rewrites the data.

## Upserts by default

An LSM Tree never checks whether a key already exists, so **insert and update are the same operation**: an **upsert**.

> **In practice:** in Cassandra, `INSERT` and `UPDATE` both upsert, and conflicts are resolved by **write timestamp** (last write wins). Clock skew between client machines can therefore make an "older" write win. Keep clocks in sync with NTP.

@topic Compaction
@summary Merging disk tables to keep reads fast and reclaim space, with leveled, size-tiered and time-window strategies.

The number of disk tables grows with every flush. **Compaction** keeps it under control:

1. Pick several tables.
2. **Merge-iterate** them, reconciling records and dropping shadowed values.
3. Write the result **sequentially** to new table(s).
4. Atomically swap the old tables for the new ones, then delete the old files.

Four pages follow: compaction basics and tombstones, leveled compaction, size-tiered and time-window compaction, and compaction as a DBA concern.

@subtopic Compaction basics and tombstones
@summary Sequential, bounded-memory merges that need free disk space, and tombstones kept until safe.

## Properties of compaction

- **Sequential I/O** on both sides: inputs are read in order and the output is written in order.
- **Bounded memory:** in principle it only needs the iterator heads in memory.
- **Needs free disk space:** the input tables stay readable until the output is complete, so old and new data **coexist** for a while.
- **Can run in parallel**, as long as concurrent compactions use **different** tables.
- Can **merge** many tables into one, or **split** one table into several.

## Tombstones survive compaction, for a while

A tombstone can't be dropped just because it was merged: an **older value** of the key might still sit in **another table** that wasn't part of this compaction. Dropping the tombstone would bring that value back (**data resurrection**).

| Engine | When tombstones are dropped |
|---|---|
| **RocksDB** | When they reach the **bottommost level**: nothing older can exist below |
| **Cassandra** | After **`gc_grace_seconds`** (default **10 days**), so every replica has seen the delete |

> **DBA warning (Cassandra):** if a node is down **longer than `gc_grace_seconds`** and isn't repaired, deleted data can **resurrect** when it rejoins. Run **repairs** more often than `gc_grace_seconds`.

@subtopic Leveled compaction
@summary Levels with growing size limits; tables in L1 and below never overlap.

**Leveled compaction** (RocksDB's default) arranges tables into **levels** L0, L1, L2, … Each level has a **target size**, and each level is about **10× bigger** than the one before. The level with the **highest number is the "bottommost"**: it holds the oldest data.

![Leveled compaction moving data from level 0 down through larger levels](img:c7-leveled)

## The rules

| Level | Key ranges | Comes from |
|---|---|---|
| **L0** | Tables **may overlap** | Memtable flushes |
| **L1 and below** | Tables in one level **never overlap** | Compaction |

- When L0 has too many tables, they are merged with the **overlapping L1 tables** into new L1 tables.
- When a level is **over its size limit**, some of its tables are merged with the **overlapping tables of the next level**.
- Fresh data sits in the low-numbered levels; old data migrates down.

## Why it's good for reads

Within a level, key ranges don't overlap, so a point read checks **at most one table per level** (plus L0). The table metadata (smallest and largest key) rules out the rest.

| | Leveled compaction |
|---|---|
| Read amplification | **Low** |
| Space amplification | **Low** (~10% extra) |
| Write amplification | **High**: data is rewritten again at every level (often 10–30×) |

@subtopic Size-tiered and time-window compaction
@summary Merge tables of similar size together; or group time-series data by time window.

## Size-tiered compaction

Tables are grouped by **size**, not by level:

- New small tables (from flushes) collect in the smallest tier.
- When **enough similar-sized** tables exist (Cassandra default: 4), they are merged into **one bigger** table in the next tier.
- And so on: bigger tables merge with other big tables.

![Size-tiered compaction: similar-sized tables merge into bigger ones](img:c7-tiered)

| | Size-tiered | Leveled |
|---|---|---|
| Write amplification | **Lower** | Higher |
| Read amplification | Higher (a key may be in many tables) | Lower |
| Space amplification | **Higher**: a big merge temporarily needs as much free space as its inputs, up to **~50% of the disk** | Lower |
| Good for | Write-heavy workloads | Read-heavy workloads, updates |

**Table starvation:** if merged tables stay small (for example, most records were shadowed by tombstones), the bigger tiers may never get compacted, and their tombstones keep slowing reads. The engine must then **force** a compaction.

## Time-window compaction

For **time-series data with TTLs**, Cassandra's **TimeWindowCompactionStrategy (TWCS)** groups tables by **write time window** (for example, one per day). When a whole window has **expired**, its files are **dropped entirely**, with no merging and no rewriting.

> **Choosing in Cassandra:** `SizeTieredCompactionStrategy` (STCS) is the classic default; `LeveledCompactionStrategy` (LCS) suits read-heavy tables; `TimeWindowCompactionStrategy` (TWCS) suits time-series data with TTL. Cassandra 5.0 adds the **Unified Compaction Strategy** (UCS), which can behave like either STCS or LCS.

@subtopic Compaction as a DBA
@summary What to watch, and what goes wrong when compaction falls behind.

Compaction is **background work that competes with your queries** for disk and CPU. Most LSM incidents come from compaction falling behind.

## Symptoms of compaction debt

| Symptom | Cause |
|---|---|
| Reads get slower over time | Too many tables (or L0 files) to check |
| Disk usage grows faster than the data | Old versions and tombstones not yet merged away |
| **Write stalls** | RocksDB slows or stops writes when L0 has too many files (`level0_slowdown_writes_trigger`, `level0_stop_writes_trigger`) or there is too much pending compaction |
| Disk fills during a big compaction | Size-tiered compactions need temporary space |

## Commands and settings

| Engine | Monitor | Tune |
|---|---|---|
| **Cassandra** | `nodetool compactionstats`, `nodetool tablestats` (SSTable count, tombstones per read) | `compaction_throughput` (MB/s), `concurrent_compactors`, per-table strategy |
| **RocksDB / MyRocks** | `rocksdb.stats` property, `SHOW ENGINE ROCKSDB STATUS` | `max_background_jobs`, `level0_*_trigger`, `target_file_size_base`, rate limiter |

> **Rules of thumb:**
> - Keep **plenty of free disk**: 50% for size-tiered, ~20–30% for leveled.
> - Throttle compaction so it doesn't starve queries, but not so much that it **falls behind**.
> - After a big bulk load, let compaction **catch up** before running performance tests.

@topic Read, write and space amplification
@summary The three costs of storage structures, the RUM conjecture, and B-Tree vs LSM.

Every storage structure pays somewhere. Three numbers describe where:

| Amplification | Meaning | In LSM Trees, caused by |
|---|---|---|
| **Read** | Data read from disk ÷ data the query needed | Checking several tables per read |
| **Write** | Data written to disk ÷ data the application wrote | Compaction rewriting data again and again |
| **Space** | Disk space used ÷ size of the live data | Old versions and tombstones not yet compacted away |

Compaction moves the balance between them: compact **aggressively** and you cut read and space amplification but raise write amplification; compact **lazily** and the opposite happens.

@subtopic Comparing the amplifications
@summary B-Trees and LSM Trees pay in different places, for different reasons.

![Typical read, write and space amplification of B-Trees and LSM Trees](img:c7-amplification)

## Where write amplification comes from

| Structure | Source |
|---|---|
| **B-Tree** | Rewriting a **whole page** to change a few bytes, plus the WAL, plus page splits; repeated updates rewrite the same page again and again |
| **LSM Tree** | **Compaction**: moving the same data from file to file, level to level |

> "Which has lower write amplification?" is a long-running debate. The **sources differ**, so the answer depends on the workload, record size, update pattern and settings. Measure with your own data rather than trusting a general claim.

@subtopic The RUM conjecture
@summary Read, update and memory overheads: you can minimize two, never all three.

The **RUM conjecture** (Read, Update, Memory) states:

> You can optimize **two** of read cost, update cost and memory (space) overhead, only at the **expense of the third**.

![The RUM triangle: structures near each corner sacrifice the opposite cost](img:c7-rum)

| Structure | Optimized for | Pays with |
|---|---|---|
| **B-Tree** | **Reads** | Updates must locate pages and rewrite them; reserved free space |
| **LSM Tree** | **Updates** (writes) and space | Reads must check several tables, reduced with Bloom filters and compaction |
| Hash index (e.g. Bitcask) | Point reads and writes | Memory: all keys in RAM; no range scans |

The model is a **rule of thumb**: it ignores latency, access patterns, implementation complexity, maintenance and hardware details, and in distributed databases also consistency and replication cost.

@subtopic B-Tree or LSM Tree?
@summary A practical guide to choosing between them.

| Your workload | Lean towards | Why |
|---|---|---|
| Read-heavy OLTP, lots of point lookups and short ranges | **B-Tree** (InnoDB, PostgreSQL) | One place per key; predictable read latency |
| Write-heavy ingest: logs, metrics, events, IoT | **LSM** (RocksDB, Cassandra) | Sequential writes, high throughput |
| Lots of **updates** to the same rows | Usually **B-Tree** | LSM keeps many versions until compaction |
| Need to **save disk space** (SSD cost) | **LSM** with leveled compaction and compression | Fully packed files, good compression |
| Time-series with TTL expiry | **LSM** with time-window compaction | Expired data dropped as whole files |
| Strict, **predictable latency** | **B-Tree** | Compaction can cause latency spikes |

> **Real example:** Facebook built **MyRocks** (MySQL on RocksDB) for its user database and reported about **half the storage** of compressed InnoDB, with much lower write amplification on flash. The trade-off was more complex tuning and different read performance. Same SQL, different storage engine: Chapter 1's "pluggable engines" in action.

@topic Implementation details
@summary SSTables, Bloom filters, skiplists, disk access and compression in LSM engines.

LSM engines share several building blocks:

| Building block | Purpose |
|---|---|
| **SSTable** | The immutable sorted file format on disk |
| **Bloom filter** | Skip tables that certainly don't hold a key |
| **Skiplist** | A simple, concurrent sorted structure for the memtable |
| **Block cache and compression** | Efficient disk access for immutable, unaligned data |

@subtopic Sorted String Tables (SSTables)
@summary An index component plus a data component, written once in key order.

Disk tables are usually **Sorted String Tables (SSTables)**: records are stored **sorted by key** and never changed after writing.

## Two parts

| Part | Contents |
|---|---|
| **Index** | Keys and **offsets** into the data part. Built as a B-Tree (logarithmic lookup) or a hash table (constant-time lookup). |
| **Data** | Key/value records **concatenated** in key order, using the cell formats from Chapter 3, written **sequentially** |

A **hash index** still allows range scans: it finds the **first** key of the range, and the rest is read **sequentially** from the sorted data part.

## Life of an SSTable

- Written in **one pass** during a flush or a compaction. Its offsets are known when the index is built.
- **Compaction** reads data parts **sequentially**, without touching the index, because they're already sorted. The merged output is also written sequentially.
- Once complete, the file is **immutable** until it is deleted after a compaction.

> **SSTable-attached secondary indexes (SASI):** Cassandra can attach **secondary index** files to each SSTable, created during flush or compaction, plus an in-memory index for the memtable. Index lifecycles then follow table lifecycles. Newer Cassandra versions use **SAI** (Storage-Attached Indexing), which builds on the same idea.

@subtopic Bloom filters
@summary A tiny probabilistic structure that says "definitely not here" or "maybe here".

Reads are slow when they check many tables. A table's **key range** (min and max key) helps a little, but a key inside the range may still be absent. A **Bloom filter** answers far more precisely.

## What it guarantees

| Answer | Meaning |
|---|---|
| **"No"** | The key is **definitely not** in the table, so skip it |
| **"Maybe"** | The key **might** be there, so read the table to check. It can be a **false positive**. |

There are **never false negatives**.

## How it works

A Bloom filter is a **bit array** plus **k hash functions**.

- **Add a key:** compute its k hashes and **set** those k bits to 1.
- **Check a key:** compute its k hashes. If **any** of those bits is 0, the key was never added. If all are 1, the answer is "maybe".

![A 16-bit Bloom filter with three hash functions](img:c7-bloom)

In the example, `key1` sets bits 3, 5, 10 and `key2` sets bits 5, 8, 14:

- `key3` hashes to 3, 10, 14: all set → **"maybe"**, a false positive (it was never added).
- `key4` hashes to 5, 9, 15: bits 9 and 15 are 0 → **"definitely not"**.

## Sizing

More bits per key means fewer false positives, at the cost of memory. SSTables are immutable, so the number of keys is **known** when the filter is built, and the filter can be sized exactly.

![False-positive rate versus bits per key](img:c7-bloom-fp)

| Bits per key | False-positive rate (optimal k) |
|---|---|
| 5 | ~9% |
| 10 | ~1% |
| 15 | ~0.07% |
| 20 | ~0.007% |

> **In practice:**
> - **RocksDB:** `BloomFilterPolicy(10)` (10 bits per key, ~1%) is the common choice.
> - **Cassandra:** `bloom_filter_fp_chance` per table (0.01 by default; 0.1 under LCS).
>
> Bloom filters live in memory, so a lower false-positive rate costs RAM.

> **Other probabilistic structures:** **HyperLogLog** estimates distinct counts (used by Redis `PFCOUNT` and many `approx_count_distinct` functions), and **Count-Min Sketch** estimates frequencies.

@subtopic Skiplists
@summary A sorted linked list with express lanes: search-tree speed, simple concurrent inserts.

A **skiplist** keeps data sorted in memory. It is about as simple as a linked list, but searches in roughly **O(log n)**, like a balanced tree.

![A skiplist and the search path for key 7](img:c7-skiplist)

## Structure

- Nodes have different **heights**. Each level is a linked list that **skips** over nodes of lower levels.
- A node's height is picked **randomly** on insert. Each level has about half the nodes of the level below (for p = ½), and the maximum height is capped.
- There is **no rebalancing**: the randomness keeps it balanced on average.

## Search: find 7

1. On the **top level**, follow the pointer: it reaches 10. 7 < 10, so drop down a level **from the head**.
2. Next level: reach 5 (5 < 7), move forward to 10 (too big), so **drop down from 5**.
3. Bottom level: from 5, move forward → **7, found**.

Rule: move **right** while the next key is smaller, otherwise move **down**.

## Insert and delete

Find the position, create the node with a random height, and **re-link** the predecessors on each of its levels. Delete re-links them around the node.

| | Skiplist | In-memory B-Tree |
|---|---|---|
| Balancing | Probabilistic, no rotations | Splits and merges |
| Concurrent inserts | **Easy** (CAS per level, a "fully linked" flag) | Harder |
| CPU cache friendliness | Lower: small nodes scattered in memory | Higher |

**Used in:** RocksDB and LevelDB memtables (default), Cassandra (for parts of its memtables), WiredTiger update buffers, and Redis sorted sets (`ZADD`/`ZRANGE`).

@subtopic Disk access and compression
@summary Immutable files need no latches, but records aren't page-aligned, so compressed blocks need an offset map.

## Disk access

LSM engines still use a **block cache** (page cache) with eviction and pinning (Chapter 5), with two differences:

- Cached blocks are **immutable**, so readers need **no latches**. **Reference counting** keeps a block, or a whole file, alive while it is in use; files are deleted after compaction only when no reader holds them.
- Records are **not page-aligned** and may **cross block boundaries**, so a read can touch two blocks. Pointers are often **byte offsets** rather than page ids.

## Compression

SSTables are written once, so compression is applied **block by block** as the file is written. Compressed blocks have **different sizes**, so they no longer line up with fixed offsets.

![An offset map translates uncompressed block numbers to compressed block positions](img:c7-compression)

- While writing, the engine records each block's **compressed offset and size** in a separate **mapping** (index) section.
- To read: look up the block's offset and size → read it → **decompress** → cache the uncompressed block.
- Padding compressed blocks back to full page size would **waste** the savings, so it isn't done.

> **In practice:**
> - **RocksDB:** per-level compression, often **LZ4** for upper levels and **Zstd** for the bottommost level (`bottommost_compression`), plus `block_size` and `block_cache`.
> - **Cassandra:** `compression = {'class': 'LZ4Compressor', 'chunk_length_in_kb': 16}`. Smaller chunks help random reads; larger chunks compress better.

@topic Unordered log-structured storage
@summary Bitcask and WiscKey store values in insertion order to make writes even cheaper.

Every structure so far kept data **sorted**: B-Tree pages, FD-Tree runs, SSTables. **Unordered** stores keep records in **insertion order**:

- writes are just appends, with no sorting
- often **no separate WAL** is needed, because the data file *is* the log
- but **range scans** become hard

Two designs follow: **Bitcask** (fully unordered) and **WiscKey** (sorted keys, unordered values).

@subtopic Bitcask
@summary Values appended to log files, with an in-memory hash map from every key to its latest value.

**Bitcask** is a storage engine of the **Riak** database. There is no memtable: records are appended **directly to log files**.

![Bitcask: the keydir points every key to its latest value in the log files](img:c7-bitcask)

## How it works

| Operation | Steps |
|---|---|
| **Write** | Append key + value to the active log file, then point the key's **keydir** entry at the new position |
| **Read** | Look up the key in the keydir and read the value at that position: **one disk read**, no merging |
| **Delete** | Append a tombstone and remove the key from the keydir |
| **Compaction** | Read the log files, keep only **live** records (the ones the keydir points to), write them to new files, update the keydir |

The **keydir** is an **in-memory hash map** from each key to the location of its latest value.

## Strengths and limits

| ✅ Strengths | ❌ Limits |
|---|---|
| Very simple | **All keys must fit in RAM** |
| Excellent point reads and writes | The keydir must be **rebuilt at startup** by scanning the files (Bitcask can speed this up with "hint files") |
| No separate WAL | **No range queries**: keys are unordered both in memory and on disk |

@subtopic WiscKey
@summary Keep keys sorted in a small LSM Tree and values in an append-only value log.

**WiscKey** separates **sorting** from **garbage collection**:

- **Keys** live in a normal, **sorted LSM Tree**, but the value stored there is a **pointer**.
- **Values** live in unordered, append-only **value logs (vLogs)**.

![WiscKey: a sorted key LSM Tree pointing into an append-only value log](img:c7-wisckey)

## Why it helps

- Keys are usually **much smaller** than values, so the key LSM Tree is small: compaction moves **far less data**, which cuts write amplification.
- It solves Bitcask's problems: keys don't all need to fit in RAM, there is no keydir rebuild, and **range scans are possible** in key order.

## Costs

- A **range scan** reads values from scattered places in the vLog, which means **random I/O**. WiscKey uses the SSD's internal **parallelism** to prefetch many values at once, but whole pages are still read for single values.
- **vLog garbage collection** is more complex. The vLog has no liveness information, so GC must **look up each key** in the LSM Tree to see whether a value is still live. A **head and tail** pointer mark the part of the vLog that holds live data.
- It works best when **updates and deletes are rare**, since then there is little garbage to collect.

> **In practice:** the same key-value separation appears in **RocksDB BlobDB** (integrated BlobDB with `enable_blob_files`), TiKV's **Titan** engine and Badger (Go). They are useful for large values (say > 1 KB).

@topic Concurrency in LSM Trees
@summary Safe memtable switches, flush finalization and log truncation.

LSM concurrency is mostly about safely changing the **table view**: the set of memtables and disk tables a read must consult. The memtable itself must also handle concurrent access (except in shard-per-core designs like **ScyllaDB**).

## Rules for a flush

- The **new memtable** must be ready for reads and writes.
- The **old (flushing) memtable** must stay readable.
- The flushing memtable is written to disk.
- **Dropping** the flushed memtable and **adding** the new disk table must be **atomic**.
- The **WAL segment** for the flushed memtable is then discarded.

## Three synchronization points

| Point | What happens | If done wrong |
|---|---|---|
| **Memtable switch** | All new writes go to the new memtable | Writes into an already-flushed area are **lost** |
| **Flush finalization** | The flushed table replaces the old memtable in the table view | Removing the memtable too early gives **incomplete reads** |
| **WAL truncation** | The log segment for the flushed memtable is deleted | Truncating before the flush completes **loses data on a crash** |

Cassandra uses **operation-order barriers**: the flush waits for all writes accepted into the old memtable to finish first.

During **compaction**, the view also changes: the old tables stay readable until the new one is complete, then are swapped out atomically. The same table must never be part of **two compactions** at once.

> Same principle as B-Trees: in a B-Tree, log truncation is tied to flushing **dirty pages**; in an LSM Tree, it is tied to flushing **memtables**.

@topic Log stacking
@summary Logs on top of logs: database, filesystem and SSD each do log-structured work, sometimes redundantly.

Log-structured designs are everywhere:

- **Databases** (LSM Trees, WALs)
- **Filesystems**: many buffer writes and append them (log-structured or copy-on-write: F2FS, Btrfs, ZFS)
- **SSDs**: the flash translation layer is itself log-structured

LSM Trees and SSDs are a good match (sequential, append-only writes avoid in-place updates). But when log-structured layers are **stacked**, they can bring back the very problems they were meant to solve: write amplification, fragmentation and poor performance.

Four pages follow: the SSD's FTL, filesystem logging, LLAMA's "mindful" stacking, and bypassing layers with open-channel SSDs.

@subtopic The flash translation layer and wear leveling
@summary SSDs are log-structured inside: remap pages, garbage-collect blocks and spread out wear.

From Chapter 2: on an SSD, a page can only be written after its **block** has been **erased**, and erasing works on whole blocks of 64–512 pages.

So the SSD's **flash translation layer (FTL)**:

1. writes each new version of a logical page into a **fresh, empty** physical page
2. **remaps** the logical address to the new location
3. marks the old page as **discarded**
4. when free pages run out, runs **garbage collection**: picks a block, **relocates its live pages**, then **erases** the block

![SSD garbage collection relocates live pages before erasing a block](img:c7-ftl)

## Wear leveling

Flash cells survive only a limited number of **program/erase cycles**. The FTL spreads writes **evenly** across all blocks, so no hot spot wears out early. This is **wear leveling**.

## Why the FTL is log-structured

It **batches small random writes** into full pages, which means fewer operations and fewer garbage collections.

> **DBA link:** SSD-level write amplification multiplies the database's. Help the drive: leave free space (over-provisioning), keep `discard`/`fstrim` working, choose enterprise drives with power-loss protection, and watch drive wear (`smartctl -a`, *Percentage Used* / *Media Wearout*).

@subtopic Filesystem logging and misaligned writes
@summary Each layer keeps its own log and garbage collection; misalignment makes it worse.

When a log-structured database runs on a log-structured filesystem on an SSD, each layer:

- does its **own bookkeeping** and garbage collection
- can't see what the other layers know: which data is about to be discarded, how big their segments are

![A higher-level log whose segments don't line up with the lower-level log](img:c7-stacking)

## Problems this causes

| Problem | Example |
|---|---|
| **Redundant work** | The filesystem relocates data that the database is about to delete |
| **Misaligned segments** | One database segment spans two filesystem segments; deleting it fragments both |
| **Interleaved streams** | The WAL and data files are each written sequentially, but **interleaved**, they look random to the device |

## What helps

- **Align partitions** to the device's erase/page sizes, and keep **writes aligned** to the page size. Modern tools do this by default; check after RAID or virtualization layers.
- Some vendors recommend putting the **log on a separate device** to separate its stream from the data files. Alignment matters even more.
- Avoid stacking **copy-on-write filesystems** under copy-on-write or LSM databases without tuning (for example, database settings for ZFS and Btrfs).

@subtopic LLAMA and mindful stacking
@summary A log-structured layer that understands the Bw-Tree can consolidate while it collects garbage.

The Bw-Tree from Chapter 6 runs on **LLAMA**: a **latch-free, log-structured, access-method-aware** storage layer.

## How LLAMA stores Bw-Tree nodes

- Delta nodes are collected in **4 MB flush buffers** and written to disk when the buffer is full.
- Garbage collection reclaims space from **unused deltas and base nodes**, and relocates live ones.

## Why "access-method aware" matters

A plain log-structured store would write deltas of different logical nodes **interleaved**, in insertion order. Because LLAMA **understands Bw-Tree nodes**, it can:

- place the deltas of one logical node **together**
- **cancel out** deltas that undo each other (an insert followed by a delete keeps just the delete)
- during GC, **consolidate** a node's deltas into **one new base node** instead of just copying them

| GC approach | Result |
|---|---|
| Unaware: copy the deltas contiguously | Same space used; readers still apply the deltas |
| Higher layer consolidates separately | The log still has to garbage-collect the old versions |
| **Aware (LLAMA)**: consolidate during GC | Less space, faster reads, one pass |

> **Lesson:** layering isn't bad in itself. Layers that **share the right information** through good interfaces can be very efficient.

@subtopic Open-channel and zoned SSDs
@summary Skip the filesystem and FTL, and let the storage engine manage flash directly.

Instead of stacking layers smartly, you can **remove** some of them.

**Open-Channel SSDs** expose the flash internals (placement, garbage collection, wear leveling, I/O scheduling) to the host, bypassing the FTL. That removes at least **two log layers** (filesystem + FTL).

| Example | Idea |
|---|---|
| **LOCS** | An LSM-based key-value store built directly on open-channel SSDs |
| **LightNVM** | Linux kernel support for open-channel SSDs |
| **Software Defined Flash (SDF)** | Hardware/software co-design: the **write unit equals the erase unit** (a block), which slashes write amplification, and each internal **channel** appears as its own block device |

It is like `O_DIRECT` (Chapter 5) for flash: more control, more work for the developer.

> **Today:** the industry has largely moved to **Zoned Namespace (ZNS)** SSDs, a standardized NVMe interface where data must be written **sequentially into zones**. That is a natural fit for log-structured storage, and RocksDB supports it through **ZenFS**.

@topic Part I conclusion: buffering, immutability and ordering
@summary All the structures of Part I, classified by the three properties from Chapter 1.

Part I began with three properties that describe any storage structure: **buffering**, **immutability** and **ordering**. Here is every structure from the course, classified:

| Structure | Buffering | Immutable | Ordered |
|---|---|---|---|
| B+-Tree (classic) | – | – | ✔ |
| WiredTiger | ✔ | – | ✔ |
| LA-Tree | ✔ | – | ✔ |
| Copy-on-write B-Tree (LMDB) | – | ✔ | ✔ |
| Two-component LSM Tree | ✔ | ✔ | ✔ |
| Multicomponent LSM Tree | ✔ | ✔ | ✔ |
| FD-Tree | ✔ | ✔ | ✔ |
| Bw-Tree | ✔ | ✔ | partly (consolidated nodes only) |
| Bitcask | – | ✔ | – |
| WiscKey | ✔ (keys only) | ✔ | keys only |

## What the properties do

- **Buffering always reduces write amplification.** In in-place structures (WiredTiger, LA-Tree) it combines several writes to the same page into one.
- **Immutability** helps **concurrency** and **space** (fully packed pages), but often **defers** write amplification: data is rewritten later as it moves between levels (LSM Trees, FD-Trees).
- **Immutability without buffering** leads to **unordered** storage (Bitcask, WiscKey's values). Copy-on-write B-Trees are the exception: they re-sort and relocate their pages.

## Takeaways for a DBA

1. There is **no perfect storage engine**. Every design trades read, write and space costs.
2. When a database behaves strangely (bloat, stalls, slow scans, latency spikes), ask **which of these mechanisms is at work**: page splits, vacuum, checkpoints, compaction, tombstones?
3. You now have the vocabulary to read engine documentation and source code. Most "new" designs **combine these same ideas** in new ways.

> **What's next:** Part II of the book moves from one node to **distributed systems**: replication, consistency models, failure detection, leader election and consensus.

@topic Check yourself: Chapter 7
@summary Questions on log-structured storage. Answers are below.

1. **Why are LSM Trees fast at writes?**
2. **What is a memtable, and what protects its contents from a crash?**
3. **Why can't a delete just remove the key from the memtable?**
4. **How does merge-iteration combine several sorted tables?**
5. **Two tables hold `k → v1 @t3` and `k → <tombstone> @t7`. What does a read return? What if the timestamps were swapped?**
6. **Leveled vs size-tiered compaction: which has lower write amplification, and which has lower read amplification?**
7. **Why does Cassandra keep tombstones for `gc_grace_seconds`, and what goes wrong if a node is down longer than that?**
8. **A Bloom filter says "maybe". What does that mean? Can it say "no" for a key that is present?**
9. **About how many bits per key give a 1% false-positive rate?**
10. **What does the RUM conjecture say?**
11. **What are Bitcask's two main limitations, and how does WiscKey address them?**
12. **What is a write stall in RocksDB, and what usually causes it?**
13. **Why can stacking a log-structured database on a log-structured filesystem on an SSD be inefficient?**

---

> **1.** Writes only go to an in-memory memtable and a sequential log, with no lookup of existing records. Disk files are written sequentially in large batches.
>
> **2.** A sorted, mutable in-memory table that receives all writes. A write-ahead log protects it until it has been flushed to disk.
>
> **3.** Older values of the key may sit in disk tables; without a tombstone they would reappear.
>
> **4.** It keeps the head of each table's iterator in a priority queue, repeatedly outputs the smallest key, refills from that iterator, and reconciles records with the same key.
>
> **5.** "Not found": the tombstone is newer. With the timestamps swapped, it returns `v1`, written after the delete.
>
> **6.** Size-tiered has lower write amplification; leveled has lower read (and space) amplification.
>
> **7.** So that every replica sees the delete before the tombstone is purged. If a node misses the delete and stays down past that time without repair, the deleted data can resurrect when it comes back.
>
> **8.** The key might be in the table, so it must be checked (it could be a false positive). No: a Bloom filter never gives false negatives.
>
> **9.** About 10.
>
> **10.** You can reduce two of read, update and memory (space) overhead only at the expense of the third.
>
> **11.** All keys must fit in RAM (and the keydir must be rebuilt at startup), and there are no range scans. WiscKey keeps the keys in a sorted LSM Tree and only the values in an unordered log.
>
> **12.** RocksDB slows or stops writes when compaction can't keep up, typically because L0 has too many files or too many bytes are pending compaction.
>
> **13.** Each layer does its own logging and garbage collection without knowing what the others do. The result is redundant work, misaligned segments and fragmentation, which multiplies write amplification.
