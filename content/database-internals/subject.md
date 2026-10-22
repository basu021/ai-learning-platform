@summary How databases store, find, protect and recover data: storage engines, B-Trees, page formats, transactions, recovery and LSM Trees, explained for DBAs.
## About this course

This course explains **what happens inside a database**: the knowledge that turns "the database is slow" into a precise diagnosis.

It follows **Part I (Storage Engines)** of *Database Internals* by Alex Petrov (O'Reilly, 2019), rewritten as short study pages, with diagrams, tables and "In practice" notes for **MySQL, PostgreSQL and Oracle**.

| Chapter | You will learn |
|---|---|
| 1. Introduction and Overview | DBMS architecture, row vs column stores, data and index files |
| 2. B-Tree Basics | Why every index is a B-Tree, lookups, splits and merges |
| 3. File Formats | Encoding, slotted pages, checksums |
| 4. Implementing B-Trees | Overflow pages, right-only appends, bulk loading, vacuum |
| 5. Transaction Processing and Recovery | Buffer pools, WAL, checkpoints, ARIES, isolation, MVCC, locks |
| 6. B-Tree Variants | Copy-on-write, WiredTiger, Bw-Trees and more |
| 7. Log-Structured Storage | LSM Trees, compaction, Bloom filters, SSDs |

## How to study

1. Read one small page at a time (3–6 minutes) and **mark it as read**.
2. Finish each chapter with its **Check yourself** page.
3. Try the SQL snippets on a test server, never on production.

> For the full detail, read the book itself; these pages are study notes, not a replacement.
