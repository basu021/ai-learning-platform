@chapter 5. Transaction Processing and Recovery
@summary Buffer pools, write-ahead logs, crash recovery, isolation levels, MVCC, locks and latches.

## Why this chapter matters

This is the chapter that explains the day-to-day life of a DBA:

- why a bigger **buffer pool** makes a database faster, and when it doesn't
- what **WAL / redo**, **checkpoints** and **fsync** really do, and how a crash is recovered
- what **isolation levels** protect you from, and what each database's default really means
- how **MVCC**, **locks**, **deadlocks** and **latches** work under the hood

Earlier chapters were about how data is *stored*. This one is about how it is kept **correct and durable** while many users change it at the same time.

## What you will learn

| Topic | The question it answers |
|---|---|
| Transactions and ACID | What must a transaction guarantee, and which components provide it? |
| Buffer management | How does the page cache decide what stays in memory? |
| Recovery and the write-ahead log | How do committed changes survive a crash? |
| Concurrency control | How can transactions run in parallel and still be correct? |
| Isolation levels and anomalies | Which problems does each isolation level allow? |
| Concurrency control techniques | Optimistic, MVCC, timestamps, two-phase locking, deadlocks |
| Locks and latches in B-Trees | How is the tree itself protected from concurrent changes? |

@topic Transactions and ACID
@summary What a transaction is, the four ACID guarantees, and the components that implement them.

A **transaction** is a group of operations (reads and writes) that the database treats as **one indivisible unit of work**.

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- both changes happen, or neither does
```

Two pages follow: the ACID properties, and the engine components that make them possible.

@subtopic The ACID properties
@summary Atomicity, consistency, isolation and durability, in plain words.

| Property | Plain meaning | Main mechanism |
|---|---|---|
| **Atomicity** | All steps happen, or **none** do. A transaction **commits** (all changes visible) or **aborts** (all changes undone). | Undo information in the log |
| **Consistency** | A transaction moves the database from one **valid state** to another: constraints, foreign keys and business rules hold. | Partly the database (constraints), mostly the **application** |
| **Isolation** | Concurrent transactions don't **interfere**, as if each ran alone. | Concurrency control (locks, MVCC) |
| **Durability** | Once committed, changes **survive** crashes and power loss. | Write-ahead log, flushed before commit returns |

## Details worth knowing

- **Commit is final.** After an abort, the transaction can be **retried**.
- **Consistency is the weakest-defined property:** it is the only one that depends on the user's rules, not just on the database.
- **Isolation is often weakened on purpose.** Full isolation means *serializable*, which costs performance, so most databases default to a weaker **isolation level** (see *Isolation levels and anomalies*).

> **DBA link:** "durable" depends on configuration. Settings like `innodb_flush_log_at_trx_commit = 2` or PostgreSQL `synchronous_commit = off` trade a little durability (the last ~second of commits after a crash) for speed. Know what your servers are set to.

@subtopic The components behind transactions
@summary Transaction manager, lock manager, page cache and log manager working together.

Four storage-engine components cooperate to make transactions work:

| Component | Job |
|---|---|
| **Transaction manager** | Coordinates, schedules and tracks transactions and their steps |
| **Lock manager** | Guards resources. Grants a lock if it doesn't conflict with locks held by others (**shared** or **exclusive**); otherwise the requester **waits**, or aborts and retries. When a lock is released, a waiting transaction is woken up. |
| **Page cache** | Sits between disk and the engine. All changes are first applied to **cached pages** in memory. |
| **Log manager** | Keeps the **history of operations** (log records) applied to cached pages but not yet saved to disk. Used to **redo** changes after a crash and to **undo** aborted transactions. |

```plaintext
       transaction
            │
   ┌────────┴────────┐
   │ transaction mgr │──── lock manager  (who may touch what)
   └────────┬────────┘
            │ read / modify pages
       page cache  ◀──────▶  disk (data files)
            │ every change is logged first
       log manager ────────▶  disk (WAL / redo log)
```

Transactions that span **several machines** (distributed transactions) need extra coordination, such as two-phase commit. That is outside Part I.

@topic Buffer management
@summary The page cache (buffer pool): what it holds, how pages are evicted, and how real databases tune it.

Databases use a two-level memory hierarchy: **slow disk** and **fast RAM**. To avoid disk reads, pages are **cached in memory**, and a requested page is served from the cache when possible.

This cache is called the **page cache**, **buffer pool** or **buffer cache**. It is usually the **single most important memory setting** of a database server.

Five pages follow: what the cache does, dirty pages and eviction, two families of replacement algorithms, and how MySQL, PostgreSQL and Oracle implement it.

@subtopic The page cache
@summary Keep hot pages in RAM, buffer changes in memory, and decide when to write them back.

![Logical B-Tree pages, their cached copies in memory, and the pages on disk](img:c5-page-cache)

## What the page cache does

- Keeps **page contents in memory**.
- Lets changes be **buffered**: modifications are made to the cached copy, not directly on disk.
- **Requested page already cached?** Return it, with no disk access.
- **Not cached, and there is free space?** Read it from disk (**page in**) and return it.
- **Not cached, and the cache is full?** **Evict** another page first, writing it back to disk if it was modified.

Pages are loaded into **any free slot**, so the order in memory has nothing to do with the order on disk. The cache maps **page ids** to memory locations.

## Terms

| Term | Meaning |
|---|---|
| **Page in** | Load a page from disk into the cache |
| **Dirty page** | A cached page that was modified and is **not yet written** back |
| **Flush** | Write a dirty page back to disk |
| **Evict** | Remove a page from the cache to make room |

## Database cache vs OS cache

The operating system also caches file data. Many databases open files with **`O_DIRECT`** to **bypass** the OS cache and manage memory themselves: they know their access patterns better, and caching every page twice wastes RAM.

> **In practice:** InnoDB uses `innodb_flush_method = O_DIRECT` (the default on Linux in MySQL 8.4) and you give it most of the RAM (`innodb_buffer_pool_size`, often 50–75% on a dedicated server). PostgreSQL uses buffered I/O, so it relies on **both** `shared_buffers` (commonly ~25% of RAM) and the OS cache.

@subtopic Dirty pages, pinning and eviction
@summary When pages can be evicted, why dirty pages need care, and why the top of the B-Tree stays in memory.

## Using a cached page

When the engine requests a page, it gets a **reference** to the cached copy and must **release** it when done. While a page is referenced, it **must not be evicted**.

If the engine changes the page (for example, adds a cell), the page is marked **dirty**: its contents now differ from disk.

## Eviction rules

| Page state | Can it be evicted? |
|---|---|
| Clean (in sync with disk), not referenced | **Yes**, immediately |
| Dirty | Only **after it is flushed** |
| Referenced (in use by a thread) | **No** |
| Pinned | Not while pinned |

Flushing on every eviction would make reads wait for writes, so databases run **background writers** that flush dirty pages before they are needed: PostgreSQL's **background writer**, InnoDB's **page cleaner** threads, Oracle's **DBWn** processes.

## Pinning the top of the tree

Every lookup passes through the **root** and upper levels of a B-Tree, and those levels are tiny compared with the leaves. So they can be **pinned** (kept in memory) permanently. A lookup in a tree of height *h* then reads only the **lowest one or two levels** from disk, not *h* pages.

## The balancing act

The cache must juggle goals that conflict:

- **delay** flushes, to save writes (the same page may change again)
- flush **early**, so eviction is quick
- choose the **best pages** to evict
- stay within its **memory limit**
- never **lose** committed data (that's the log's job, next topic)

> **Prefetching:** the cache can also load pages **before** they are needed (the next leaves of a range scan, *read-ahead*), and **evict immediately** pages read by one-off jobs such as a full scan or vacuum, so they don't push out hot data.

@subtopic Page replacement: FIFO and LRU
@summary Choosing which page to evict: by arrival order, or by most recent use.

When the cache is full, a page must go. The **page-replacement policy** tries to pick the page **least likely to be needed soon**. A perfect policy would need to know the future, so real policies use the past as a guide.

> **Bélády's anomaly:** with a poor policy, a **bigger** cache can cause **more** evictions. Cache size alone doesn't fix a bad algorithm.

## FIFO: first in, first out

Evict the page that was **loaded longest ago**. Simple, but blind to use: the root page is loaded first, so it would be evicted first, even though every query needs it.

## LRU: least recently used

Keep pages in a queue; every **access** moves the page to the **back**. Evict from the **front**: the page not used for the longest time.

```plaintext
evict ◀── [ P7 | P2 | P9 | P4 | P1 ] ◀── most recent
access P9:  [ P7 | P2 | P4 | P1 | P9 ]
```

LRU is good, but moving pages on **every access** is expensive under heavy concurrency, and **one large scan** can flush the whole cache.

## Improved LRU variants

| Policy | Idea |
|---|---|
| **2Q** (two queues) | First access → a "recent" queue; second access → a "hot" queue. Separates **recently** used from **frequently** used pages. |
| **LRU-K** | Track the last **K** accesses of each page, and evict by the K-th most recent access. Pages touched once by a scan lose to pages used repeatedly. |

@subtopic Page replacement: CLOCK and LFU
@summary CLOCK approximates LRU cheaply; LFU and TinyLFU keep pages by frequency.

## CLOCK

**CLOCK** gives up a little precision for speed and concurrency. Pages sit in a **circular buffer**, each with an **access bit** (or a small counter). Every access sets the bit to 1.

![The CLOCK-sweep algorithm with access bits](img:c5-clock)

A "clock hand" sweeps around:

| Page state at the hand | Action |
|---|---|
| Access bit **1**, not referenced | Set it to **0**, move on (a second chance) |
| Access bit **0** | **Evict** this page |
| Currently **referenced** | Leave it, move on |

Because the hand and bits can be updated with atomic compare-and-swap, CLOCK needs **no global lock**. Linux uses a CLOCK variant, and so does PostgreSQL.

## LFU and TinyLFU

Under heavy load, **how often** a page is used can predict the future better than **how recently**. **LFU** (least frequently used) evicts the page with the fewest accesses.

**TinyLFU** keeps a compact **frequency sketch** instead of full history, and uses three queues:

| Queue | Holds |
|---|---|
| **Admission** | New pages (LRU) |
| **Probation** | Pages likely to be evicted |
| **Protected** | Pages that proved their worth |

A page is admitted only if it is used **more often** than the page it would push out. TinyLFU is used by the Java caching library **Caffeine**.

@subtopic Buffer pools in real databases
@summary How InnoDB, PostgreSQL and Oracle manage their caches, and what to watch.

| | MySQL InnoDB | PostgreSQL | Oracle |
|---|---|---|---|
| Name | Buffer pool | Shared buffers | Database buffer cache |
| Size setting | `innodb_buffer_pool_size` | `shared_buffers` | `DB_CACHE_SIZE` (or SGA auto-tuning) |
| Algorithm | **LRU with a midpoint**: new pages enter the "old" sublist (37% by default); they move to the "young" part only if accessed again after `innodb_old_blocks_time` (1 s) | **Clock sweep** with a usage count (0–5) per buffer; big scans and vacuum use small **ring buffers** | LRU lists using a **touch count** per buffer |
| Background flushing | Page cleaner threads | Background writer + checkpointer | DBWn processes |

The midpoint design and the ring buffers have the same goal: a one-off **full table scan** or backup shouldn't wipe out the hot pages.

## What to watch

```sql
-- MySQL: physical reads vs logical read requests
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- Innodb_buffer_pool_reads (from disk) should be tiny vs ..._read_requests

-- PostgreSQL: cache hit ratio per database
SELECT datname, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct
FROM pg_stat_database;
```

> **Rules of thumb:**
> - A high hit ratio (> 99% for OLTP) is good, but the **working set** matters more than the whole database size.
> - Watch for a high rate of **dirty page writes by backends** (PostgreSQL `pg_stat_bgwriter`/`pg_stat_checkpointer`, InnoDB "free page waits"): the background writers can't keep up.
> - MySQL can **warm the cache** after a restart: `innodb_buffer_pool_dump_at_shutdown` / `_load_at_startup` (on by default); PostgreSQL has `pg_prewarm`.

@topic Recovery and the write-ahead log
@summary How committed changes survive crashes: WAL, LSNs, checkpoints, steal/force policies and ARIES.

Databases run on layers of hardware and software that can **fail at any moment**. Whatever the database told a client was committed **must still be there** after a crash.

The key tool is the **write-ahead log (WAL)**, also called the **redo log** or **commit log**: an **append-only** file on disk that records every change before the changed pages are written.

The pages in this topic:

1. WAL basics
2. Log records, LSNs and commits
3. Checkpoints
4. Physical vs logical logging
5. Steal and force policies
6. ARIES recovery
7. When fsync lies

@subtopic Write-ahead log basics
@summary Log every change first; then pages can be written back whenever it is convenient.

## The rule

> **Every change is written to the log on disk before the page it changes is written to disk.** That's the "write-ahead" in WAL.

![Changes go to the log first; dirty pages are flushed later](img:c5-wal)

## What the WAL gives you

| Benefit | How |
|---|---|
| **Durability with buffering** | Pages can stay dirty in memory for a long time. The log already holds the change, so it survives a crash. |
| **Crash recovery** | After a crash, replay the log to rebuild the changes that hadn't reached the data files (**redo**). |
| **Rollback** | Undo information lets aborted or unfinished transactions be reversed (**undo**). |
| **Fast commits** | Commit only waits for a **sequential append** to the log, not for random writes to data pages. |

Until a dirty page is flushed, the **log is the only copy on disk** of that change. That is why logs deserve your fastest, safest storage.

> **Names in different databases:** PostgreSQL **WAL** (`pg_wal/`), MySQL InnoDB **redo log** (plus the separate **binary log** for replication), Oracle **online redo logs** (archived to **archive logs**), SQL Server **transaction log**.

@subtopic Log records, LSNs and commits
@summary Each record gets a sequence number; a transaction is committed when its commit record is on disk.

## Log records and LSNs

The WAL is **append-only** and never changed once written, so all writes are **sequential**, and readers can safely read it while the writer keeps appending.

Each record has a **log sequence number (LSN)**: a unique, ever-increasing number (an internal counter or a byte position). Pages store the LSN of the **last log record that changed them**, so recovery knows which changes a page already has.

## Log buffer and force

Log records are first collected in an in-memory **log buffer**. They are written to disk (**forced**) when:

- the buffer fills up
- the **transaction manager** asks (on commit)
- the **page cache** asks (before flushing a dirty page, so the WAL rule holds)

Records are always written **in LSN order**.

## When is a transaction committed?

> A transaction is **committed** only when the log has been forced up to and including its **commit record**.

Many databases use **group commit**: several transactions' commit records are flushed in one write, so a busy server needs fewer `fsync` calls.

**Compensation log records (CLRs)** are written while undoing changes, so if the system crashes **during** recovery, the undo work isn't repeated.

> **In practice: durability knobs**
>
> | Setting | Safe default | Faster, less safe |
> |---|---|---|
> | MySQL `innodb_flush_log_at_trx_commit` | `1`: flush on every commit | `2`: write on commit, flush ~once per second (lose ≤1 s on an OS crash); `0`: lose ≤1 s even on a MySQL crash |
> | MySQL `sync_binlog` | `1` | `0` or `N` |
> | PostgreSQL `synchronous_commit` | `on` | `off`: recent commits may be lost after a crash, but there is **no corruption** |
> | Oracle | `COMMIT` waits for LGWR | `COMMIT WRITE BATCH NOWAIT` |

@subtopic Checkpoints
@summary Make data files catch up with the log, so old log can be dropped and recovery stays short.

The log can't grow forever, and replaying a huge log after a crash would take hours. **Checkpoints** solve both problems.

A checkpoint makes sure all dirty pages changed **before a certain LSN** have been written to the data files. After that, log records **before that LSN** are no longer needed for crash recovery and can be **recycled** or archived.

## Sync vs fuzzy checkpoints

| | Sync checkpoint | Fuzzy checkpoint |
|---|---|---|
| How | Flush **all** dirty pages at once | Flush pages **gradually in the background** |
| Effect on users | Must pause or slow all work | Work continues |
| Used | Rarely (shutdown) | Almost always |

## How a fuzzy checkpoint works

1. Write a **`begin_checkpoint`** log record.
2. Write an **`end_checkpoint`** record with the list of **dirty pages** and **active transactions**.
3. Flush those dirty pages **asynchronously**.
4. When they are all flushed, update **`last_checkpoint`** (in the log header or a control file) to point to the `begin_checkpoint` record. Recovery will start there.

> **In practice:**
> - **PostgreSQL:** checkpoints happen every `checkpoint_timeout` (5 min default) or when `max_wal_size` (1 GB default) of WAL has been written; `checkpoint_completion_target = 0.9` spreads the writes out. Frequent "checkpoints are occurring too frequently" warnings mean `max_wal_size` is too small.
> - **InnoDB:** continuous fuzzy checkpointing. If the redo log (`innodb_redo_log_capacity`) fills up, InnoDB must flush aggressively and writes **stall**, so size it for your peak write rate.
> - **Oracle:** checkpoints at log switches and by `FAST_START_MTTR_TARGET`; "checkpoint not complete" in the alert log means the redo logs are too small or too few.

@subtopic Physical vs logical logging
@summary Log the bytes that changed, or the operation that changed them; most systems mix both.

Any change can be described as a **before-image** and an **after-image**, or as a **redo** and an **undo** operation:

- redo(before-image) = after-image
- undo(after-image) = before-image

## Two ways to log

| | Physical log | Logical log |
|---|---|---|
| Records | The **bytes/page contents** that changed (before and/or after images) | The **operation**: "insert record X with key Y" (undo: "delete key Y") |
| Size | Larger | Smaller |
| Redo speed | **Fast**: just copy bytes back | Slower: re-run the operation |
| Depends on page layout | Yes | No |
| Typical use | **Redo** | **Undo** (better concurrency) |

Most databases **combine** them: physical (or "physiological") logging for redo, logical logging for undo. ARIES works this way.

## Shadow paging: an alternative to logging

Some systems (System R, and today LMDB) use **shadow paging**: write the new version of a page to a **new location** (copy-on-write), then atomically **flip a pointer** to publish it. The old page stays intact until the flip, so a crash leaves either the old or the new state.

> **In practice:**
> - PostgreSQL writes a **full page image** to the WAL the first time a page changes after each checkpoint (`full_page_writes`), to protect against **torn pages** (half-written 8 KB pages).
> - InnoDB solves the same problem with the **doublewrite buffer**.
> - The MySQL **binary log** is a **logical** log (statements or row changes) used for replication and point-in-time recovery, separate from the physical redo log.

@subtopic Steal and force policies
@summary Two questions: may uncommitted changes reach disk, and must committed changes reach disk at commit?

Two policies decide **when** changed pages may or must be written to disk. Together they decide whether recovery needs **undo**, **redo** or both.

| Policy | Question | Meaning |
|---|---|---|
| **Steal** / no-steal | May a page with **uncommitted** changes be flushed (to free the cache slot)? | Steal = yes |
| **Force** / no-force | Must **all** pages changed by a transaction be flushed **before it commits**? | Force = yes |

## What recovery needs

| | **Force** (pages flushed at commit) | **No-force** (pages may stay dirty after commit) |
|---|---|---|
| **No-steal** (uncommitted data never on disk) | No undo, no redo (but slow commits, huge cache) | **Redo only** |
| **Steal** (uncommitted data may reach disk) | **Undo only** | **Undo + redo**: most flexible and fastest; used by almost all databases |

- **Steal** needs **undo**: uncommitted changes may already be on disk and must be rolled back after a crash.
- **No-force** needs **redo**: committed changes may not be on disk yet and must be replayed.
- **Force** makes commits slow, because every commit waits for random page writes.

So nearly every real engine is **steal / no-force**, and keeps both undo and redo information. In every case, a transaction can't commit until the needed undo or redo records are in the log.

@subtopic ARIES recovery
@summary Analysis, redo, undo: replay history up to the crash, then roll back what never committed.

**ARIES** (Algorithm for Recovery and Isolation Exploiting Semantics, IBM, 1992) is the classic recovery algorithm. Its ideas are used by most databases today.

ARIES is **steal / no-force**, uses **physical redo** (fast recovery) and **logical undo** (better concurrency), **fuzzy checkpoints**, LSNs and a **dirty page table**.

![The three phases of ARIES crash recovery](img:c5-aries)

## The three phases after a crash

1. **Analysis.** Read the log from the last checkpoint. Work out which pages were **dirty** at the crash and which transactions were **still running**. The dirty pages tell redo where to start.
2. **Redo: "repeat history".** Re-apply **all** logged changes from that point, for committed **and** uncommitted transactions, so the database is exactly as it was at the moment of the crash.
3. **Undo.** Roll back the transactions that **never committed**, newest change first. Each undo step is logged as a **CLR**, so a crash during recovery doesn't repeat finished work.

> **Why redo uncommitted work, only to undo it?** Repeating history exactly makes recovery **simple and uniform**: after redo, the database state is known precisely, and undo then works like a normal rollback.

> **In practice:** this is what you see in the logs after a crash. InnoDB reports *"Starting crash recovery… applying redo log… rolling back N transactions"*; PostgreSQL reports *"database system was not properly shut down; automatic recovery in progress… redo starts at …"*. Recovery time depends on how much log there is since the **last checkpoint**.

@subtopic When fsync lies
@summary A real-world lesson: durability depends on the OS reporting write errors correctly.

Checkpoints rely on `fsync()`: "write all dirty data for this file to disk, and tell me if it failed."

In 2018 it became clear (the **"fsyncgate"** discussion) that on Linux and some other systems:

- after an I/O error, `fsync` could **clear the dirty flag** on pages that were **never written**
- the error was reported only to file descriptors that were **open when it happened**

PostgreSQL's checkpointer doesn't keep every file open, so it could **miss the error**, assume the data was safe, and **recycle the WAL** that still held the only copy. The result could be **silent data loss**.

## The fix and the lesson

- PostgreSQL now treats an `fsync` failure as fatal: it **PANICs** and recovers from the WAL instead of retrying (`data_sync_retry = off`, in releases since early 2019).
- Linux kernels improved error reporting.

> **DBA takeaway:**
> - Durability is a **chain**: database → filesystem → kernel → controller cache → disk. Any link can lie.
> - Use storage with **power-loss protection** (battery or capacitor-backed write caches), keep filesystem barriers on, and treat **any I/O error** in database logs as an incident.
> - Test crash recovery for real, for example by pulling the plug on a test server.

@topic Concurrency control
@summary Running transactions in parallel without breaking correctness: the three families and serializability.

**Concurrency control** is the set of techniques that manage how concurrent transactions interact. The transaction manager and lock manager share this job.

| Family | Idea | Conflicts are handled… |
|---|---|---|
| **Optimistic (OCC)** | Let transactions run freely, keep a history of what they read and wrote, **check for conflicts before commit** | At commit: one conflicting transaction is **aborted** and retried |
| **Multiversion (MVCC)** | Keep **several versions** of each record, so readers see a consistent snapshot and don't block writers | Depends on the implementation (validation, timestamps or locks) |
| **Pessimistic (PCC)** | Detect or prevent conflicts **while running**: with **locks**, or without locks using **timestamp ordering** | Up front: transactions **wait** (and may **deadlock**) or abort |

Before choosing a technique, we need to define what "correct" means. That is the job of **serializability**.

@subtopic Schedules and serializability
@summary The gold standard: concurrent execution that gives the same result as some one-at-a-time order.

A **schedule** is the list of database operations (read, write, commit, abort) from a set of transactions, in the order the database runs them. Other work (calculations in the app) has no effect on database state, so it is left out.

| Schedule type | Meaning |
|---|---|
| **Serial** | Transactions run **one after another**, never interleaved. Easy to reason about, but no concurrency. |
| **Serializable** | Operations **are** interleaved, but the result equals **some** serial order of the same transactions. |

![Three concurrent transactions and the six possible serial orders](img:c5-serial-orders)

With three transactions there are 3! = **6** possible serial orders. A serializable schedule must match **at least one** of them. It doesn't matter which, and the database doesn't promise any particular order.

> **Isolation in ACID really means serializability.** Most databases default to weaker levels because enforcing it requires **coordination** between concurrent transactions, and coordination costs throughput.

@topic Isolation levels and anomalies
@summary The problems concurrency can cause, and which isolation level prevents which.

An **isolation level** says how much one transaction can see of others that are running at the same time. Stronger isolation prevents more **anomalies** but needs more coordination, so it costs performance.

The pages in this topic:

1. Read anomalies
2. Write anomalies
3. The standard isolation levels
4. What real databases actually do
5. Snapshot isolation

@subtopic Read anomalies
@summary Dirty reads, non-repeatable reads and phantom reads, with timelines.

The SQL standard defines three **read anomalies**.

## Dirty read

Reading data that another transaction has **not committed**, and may roll back.

```plaintext
T1: UPDATE users SET address='New St' WHERE id=7
T2:                                      SELECT address … → 'New St'   ← dirty
T1: ROLLBACK                              (the value never officially existed)
```

## Non-repeatable read (fuzzy read)

Reading the **same row twice** in one transaction and getting **different values**, because another transaction changed it and committed in between.

```plaintext
T1: SELECT balance FROM acc WHERE id=1  → 100
T2:                     UPDATE acc SET balance=50 WHERE id=1; COMMIT
T1: SELECT balance FROM acc WHERE id=1  → 50    ← changed under T1
```

## Phantom read

Running the **same range query twice** and getting a **different set of rows**: new rows appeared, or rows vanished.

```plaintext
T1: SELECT count(*) FROM orders WHERE day='2026-10-22'  → 10
T2:                     INSERT INTO orders (day…) VALUES ('2026-10-22'…); COMMIT
T1: SELECT count(*) FROM orders WHERE day='2026-10-22'  → 11   ← a phantom
```

| Anomaly | Affects | Caused by another transaction's |
|---|---|---|
| Dirty read | One row | Uncommitted change |
| Non-repeatable read | One row | Committed update or delete |
| Phantom read | A **range** of rows | Committed insert or delete |

@subtopic Write anomalies
@summary Lost updates, dirty writes and write skew.

## Lost update

Two transactions **read the same value**, both compute a new value, and **both write**. The second write silently **overwrites** the first.

```plaintext
T1: read stock = 10            T2: read stock = 10
T1: write stock = 10 - 3 = 7
T1: COMMIT                     T2: write stock = 10 - 5 = 5
                               T2: COMMIT       → stock = 5, T1's sale is lost (should be 2)
```

Fixes: `UPDATE … SET stock = stock - 5` (an atomic update), `SELECT … FOR UPDATE`, optimistic version checks, or an isolation level that detects it.

## Dirty write

A transaction **overwrites** a value that another transaction wrote but **hasn't committed**: its result is built on data that may never officially exist. Practically every database prevents this, at every isolation level.

## Write skew

Each transaction keeps the rules **on its own**, but **together** they break them.

Rule: accounts **A1 + A2 ≥ 0**. A1 = 100, A2 = 150, so the total is 250.

```plaintext
T1: reads A1+A2 = 250 → withdraw 200 from A1 is OK   → A1 = -100
T2: reads A1+A2 = 250 → withdraw 200 from A2 is OK   → A2 = -50
both commit → A1 + A2 = -150   ← rule broken
```

They wrote **different rows**, so no write-write conflict is detected. Write skew is possible under **snapshot isolation**.

> **Classic example:** two doctors on call each check "is someone else on call?" (yes), and each takes themselves off call. Nobody is left on call.

@subtopic The standard isolation levels
@summary Read uncommitted, read committed, repeatable read and serializable, and the anomalies each allows.

The SQL standard defines four levels, from weakest to strongest:

| Isolation level | Dirty read | Non-repeatable read | Phantom read | Lost update | Write skew |
|---|---|---|---|---|---|
| **Read uncommitted** | possible | possible | possible | possible | possible |
| **Read committed** | prevented | possible | possible | possible | possible |
| **Repeatable read** | prevented | prevented | possible | prevented | possible |
| **Serializable** | prevented | prevented | prevented | prevented | prevented |
| *Snapshot isolation* (non-standard) | prevented | prevented | prevented | prevented | **possible** |

## In words

- **Read uncommitted:** you can see others' uncommitted changes.
- **Read committed:** you only see **committed** data, but each statement may see newer data than the previous one.
- **Repeatable read:** rows you've read **won't change** under you, but new rows may still appear in ranges (phantoms) in the standard's definition.
- **Serializable:** the result is as if transactions ran **one at a time**.

> Serializability doesn't impose any **particular** order. Transactions that don't depend on each other can run in any order, or in parallel. It only guarantees the outcome matches **some** serial order.

@subtopic Isolation in real databases
@summary Default levels, and what "repeatable read" or "serializable" actually mean in each product.

Product implementations don't map neatly onto the standard. Know your database:

| Database | Default level | Notes |
|---|---|---|
| **PostgreSQL** | Read committed | *Repeatable read* is **snapshot isolation** (no phantoms either). *Serializable* is **SSI** (Serializable Snapshot Isolation): truly serializable, may abort transactions with a serialization failure (SQLSTATE `40001`), which the application must **retry**. |
| **MySQL InnoDB** | **Repeatable read** | Plain `SELECT`s read a consistent snapshot; `SELECT … FOR UPDATE`/`FOR SHARE` and DML use **next-key (gap) locks** to stop phantoms. Lost updates are **not** detected for plain read-then-write patterns; use locking reads. |
| **Oracle** | Read committed | *Serializable* is really **snapshot isolation**: write skew is possible; a conflicting update raises `ORA-08177`. There is no read uncommitted. |
| **SQL Server** | Read committed (locking) | Optional `READ_COMMITTED_SNAPSHOT` (row versioning) and a `SNAPSHOT` level. |

```sql
-- check and change the level
SHOW transaction_isolation;                              -- PostgreSQL
SELECT @@transaction_isolation;                          -- MySQL
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;            -- per transaction (all)
```

> **DBA takeaway:**
> - Applications that move from MySQL (repeatable read) to PostgreSQL (read committed) can behave differently.
> - At serializable (or under snapshot isolation conflicts), the application **must retry** on serialization errors.

@subtopic Snapshot isolation
@summary Each transaction reads a frozen snapshot; first committer wins on conflicting writes.

Many databases use **snapshot isolation (SI)**, usually built on MVCC (see *Concurrency control techniques*).

## How it works

- At start, a transaction gets a **snapshot**: it sees all changes **committed before it began**, and none after.
- All its reads use that snapshot, so the data **never changes under it**.
- At commit, if another transaction has **already committed a change to the same rows**, this transaction is **aborted** (**first committer wins**) and should retry.

## What it prevents and allows

| Anomaly | Under snapshot isolation |
|---|---|
| Dirty, non-repeatable and phantom reads | Prevented (the snapshot is fixed) |
| Lost update | Prevented (conflicting writes: one aborts) |
| **Write skew** | **Possible**: the transactions write **different** rows, so no conflict is detected |

## Fixing write skew

- Use a truly **serializable** level (PostgreSQL SSI tracks read/write dependencies and aborts one transaction).
- Or **materialize the conflict**: lock the rows the rule depends on (`SELECT … FOR UPDATE` on both accounts), or add a constraint the database can check.

@topic Concurrency control techniques
@summary Optimistic control, MVCC, timestamp ordering, two-phase locking and deadlocks.

This topic looks at the main techniques in turn:

| Technique | Blocks? | Typical use |
|---|---|---|
| Optimistic concurrency control | No; validates at commit | Low-conflict workloads, app-level version checks |
| MVCC | Readers don't block writers | PostgreSQL, InnoDB, Oracle, SQL Server snapshot levels |
| Timestamp ordering | No locks; aborts late operations | Some research and distributed systems |
| Two-phase locking | Yes | Locking reads, writes, serializable in many systems |

Then deadlocks: what they are, and how databases detect or avoid them.

@subtopic Optimistic concurrency control
@summary Work privately, validate at the end, then write, and retry on conflict.

**Optimistic concurrency control (OCC)** assumes conflicts are **rare**. Instead of locking, it lets transactions run and checks at the end.

## Three phases

| Phase | What happens |
|---|---|
| **1. Read** | The transaction runs in a **private workspace**. Nothing is visible to others. It records its **read set** (what it read) and **write set** (what it will change). |
| **2. Validate** | Check for conflicts with other transactions: did someone change data this transaction read, or write values it is about to overwrite? If so, **discard and restart**. |
| **3. Write** | No conflicts, so **apply** the write set to the database. |

Validation and write must happen **atomically**: no other transaction may commit while one is being validated. Both phases are short compared with the read phase, so this short critical section is acceptable.

## Backward-oriented validation

When checking a transaction T2 against an already committed transaction T1, T2 may commit if any of these holds:

1. T1 **committed before** T2's read phase began.
2. T1 committed before T2's write phase, and T1's **write set doesn't overlap T2's read set**.
3. T1's read phase finished before T2's, and T2's **write set doesn't overlap** T1's read or write sets.

> **When OCC fits:** low contention. Under heavy contention, transactions keep failing validation and **retrying**, which wastes work.
>
> **In practice:** application-level optimistic locking is the same idea: `UPDATE item SET qty = ?, version = version + 1 WHERE id = ? AND version = ?`, and treat "0 rows updated" as a conflict.

@subtopic Multiversion concurrency control (MVCC)
@summary Keep several versions of each row so readers never block writers.

**MVCC** keeps **multiple versions** of a record, tagged with transaction ids or timestamps. Readers see the **version that matches their snapshot**, while writers create **new versions**.

- **Readers don't block writers, and writers don't block readers.**
- The last **committed** version is the current one. Usually at most **one uncommitted** version exists at a time.
- MVCC is the usual way to implement **snapshot isolation**. Write-write conflicts are still resolved with validation, timestamps or locks.

## How major databases store versions

| Database | Where old versions live | Cleanup | Classic problem |
|---|---|---|---|
| **PostgreSQL** | **In the table** itself: each row version has `xmin`/`xmax` transaction ids | `VACUUM` / autovacuum | **Bloat** when vacuum can't keep up; **transaction ID wraparound** if vacuuming is neglected |
| **MySQL InnoDB** | Newest version in the table; older versions rebuilt from **undo logs** | Purge threads | Growing **history list length** caused by long transactions |
| **Oracle** | Newest version in the block; older versions rebuilt from **undo segments** | Undo retention | **`ORA-01555: snapshot too old`** when the needed undo was overwritten |

> **The one rule that applies everywhere:** a **long-running transaction** (or an idle session holding a snapshot) forces the database to **keep every old version** created since it started. Monitor and kill forgotten transactions:
>
> - PostgreSQL: `pg_stat_activity` (`xact_start`, state `idle in transaction`); set `idle_in_transaction_session_timeout`.
> - MySQL: `information_schema.innodb_trx`; `SHOW ENGINE INNODB STATUS` → "History list length".

@subtopic Timestamp ordering
@summary A lock-free pessimistic scheme: operations that arrive too late are aborted.

**Timestamp ordering** gives each transaction a **timestamp** at start, and allows operations only if they respect timestamp order. It is pessimistic (it checks conflicts as it goes) but uses **no locks**.

For every value, the database tracks:

- `max_read_timestamp`: the latest timestamp that **read** it
- `max_write_timestamp`: the latest timestamp that **wrote** it

## The rules

| Operation by transaction T | Condition | Result |
|---|---|---|
| **Read** | T's timestamp < `max_write_timestamp` | **Abort** T: a newer value already exists |
| **Write** | T's timestamp < `max_read_timestamp` | **Abort** T: a newer transaction already read the old value |
| **Write** | T's timestamp < `max_write_timestamp` | **Skip the write** (it's already outdated): the **Thomas Write Rule** |
| Otherwise | | Allow it, and update the max timestamps |

An aborted transaction restarts with a **new** timestamp; with the old one it would just be aborted again.

@subtopic Two-phase locking (2PL)
@summary Acquire locks while growing, release them while shrinking, never both.

**Two-phase locking (2PL)** is the most widely used **lock-based** technique. Each transaction's locking has two phases:

![A transaction's lock count rising in the growing phase and falling in the shrinking phase](img:c5-2pl)

| Phase | Rule |
|---|---|
| **Growing** (expanding) | Acquire locks as needed. **Release none.** |
| **Shrinking** | Release locks. **Acquire none.** |

The key rule: **once a transaction releases any lock, it may not acquire another.** This guarantees serializable schedules.

Transactions still do their work in both phases; 2PL only restricts **when locks** may be taken or released. Variants:

- **Strict 2PL** (what databases really use): exclusive locks are held **until commit or abort**, so no one reads uncommitted data.
- **Conservative 2PL**: take **all** locks before starting, or abort.

> **Don't confuse:** two-phase **locking** (concurrency control on one node) is unrelated to two-phase **commit** (agreeing on commit across several nodes).

## Lock types

| Lock | Allows others to | Example |
|---|---|---|
| **Shared (S)** | Read, not write | `SELECT … FOR SHARE` |
| **Exclusive (X)** | Neither read (with locks) nor write | `UPDATE`, `SELECT … FOR UPDATE` |

The downside of locks: **contention** and **deadlocks**.

@subtopic Deadlocks
@summary Two transactions waiting for each other forever, and how databases detect or avoid it.

A **deadlock** happens when transactions each **hold a lock the other needs**, so neither can continue.

![Two transactions waiting for each other's locks](img:c5-deadlock)

## Handling deadlocks

| Approach | How | Trade-off |
|---|---|---|
| **Timeouts** | Abort a transaction that waits too long | Simple, but slow to react, and aborts innocent slow transactions |
| **Conservative 2PL** | Take all locks up front | Limits concurrency |
| **Detection** | Keep a **waits-for graph** (T1 → T2 means "T1 waits for T2"); a **cycle** means deadlock. Abort one transaction (often the newer one). | Most common |
| **Avoidance** with timestamps | Older transactions (lower timestamp) have priority | Some unnecessary aborts |

## Avoidance schemes

T1 wants a lock held by T2:

| Scheme | If T1 is **older** | If T1 is **younger** |
|---|---|---|
| **Wait-die** | T1 waits | T1 **dies** (aborts and restarts) |
| **Wound-wait** | T1 **wounds** T2 (aborts T2) | T1 waits |

> **In practice:**
> - **MySQL:** deadlock detection is on (`innodb_deadlock_detect`); the victim gets error 1213. See the last one with `SHOW ENGINE INNODB STATUS\G` (section "LATEST DETECTED DEADLOCK"); log all with `innodb_print_all_deadlocks = ON`. Lock waits time out after `innodb_lock_wait_timeout` (50 s).
> - **PostgreSQL:** checks for a deadlock after waiting `deadlock_timeout` (1 s); the details go to the server log.
> - **Oracle:** `ORA-00060: deadlock detected`, with a trace file.
>
> **Prevention tip:** make all code paths lock rows **in the same order** (for example by primary key), and keep transactions short.

@topic Locks and latches in B-Trees
@summary Logical locks protect data for transactions; physical latches protect pages for threads.

So far, locks protected **data** for **transactions**. But the B-Tree itself (its pages and structure) must also be protected while many threads read and change it.

| | **Lock** | **Latch** |
|---|---|---|
| Protects | **Logical** data: keys, ranges, rows | **Physical** structure: page contents, the tree shape |
| Held by | A transaction | A thread |
| Held for | The **whole transaction** | As **short** as possible (one page read or update) |
| Managed by | The lock manager, outside the tree | The tree code, on each page |
| Deadlocks | Detected by the database | Must be **avoided by design** (lock ordering) |
| Systems programming name | — | Usually called a "lock" or mutex |

Even lock-free concurrency control schemes still need **latches** to keep pages physically consistent.

@subtopic Readers-writer latches
@summary Many readers or one writer per page.

Three kinds of overlap can happen on a page:

1. **Concurrent reads:** several threads read the same page.
2. **Concurrent updates:** several threads change the same page.
3. **Reading while writing:** one thread changes the page while another reads it.

Background maintenance (vacuum, compaction) is just another participant in these overlaps.

Concurrent reads are harmless, so a plain exclusive latch is too strict. A **readers-writer (RW) latch** allows:

| Holder → / Requester ↓ | Reader | Writer |
|---|---|---|
| **Reader** | ✅ shared | ❌ wait |
| **Writer** | ❌ wait | ❌ wait |

Many readers can share a page; a writer needs it **alone**.

## Waiting efficiently

- **Blocking:** the waiting thread sleeps and is woken up by the scheduler.
- **Busy-wait (spinning):** the thread loops briefly, which is faster for very short waits.
- **Queue-based spinlocks** (MCS locks): each waiter spins on its **own** variable in a queue, which avoids CPU cache traffic.

> **In practice:** this is where "latch contention" comes from. InnoDB reports semaphore waits on `rw-lock`s in `SHOW ENGINE INNODB STATUS`; PostgreSQL shows `LWLock` wait events such as `BufferContent` in `pg_stat_activity`; Oracle shows `latch:` and `buffer busy waits` wait events.

@subtopic Latch crabbing
@summary Hold the parent's latch only until you know the child won't change it.

The naive approach latches **every page from root to leaf** and holds them all, so the root becomes a bottleneck. **Latch crabbing** (latch coupling) moves down the tree like a crab: grab the child, then let go of the parent **as soon as it's safe**.

![Latch crabbing during an insert](img:c5-crabbing)

## When can the parent be released?

| Operation | Release the parent latch when… |
|---|---|
| **Read** | As soon as the child's latch is acquired |
| **Insert** | The child is **not full**, so a split can't propagate up |
| **Delete** | The child has **enough entries**, so a merge can't propagate up |

This is **optimistic**: most inserts and deletes don't cause splits or merges, and the higher the level, the rarer they are. Usually only the **leaf** stays latched.

## Related tricks

- **Latch upgrading:** descend with **shared** latches, take an exclusive latch only at the leaf, and **upgrade** the parent's latch only if a split or merge is needed.
- **Optimistic root:** the root splits last of all, so it can be latched optimistically; the rare retry is cheap.
- If a child page isn't in the cache, the thread can **release the parent and restart** the descent once the page is loaded, instead of holding latches during disk I/O.

@subtopic B-link trees
@summary High keys and sibling links let readers continue safely through a half-finished split.

**B-link trees** (Lehman and Yao, 1981) add two things to every node:

- a **high key**: the largest key the node may hold (Chapter 4)
- a **right-sibling link**

That allows a temporary **half-split** state: a new node is already reachable through its left sibling's **link**, but the parent doesn't point to it **yet**.

![A half-split: the new node is reachable by its sibling link before the parent is updated](img:c5-blink)

## How a reader handles it

1. Descend to a node as usual.
2. If the searched key is **greater than the node's high key**, the node must have split concurrently.
3. Follow the **sibling link** to the right and continue. No restart is needed: every key is still reachable.

## Why it is a big win

- The writer **doesn't hold the parent's latch** while splitting a child; the parent pointer is added **lazily** afterwards.
- Only a **constant number** of latches are held during a split.
- Readers can run **concurrently with structural changes**.
- It avoids deadlocks caused by changes climbing up to parents.

The cost is an occasional **extra page read** during a split, which is rare.

> **In practice:** PostgreSQL's B-Tree indexes are Lehman–Yao B-link trees. That is why every PostgreSQL index page has a **high key** and **right-link**, and why `pageinspect` shows them.

@topic Check yourself: Chapter 5
@summary Questions on buffers, logging, recovery, isolation and concurrency. Answers are below.

1. **Which ACID property depends most on the application, and why?**
2. **What is a dirty page, and when can it be evicted?**
3. **Why does a plain LRU cache suffer when someone runs a big report that scans a whole table? How do InnoDB and PostgreSQL protect against this?**
4. **State the write-ahead logging rule.**
5. **When exactly is a transaction considered committed?**
6. **What do checkpoints give you? What happens in PostgreSQL if `max_wal_size` is too small?**
7. **Almost every database uses a steal / no-force policy. What does that mean, and what does recovery then need?**
8. **Name the three phases of ARIES and what each does.**
9. **A transaction reads a balance twice and gets 100 then 50. Which anomaly is this, and which isolation level prevents it?**
10. **Two doctors both go off call because each saw the other was on call. Which anomaly is this, and which isolation level prevents it?**
11. **Why can a long-running transaction cause trouble in PostgreSQL, InnoDB and Oracle alike?**
12. **What is the difference between a lock and a latch?**
13. **In latch crabbing, when may an insert release the parent's latch?**

---

> **1.** Consistency: the database enforces only the constraints it knows about; the business rules belong to the application.
>
> **2.** A cached page whose contents differ from disk. It can be evicted only after it is flushed, and only when no thread references or pins it.
>
> **3.** A one-off scan pushes out all the hot pages. InnoDB inserts new pages at a midpoint ("old" sublist) and promotes them only on a later access; PostgreSQL reads large scans through a small ring buffer.
>
> **4.** A change must be written to the log on disk before the data page it modifies is written to disk.
>
> **5.** When the log has been forced to disk up to and including its commit record.
>
> **6.** They let old WAL be recycled and keep crash recovery short. If `max_wal_size` is too small, checkpoints happen too often, causing extra I/O and many full-page images, and a warning in the log.
>
> **7.** Steal: uncommitted changes may be flushed to disk. No-force: committed changes need not be flushed at commit. Recovery needs both undo and redo.
>
> **8.** Analysis (find dirty pages and active transactions), redo (repeat history up to the crash), undo (roll back uncommitted transactions, logging CLRs).
>
> **9.** A non-repeatable read. Repeatable read (or anything stronger) prevents it.
>
> **10.** Write skew. Only serializable prevents it in general; snapshot isolation does not.
>
> **11.** MVCC must keep all old row versions the transaction might still read: table bloat and blocked vacuum in PostgreSQL, a growing history list in InnoDB, and undo pressure and `ORA-01555` in Oracle.
>
> **12.** A lock protects logical data for a whole transaction and is managed by the lock manager. A latch protects a physical page for a very short time and is held by a thread.
>
> **13.** As soon as it has latched the child and seen that the child is not full, so a split can't propagate to the parent.
