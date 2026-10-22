@chapter 1. Introduction and Overview
@summary What a database is made of, how databases differ, and the vocabulary used in the rest of the course.

## Why this chapter matters

Before you can tune, troubleshoot or choose a database, you need a mental picture of what is inside one. This chapter gives you that picture and the words to talk about it.

Terms like *clustered index*, *column store* or *index-organized table* are used loosely in everyday conversation. Here we pin each one down, so the later chapters make sense.

## What you will learn

| Topic | The question it answers |
|---|---|
| Storage engines and choosing a database | What is a storage engine, and how do I pick a database without guessing? |
| DBMS architecture | Which parts handle a query, from the network to the disk? |
| Memory- vs disk-based databases | Why do some databases keep everything in RAM, and how do they stay durable? |
| Row vs column storage | Why is one database fast for orders and another fast for reports? |
| Data files and index files | How are rows and indexes laid out in files? What makes an index clustered? |
| Buffering, immutability and ordering | Which three design choices explain most storage engines? |

> **How to study:** each small page takes about 3–6 minutes. Mark it read when you finish, then try the *Check yourself* page at the end of the chapter.

@topic Storage engines and choosing a database
@summary The part of the database that actually stores bytes, and a practical way to choose a database.

A database exists so that applications can **store data safely and get it back quickly**, without every team writing its own storage code.

The piece that does the low-level work is the **storage engine**. Everything else in the database (SQL, permissions, the optimizer) is built on top of it.

This topic has two short pages:

1. **What a storage engine is**, and why many databases let you swap it.
2. **How to choose a database**, with benchmarks that help.

@subtopic What is a storage engine?
@summary The low-level component that stores, reads, updates and deletes data.

## Storage engine in one line

A **storage engine** (also called a *database engine*) is the part of the database that saves, reads, updates and deletes data in memory and on disk.

At its level, keys and values are mostly **just bytes**. The database adds the "smart" layers on top:

- **schemas** and data types
- a **query language** such as SQL
- **indexes**, permissions and **transactions**

## Pluggable engines

Many storage engines are built as separate libraries and plugged into a database. Some databases let you choose the engine per table or per server.

| Database | Engines you can use |
|---|---|
| MySQL / MariaDB | InnoDB (default), MyISAM, MyRocks (RocksDB), Memory, Aria (MariaDB) |
| MongoDB | WiredTiger (default), In-Memory |
| Many others embed | RocksDB, LevelDB, LMDB, BerkeleyDB, SQLite |

> **In practice (MySQL):** `SHOW ENGINES;` lists the engines your server supports, and `SHOW TABLE STATUS LIKE 'orders';` shows which engine a table uses. Almost everything in production today should be **InnoDB**: it has crash recovery and row-level locking; MyISAM has neither.

```sql
SHOW ENGINES;
SELECT table_name, engine FROM information_schema.tables WHERE table_schema = 'shop';
```

## Why a DBA should care

The engine decides how data sits on disk, how much memory it needs, how it recovers after a crash and how it behaves under concurrent writes. Most "mysterious" performance problems become clear once you know how the engine works. That is what Part I of this course is about.

@subtopic How to choose a database
@summary Define the workload, test it for real, and value reliability over raw speed.

Moving to a different database later is slow and risky, so spend time on the choice up front.

## Don't choose by

- popularity rankings
- the programming language it is written in
- a list of features on the website

These give only a rough picture. Two databases with the same feature list can behave very differently under *your* workload.

## Do this instead

1. **Write down the goal.** What problem should the database solve?
2. **Describe the workload:** data size today and in two years, number of users, read/write ratio, query types (point lookups, ranges, reports), latency targets.
3. **Ask hard questions:** Can it handle these queries and this volume? How many nodes will it need? How does it scale? How hard is it to back up, upgrade and monitor?
4. **Simulate your real workload** on a test setup, ideally for days, not minutes. Some problems (compaction storms, bloat, memory growth) only show up later.
5. **Check how easy it is to operate and debug**, and how helpful the community and documentation are.
6. **Skim the source code or internals docs.** It helps you understand logs, settings and bugs later.

> **Key idea:** reliability beats speed. A slower database that never loses your data is better than a fast one that does.

## Benchmarks that help

| Benchmark | What it measures | Good for |
|---|---|---|
| **YCSB** (Yahoo! Cloud Serving Benchmark) | Throughput and latency of simple read/write/scan operations, with configurable workloads | Comparing key-value and NoSQL stores. Tune the workload to match yours, or the result can mislead you. |
| **TPC-C** | Transactions per minute for an order-processing (OLTP) system with warehouses, stock, customers and orders; ACID is required | Comparing transactional databases |
| **sysbench** / **pgbench** | Simple OLTP tests for MySQL / PostgreSQL | Quick capacity checks and before/after comparisons on your own servers |

Benchmarks are not only for comparing products. Use them to **check an SLA** (latency, throughput), plan capacity, and test a **new version before you upgrade**: new releases fix bugs but can also bring regressions.

## Every engine is a trade-off

There is no engine that is best at everything. If there were, everyone would use it. Some are built for low write latency, some for low read latency, some to pack the most data per server, some for simple operations. Your job is to match the engine's strengths to your workload.

@topic DBMS architecture
@summary The journey of a query: transport, query processor, execution engine and storage engine.

Every database is built a little differently, and in real code the boundaries between parts are blurry. Still, almost all of them share the same main building blocks.

![The main parts of a database management system](img:c1-architecture)

Databases use a **client/server** model: your application is the client, and each database instance (a *node*) is a server.

This topic follows a query through the system in two pages:

1. **From request to plan:** transport, parser and optimizer.
2. **Inside the storage engine:** the five managers that do the real work.

@subtopic From request to execution plan
@summary How a query is received, checked, optimized and turned into a plan.

## 1. Transport subsystem

Client requests arrive here, usually as a query in some language (SQL, a JSON query, a key lookup). The transport layer also handles **communication with other nodes** in a cluster, for example for replication.

## 2. Query processor

The query processor **parses** the query, makes sure it is valid and works out what it refers to. Only after that can **access control** be checked, because the database must know which tables and columns are touched.

## 3. Query optimizer

The optimizer looks for the **cheapest way** to run the query:

- removes impossible or redundant parts (for example `WHERE 1 = 0`)
- estimates how many rows each step returns, using **statistics** (index cardinality, value distribution)
- chooses **access methods**: full scan or index, which index, join order and join method
- in a cluster, also considers **where the data lives** and the cost of moving it

The result is an **execution plan** (query plan): an ordered list of operations. The same query can have many valid plans with very different costs. The optimizer picks the one it *thinks* is best, and it can only be as good as its statistics.

> **In practice:** this is why stale statistics cause slow queries. Refresh them with `ANALYZE TABLE t;` (MySQL), `ANALYZE t;` (PostgreSQL) or `DBMS_STATS.GATHER_TABLE_STATS` (Oracle), and read plans with `EXPLAIN` / `EXPLAIN ANALYZE`.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 10;
```

## 4. Execution engine

The execution engine **runs the plan** and collects the results. Parts of the plan may run on other nodes (remote execution), for example reading a partition stored elsewhere. Local operations are handed to the storage engine.

@subtopic Inside the storage engine
@summary Transaction, lock, buffer and recovery managers, plus access methods.

The storage engine executes local operations. It is made of several managers, each with one job.

| Component | Job | Covered in |
|---|---|---|
| **Transaction manager** | Schedules transactions and makes sure they never leave the database logically inconsistent | Chapter 5 |
| **Lock manager** | Locks database objects for running transactions so concurrent work does not corrupt data | Chapter 5 |
| **Access methods** (storage structures) | Organize data on disk: heap files, B-Trees, LSM Trees | Chapters 2, 4, 6, 7 |
| **Buffer manager** | Caches data pages in memory | Chapter 5 |
| **Recovery manager** | Keeps the operation log and restores a correct state after a crash | Chapter 5 |

Together, the **transaction manager and lock manager** provide **concurrency control**: many sessions can work at the same time, and the result is still correct.

> **In practice:** you can see these managers at work. In MySQL, `SHOW ENGINE INNODB STATUS\G` shows the buffer pool, lock waits, the log and recent deadlocks. In PostgreSQL, look at `pg_stat_activity`, `pg_locks` and `pg_stat_bgwriter`.

@topic Memory- vs disk-based databases
@summary Why some databases keep all data in RAM, and how they still survive a crash.

Every database uses both memory and disk. The difference is **which one holds the data**.

| | In-memory (main memory) DBMS | Disk-based DBMS |
|---|---|---|
| Primary copy of data | RAM | Disk (SSD/HDD) |
| Disk used for | Logging and recovery | Everything; memory is a cache |
| Typical examples | Redis, VoltDB, SAP HANA, MySQL Cluster (NDB) | MySQL InnoDB, PostgreSQL, Oracle, SQL Server |
| Main limits | Cost of RAM, durability | Slower random access |

Two short pages follow: why memory is attractive, and how in-memory databases stay durable.

@subtopic Why keep data in memory?
@summary Speed and simpler code, against cost and volatility.

## Memory is much faster

Reading memory is several **orders of magnitude** faster than reading a disk. The chart uses a log scale: every grid line is 1,000 times slower than the one below it.

![Rough access latency of memory and storage devices](img:c1-latency)

## Memory is easier to program

The operating system manages memory for you: you allocate a chunk and follow pointers. On disk, the engine has to manage everything itself: serialization formats, references between pages, free space and fragmentation.

So in-memory databases can use data structures that would be too slow or too complex on disk. Disk-based engines prefer **wide, short trees** (like B-Trees) that need few disk reads.

## Why not put everything in memory?

- **Cost:** RAM is still much more expensive per GB than SSD or HDD.
- **Volatility:** RAM is lost on a crash or power cut. Batteries and UPS help, but add hardware and operational work.

> **Not just a big cache:** a disk-based database with a huge buffer pool is *not* the same as an in-memory database. Even when every page is cached, the data still uses the on-disk page format, with its overhead.

Some datasets naturally fit in memory: they are bounded by something in the real world, like students of a school or products in a shop.

**Non-volatile memory (NVM)** may change this picture: it keeps data after power loss, reads and writes at similar speed, and is byte-addressable.

@subtopic Durability in memory-based stores
@summary Write-ahead log, background snapshots and checkpoints.

An in-memory database still has to survive a crash. It does this with the disk, but **off the hot path**.

1. **Log first.** Before an operation is acknowledged, it is appended to a sequential **log file** on disk. Sequential appends are fast.
2. **Keep a backup copy.** A sorted copy of the data is kept on disk. It is updated **asynchronously, in batches**, so clients don't wait for it.
3. **Checkpoint.** After a batch of log records is applied to the backup, the backup is a snapshot of a known point in time. The log up to that point is no longer needed and can be discarded.
4. **Recover.** After a crash, load the latest snapshot, then replay the log written after it.

```plaintext
time ───────────────────────────────────────────────────────────▶
 log:  [op1][op2][op3][op4][op5][op6][op7][op8]
                         ▲ checkpoint: snapshot includes op1..op4
 crash at op8 → load snapshot (op1..op4) + replay log op5..op8
```

Checkpointing **shortens recovery**: less log to replay, without blocking clients.

> **In practice:** Redis does exactly this. **AOF** (append-only file) is the log; **RDB** is the snapshot; `BGSAVE` and `BGREWRITEAOF` run in the background. Disk-based engines use the same ideas: InnoDB's redo log and checkpoints, PostgreSQL's WAL and `CHECKPOINT`. Chapter 5 covers them in detail.

@topic Row vs column storage
@summary The same table can be stored row by row or column by column, with very different performance.

A table is made of **rows** (records) and **columns** (fields of the same type). One value at a row/column crossing is a **field**.

Databases can split a table **horizontally** (store each row's values together) or **vertically** (store each column's values together).

![The same table in a row-oriented and a column-oriented layout](img:c1-row-column)

The next pages look at each layout, how to choose, and a common source of confusion: *wide column* stores.

@subtopic Row-oriented layout
@summary All fields of a record stored together: great for reading and writing whole records.

In a **row store**, every record is stored as one unit, close to how you picture a table:

| ID | Name | Birth date | Phone |
|---|---|---|---|
| 10 | John | 1981-08-01 | +1 111 222 333 |
| 20 | Sam | 1988-09-14 | +1 555 888 999 |
| 30 | Keith | 1984-01-07 | +1 333 444 555 |

## When it shines

- An application usually **reads the whole record** (show a user's profile).
- Records are **created together** (a user fills in a form).
- Fields can still be updated individually.

Disks are read in **blocks**, never single bytes. A block of a row store holds complete records, so one read returns the whole user. This is **spatial locality**: things used together are stored together.

## Where it hurts

Queries that need **one column from many rows** pay for all the other columns too. To list every phone number, the database reads names and birth dates as well, then throws them away.

> **Examples:** MySQL, PostgreSQL, Oracle, SQL Server and most traditional relational databases are row stores. They are built for **OLTP**: many short transactions, each touching a few rows.

@subtopic Column-oriented layout
@summary Each column stored separately: great for scans and aggregates over a few columns.

In a **column store**, all values of one column are stored together. Logically the table is unchanged:

| ID | Symbol | Date | Price |
|---|---|---|---|
| 1 | DOW | 2018-08-08 | 24,314.65 |
| 2 | DOW | 2018-08-09 | 24,136.16 |
| 3 | S&P | 2018-08-08 | 2,414.45 |
| 4 | S&P | 2018-08-09 | 2,232.32 |

Physically it is stored like this:

```plaintext
Symbol: 1:DOW;  2:DOW;  3:S&P;  4:S&P
Date:   1:2018-08-08; 2:2018-08-09; 3:2018-08-08; 4:2018-08-09
Price:  1:24314.65;   2:24136.16;   3:2414.45;    4:2232.32
```

## When it shines

Analytical queries such as "average price per symbol over 10 years" read **only the columns they need**, in one sequential pass.

## Putting rows back together

Joins and filters across columns need to know which values belong to the same row. Two options:

- store the **key with every value**: simple, but duplicates data
- use the **position** (offset) as an implicit row id: value number 3 in each column belongs to row 3. Most column stores do this.

> **Examples:** ClickHouse, Vertica (from C-Store), MonetDB, Apache Kudu, Amazon Redshift, Snowflake, BigQuery. File formats: **Parquet** and **ORC**. Oracle's In-Memory Column Store and MySQL HeatWave add a columnar copy to a row store.

@subtopic Choosing a layout
@summary Match the layout to the access pattern; column stores also compress and vectorize better.

Layout is not the only difference. Storing a column together enables extra optimizations:

- **Better CPU use.** Values of one column sit next to each other in memory, so CPU caches work well, and **vectorized (SIMD)** instructions process many values with one instruction.
- **Better compression.** Values of the same type compress far better together. Each column can use its own method: run-length encoding for repeated symbols, delta encoding for dates, dictionary encoding for strings.

## Decision table

| Your workload | Better fit |
|---|---|
| Point lookups by key, small range scans | Row store |
| Reads and writes of whole records | Row store |
| Many short transactions (OLTP) | Row store |
| Scans over millions of rows | Column store |
| Aggregates over a few columns (`SUM`, `AVG`, `GROUP BY`) | Column store |
| Reporting and data warehousing (OLAP) | Column store |

> **OLTP, OLAP, HTAP:** OLTP databases handle many short user-facing transactions. OLAP databases handle long, complex analytical queries. HTAP systems try to do both, often by keeping a row copy and a column copy of the same data.

@subtopic Wide column stores are not column stores
@summary BigTable, HBase and Cassandra group columns into families and store rows inside each family.

The names are confusing: **wide column stores** such as Google BigTable, Apache HBase and Apache Cassandra are **not** column-oriented in the sense of the last pages.

A wide column store is a **sorted, multidimensional map**:

```plaintext
row key ──▶ column family ──▶ column qualifier ──▶ timestamp ──▶ value

"com.cnn.www"
   contents:  html        @t3 → "<html>…v3"
                          @t2 → "<html>…v2"
   anchor:    cnnsi.com   @t9 → "CNN"
              my.look.ca  @t8 → "CNN.com"
```

This is the **Webtable** example from the BigTable paper: rows are web pages keyed by **reversed URL** (so pages of one domain sort together), and each cell keeps several **versions** by timestamp.

## How it is stored

- **Column families** (`contents`, `anchor`) are stored **separately**.
- **Inside a family, data is stored row by row**: everything for one row key is together.

| | Column store | Wide column store |
|---|---|---|
| Unit stored together | One column | One row within a column family |
| Best for | Scans and aggregates | Fetching data by key or key range |
| Examples | ClickHouse, Vertica, Parquet | BigTable, HBase, Cassandra |

@topic Data files and index files
@summary How a database lays out records in files, and how indexes find them.

Databases do store data in files, but not as loose text files in folders. They use their **own file formats**, because those give:

- **Storage efficiency:** little overhead per record
- **Access efficiency:** find a record in as few steps as possible
- **Update efficiency:** change as little on disk as possible

Usually each table has **data files** (the records) and **index files** (metadata to find records). Both are split into **pages**, which are one or a few disk blocks in size.

Deletes and updates are often not done in place: many engines write a **deletion marker (tombstone)** or a new version, and a later **garbage collection** step copies live records to a new place and drops the old ones.

@subtopic Data files: heap, hash and index-organized
@summary Three ways to organize the records of a table on disk.

The data file (also called the **primary file**) can be organized in three ways:

| Organization | How records are placed | Finding a record | Example |
|---|---|---|---|
| **Heap file** | Any order, usually in insert order | Needs a separate index that points to record locations | PostgreSQL tables, Oracle heap tables, SQL Server heaps |
| **Hashed file** | In buckets chosen by a hash of the key | Hash the key, read the bucket | Hash clusters (Oracle), hash partitions |
| **Index-organized table (IOT)** | Inside the index itself, in key order | Search the index: the record is in the leaf | MySQL InnoDB tables, Oracle IOTs, SQL Server clustered tables |

## Why index-organized tables are popular

- Records are stored **in key order**, so a **range scan** is just reading consecutive leaves.
- After the index finds the key, the record is right there: at least **one disk read fewer** than going to a separate data file.

## What an index entry holds

- In a **heap** design, the index stores a pointer to the record, such as a file offset or **row locator** (PostgreSQL's `ctid`, Oracle's `ROWID`).
- In an **IOT**, the index entry *is* the record.

> **In practice:** every InnoDB table is index-organized on its primary key. If you don't define one, InnoDB uses the first `NOT NULL UNIQUE` index, or adds a hidden 6-byte row id. Always define a short, stable primary key.

@subtopic Index files: primary, secondary, clustered
@summary Getting the four most-confused index terms straight.

An **index** is a structure that maps keys to where records are stored, so the database does not scan the whole table.

| Term | Meaning |
|---|---|
| **Primary index** | Index on the primary data file, usually on the **primary key**. One entry per key. |
| **Secondary index** | Any other index. Can have **several entries per key** (for example many orders per `customer_id`). |
| **Clustered index** | Records are stored **in the same order as the index keys**. |
| **Nonclustered index** | Record order does **not** follow the index order. |

Rules that follow from these definitions:

- An **index-organized table is clustered by definition**.
- **Primary indexes are usually clustered.**
- **Secondary indexes are nonclustered by definition**: the rows can only be sorted one way.

> **In practice:**
> - MySQL InnoDB: the primary key is the clustered index. Every secondary index leaf stores the **primary key value** of the row.
> - PostgreSQL: all tables are heaps; all indexes are secondary and point to a `ctid`. `CLUSTER` reorders the table once, but the order is not maintained.
> - SQL Server: you choose one clustered index per table; the rest are nonclustered.

@subtopic Primary index as indirection
@summary Should secondary indexes point straight at the row, or at its primary key?

When a secondary index finds a key, how does it reach the row? There are two designs.

![Direct pointers versus going through the primary index](img:c1-indirection)

| | (a) Direct pointer (offset, `ctid`, `ROWID`) | (b) Primary key as pointer |
|---|---|---|
| Read path | One lookup: secondary index → row | Two lookups: secondary index → primary index → row |
| When a row moves | **Every** index pointing to it must be updated | Nothing changes: the primary key is stable |
| Good for | Read-heavy workloads, few indexes | Write-heavy workloads, many indexes |
| Example | PostgreSQL, Oracle heap tables | MySQL InnoDB |

A **hybrid** is also possible: store both the offset and the primary key. Try the offset first; if the row has moved, fall back to the primary index and fix the stored offset.

> **DBA takeaway:** in InnoDB, a long primary key (say a 36-character UUID string) is copied into **every** secondary index, making them all bigger. In PostgreSQL, updating any indexed column writes new entries into every index, unless the update qualifies as a **HOT** update (no indexed column changed and the new version fits on the same page).

@topic Buffering, immutability and ordering
@summary Three design choices that explain most differences between storage engines.

A storage engine is built on a data structure, but the structure alone does not explain how it caches, recovers or handles transactions.

Almost every difference between storage structures in this course comes from **three choices**:

| Choice | Question | One end | Other end |
|---|---|---|---|
| **Buffering** | Collect changes in memory before writing them to disk? | Write each change at once | Batch many changes in memory, write them together |
| **Mutability** | Overwrite data in place, or only append? | **Mutable**: read a page, change it, write it back to the same place | **Immutable**: never modify written data; append new versions or copy-on-write |
| **Ordering** | Keep records sorted by key on disk? | **Ordered**: efficient range scans | **Unordered** (insert order): faster writes, but no cheap range scans |

## Where common structures sit

| Structure | Buffering | Mutability | Ordering | Chapter |
|---|---|---|---|---|
| Classic B-Tree (InnoDB, PostgreSQL indexes) | Minimal | Mutable (in place) | Ordered | 2, 4 |
| Copy-on-write B-Tree (LMDB) | Minimal | Immutable pages | Ordered | 6 |
| Lazy B-Tree (WiredTiger) | Buffered per node | Mutable | Ordered | 6 |
| Bw-Tree | Delta updates | Immutable (append deltas) | Ordered | 6 |
| LSM Tree (RocksDB, Cassandra) | Buffered (memtable) | Immutable files | Ordered | 7 |
| Bitcask, WiscKey | Buffered | Append-only | Unordered values | 7 |

Every block on disk is written as a whole, so all engines buffer *a little*. Here, "buffering" means **choosing** to collect more data in memory to make writes cheaper.

Keep this table in mind. Each later chapter adds detail to one of these rows.

@topic Check yourself: Chapter 1
@summary Short questions to test what you learned. Answers are below each question.

Try to answer each question before reading the answer.

1. **What does the storage engine do, and what does the rest of the database add on top of it?**
2. **Why can stale statistics make a query slow?**
3. **Name the five components of a storage engine.**
4. **How does an in-memory database survive a crash?**
5. **A report sums sales by region over five years of data. Row store or column store? Why?**
6. **Is Apache Cassandra a column store?**
7. **What is the difference between a clustered and a nonclustered index? Can a secondary index be clustered?**
8. **Your InnoDB table uses a `VARCHAR(36)` UUID as its primary key and has six secondary indexes. Why are the indexes so large?**
9. **Name the three design choices that separate storage engines.**

---

> **1.** It stores, reads, updates and deletes data on disk and in memory. The database adds schemas, a query language, indexes, permissions and transactions on top.
>
> **2.** The optimizer picks a plan from estimated row counts. Wrong estimates lead to a bad plan, such as a full scan or the wrong join order.
>
> **3.** Transaction manager, lock manager, access methods, buffer manager, recovery manager.
>
> **4.** It logs every change to a sequential file before acknowledging it, keeps a snapshot on disk updated in the background, checkpoints, and replays the log after the last snapshot when it restarts.
>
> **5.** Column store: it reads only the region and amount columns, compresses them well and scans them quickly.
>
> **6.** No. It is a *wide column* store: column families are stored separately, but inside a family data is stored row by row and fetched by key.
>
> **7.** In a clustered index the records are stored in index key order; in a nonclustered index they are not. A secondary index is nonclustered by definition, because the rows can only be physically sorted one way.
>
> **8.** InnoDB secondary index entries store the primary key value as the pointer to the row, so the long key is copied into all six indexes.
>
> **9.** Buffering, mutability (immutability), and ordering.
