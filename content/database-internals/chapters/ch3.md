@chapter 3. File Formats
@summary How records become bytes, how bytes are packed into pages, and how pages stay readable and safe.

## Why this chapter matters

Chapter 2 drew B-Trees as boxes and arrows. On disk there are no boxes: there are **files of bytes**, read and written in **pages**. This chapter shows how a database turns rows into bytes and arranges them inside a page.

For a DBA this explains things you meet in practice:

- why a page holds fewer rows than you expect (headers, slot arrays, free space)
- why `UPDATE`s that make rows longer cause fragmentation
- why data files are not always portable between platforms (byte order)
- what **page checksums** are and why you want them on

## What you will learn

| Topic | The question it answers |
|---|---|
| Why file formats matter | Why can't a database just write objects to disk? |
| Binary encoding | How are numbers, strings and flags stored as bytes? |
| Page structure | How are variable-size rows packed into a fixed-size page? |
| Versioning and checksums | How does a database read old files and detect corruption? |

@topic Why file formats matter
@summary On disk there is no malloc: the engine must lay out, find and reuse every byte itself.

In memory, programs rarely think about layout. The operating system gives you memory when you ask, **virtual memory** hides physical addresses, and you follow pointers freely.

Disk is different. You only have **read** and **write** at an **offset** in a file, through system calls. So the storage engine must decide everything itself:

| In memory you get for free | On disk the engine must do itself |
|---|---|
| `malloc` / `free` for any size | Decide where each record goes inside fixed-size pages |
| Pointers | Store page numbers and offsets, and compute addresses |
| Garbage collection (in many languages) | Track and reuse freed space |
| No fragmentation worries | Fight fragmentation inside pages and files |
| Objects ready to use | **Serialize** to bytes on write, **deserialize** on read |

Writing a file format is a lot like programming in C without libraries: fixed-size structures, explicit allocation, and careful tracking of which space is free.

On-disk B-Trees are best thought of as a **page management system**: algorithms that create, find and rewrite pages, with pointers between them.

> **Good news:** these principles are not B-Tree specific. The same ideas are used for any file format, network protocol or log format.

@topic Binary encoding
@summary Storing numbers, strings, booleans and records as compact bytes.

Before rows can be packed into pages, each value needs a **binary representation**: compact, and quick to write (**serialize**) and read back (**deserialize**).

This topic builds up from the smallest pieces:

1. Numbers and byte order
2. Strings and other variable-size data
3. Booleans, enums and flags
4. Putting fields together into a record

@subtopic Numbers and byte order
@summary Fixed-size integers and floats, and why big- vs little-endian matters.

Most numeric types have a **fixed size**:

| Type | Size | Range / notes |
|---|---|---|
| byte | 1 byte (8 bits) | 0–255 or −128–127 |
| short | 2 bytes | ±32 thousand |
| int | 4 bytes | ±2.1 billion |
| long | 8 bytes | ±9.2 × 10¹⁸ |
| float | 4 bytes | IEEE 754: 1 sign bit, 8 exponent bits, 23 fraction bits |
| double | 8 bytes | IEEE 754 double precision |

Floating-point numbers are **approximations** (sign × fraction × 2^exponent). That is why money is stored as `DECIMAL`/`NUMERIC`, not `FLOAT`.

## Endianness: which byte comes first?

A multi-byte number can be written **most significant byte first** or **least significant byte first**. Writer and reader must agree.

![The number 0xAABBCCDD in big-endian and little-endian order](img:c3-endian)

| Byte order | First byte in memory | Used by |
|---|---|---|
| **Big-endian** | Most significant (`AA`) | Network protocols ("network byte order"), SPARC, IBM POWER (AIX) |
| **Little-endian** | Least significant (`DD`) | x86/x64, most ARM servers |

Engines like RocksDB check the platform byte order and **swap bytes** when the file's order differs.

> **DBA link:** byte order is why some data files cannot be copied between platforms. Oracle cross-platform **transportable tablespaces** between different-endian systems need a conversion step (`RMAN CONVERT`); check `V$TRANSPORTABLE_PLATFORM` for each platform's endian format.

@subtopic Strings and variable-size data
@summary Store the length first, then the bytes.

Numbers have a fixed size; strings, arrays and BLOBs do not. The common way to store them is **length-prefixed**:

```plaintext
String {
    size  uint16          // how many bytes follow
    data  byte[size]      // the bytes themselves
}
```

This is often called a **Pascal string** (or UCSD string). The alternative is a **null-terminated** string (C style): read bytes until a `\0`.

| | Length-prefixed | Null-terminated |
|---|---|---|
| Find the length | **Instant** (read the prefix) | Scan every byte |
| Can contain `\0` | Yes | No |
| Read into memory | Slice exactly `size` bytes | Search for the end first |

Databases almost always use length prefixes.

> **In practice:** this is why `VARCHAR` has a length overhead. In MySQL, a `VARCHAR` value uses **1 length byte** if the column's maximum byte length is ≤ 255, otherwise **2 bytes**. PostgreSQL's `varlena` values use a **1-byte header** for short values (up to 126 bytes) and a **4-byte header** for longer ones.

@subtopic Booleans, enums and flags
@summary Pack several yes/no values into the bits of one byte.

## Booleans

A boolean needs only **one bit**, so storing it in a whole byte wastes 7 bits. Formats often pack **8 booleans into one byte**. A `1` bit is **set**, a `0` bit is **unset**.

## Enums

An **enum** maps a small set of names to small integers. Perfect for repeated, low-cardinality values like a node type:

```c
enum NodeType {
    ROOT     = 0x00,
    INTERNAL = 0x01,
    LEAF     = 0x02
};
```

## Flags

**Flags** combine the two ideas: each bit of an integer is an independent yes/no option. Each flag uses a **power of two**, so it has exactly one bit set:

| Flag | Mask (hex) | Bits |
|---|---|---|
| `IS_LEAF` | `0x01` | `0000 0001` |
| `VARIABLE_SIZE_VALUES` | `0x02` | `0000 0010` |
| `HAS_OVERFLOW_PAGES` | `0x04` | `0000 0100` |

Set, clear and test flags with bitwise operators:

```c
flags |= HAS_OVERFLOW_PAGES;              // set the bit   (OR)
flags &= ~HAS_OVERFLOW_PAGES;             // clear the bit (AND NOT)
is_set = (flags & HAS_OVERFLOW_PAGES) != 0;  // test the bit
```

> **DBA link:** you meet packed flags in practice. PostgreSQL rows carry `t_infomask` bits (committed, invalid, updated…), visible with the `pageinspect` extension, and MySQL stores a table's `NULL` columns as a **null bitmap** in each row.

@subtopic Laying out a record
@summary Fixed-size fields first, then variable-size fields, inside a file with a header and trailer.

## The file

A typical data file looks like this:

```plaintext
┌────────────┬────────┬────────┬────────┬─────┬─────────────┐
│ header     │ page 0 │ page 1 │ page 2 │ ... │ trailer     │
│ (fixed)    │        │        │        │     │ (optional)  │
└────────────┴────────┴────────┴────────┴─────┴─────────────┘
```

- The **header** (and optional **trailer**) hold information needed to read the rest: format version, page size, offsets of important parts.
- The body is split into **pages of the same size**, which makes reading and writing simple.

## The record

With a **fixed schema**, the database does not need to store field names in every row: the position says which field it is. A good layout puts **fixed-size fields first** and **variable-size fields last**:

```plaintext
Fixed-size part (always at the same offsets)
| 4 bytes  employee_id       |
| 4 bytes  tax_number        |
| 3 bytes  date              |
| 1 byte   gender            |
| 2 bytes  first_name_length |
| 2 bytes  last_name_length  |
Variable-size part
| first_name_length bytes  first_name |
| last_name_length bytes   last_name  |
```

- Fixed fields are read at **precomputed offsets**: no calculation needed.
- `first_name` starts right after the fixed part.
- `last_name` starts after `first_name`. To avoid adding lengths, you can store each variable field's **offset and length** in the fixed part.

## Building up

Formats are built as a hierarchy: **fields → cells → pages → sections → files**, often with a lookup table (in the header, trailer or a separate file) that points to where each part starts.

@topic Page structure
@summary How variable-size records are packed into fixed-size pages.

Data and index files are split into **pages**, usually **4–16 KB**, often several filesystem blocks each.

A B-Tree node is one page (or a few linked pages):

- **leaf** pages hold keys with data records
- **internal** pages hold keys with pointers to child pages

This topic goes from the simplest page format to the **slotted page** that real databases use.

@subtopic Fixed-size records and their limits
@summary The original B-Tree page was a simple array of key/value/pointer triplets.

The original B-Tree paper used a very simple page: a sequence of **triplets**, each holding a key, a value and a child pointer.

```plaintext
┌───────────┬───────────┬───────────┬───────────┐
│ k1 v1 p1  │ k2 v2 p2  │ k3 v3 p3  │   free    │
└───────────┴───────────┴───────────┴───────────┘
```

It is easy to understand, but it has two big problems:

| Problem | Why it hurts |
|---|---|
| Inserting anywhere but the end means **moving** every later entry | Inserts in the middle of a page are slow |
| Works only for **fixed-size** data | Real rows have `VARCHAR`, `TEXT` and `NULL`s |

## Why variable-size data is hard

Suppose a 40-byte row is deleted. A new 30-byte row can reuse the space, but 10 bytes are left over; a 50-byte row cannot use it at all. Over time a page fills with **unusable gaps**.

Splitting the page into fixed slots (say 64 bytes each) wastes space too: a 70-byte row takes two slots and wastes 58 bytes.

We need a page format that:

- stores **variable-size records** with little overhead
- **reclaims** space from deleted records
- lets other pages **refer to a record** without knowing its exact byte position, so records can move inside the page

@subtopic Slotted pages
@summary A slot array at the front, records at the back, free space in the middle.

The **slotted page** (also called a *slot directory*) solves all three needs. It is used by PostgreSQL, InnoDB, SQLite, Oracle and SQL Server, each with its own details.

![Layout of a slotted page](img:c3-slotted-page)

## How it works

- A fixed-size **header** describes the page.
- A **slot array** (cell pointers) grows **from the front**. Each slot holds the **offset** of one record.
- **Records** (cells) are added **from the back**.
- **Free space** sits in the middle. The page is full when the two meet.

## Why it solves the problems

| Need | How the slotted page meets it |
|---|---|
| Little overhead | The only extra cost is one small offset per record |
| Reclaim space | Rewrite (defragment) the page and update the offsets |
| Stable references | Outside the page, a record is known by its **slot number**, not its byte position |

> **In practice:** this is exactly what a PostgreSQL **ctid** is: `(page number, slot number)`. Try it:
>
> `SELECT ctid, * FROM orders LIMIT 3;` shows values like `(0,1)`, `(0,2)`.
>
> With the `pageinspect` extension, `SELECT * FROM page_header(get_raw_page('orders', 0));` shows `lower` (end of the slot array) and `upper` (start of the records). The gap between them is the page's free space.

@subtopic Cell layout
@summary Key cells point to child pages; key-value cells hold the data.

Records inside a page are called **cells**. B-Trees use two kinds:

| Cell type | Lives in | Holds |
|---|---|---|
| **Key cell** | Internal pages | A separator key and the **child page id** |
| **Key-value cell** | Leaf pages | A key and its **data record** |

All cells in one page are the **same kind**, so the cell type is stored once in the page header, not in every cell.

## A variable-size key cell

```plaintext
0                4               8
+----------------+---------------+-------------+
| [int] key_size | [int] page_id | [bytes] key |
+----------------+---------------+-------------+
```

## A key-value cell

```plaintext
0              1                5                  9
+--------------+----------------+------------------+-------------+---------------------+
| [byte] flags | [int] key_size | [int] value_size | [bytes] key | [bytes] data_record |
+--------------+----------------+------------------+-------------+---------------------+
```

Fixed-size fields come **first**, so they are read at known offsets. The key starts right after the header, and the value starts `key_size` bytes later.

## Page id vs offset

- Pointers **between pages** store a **page id**. The page cache translates it to a file position, because all pages have the same size.
- Pointers **inside a page** store a **page-relative offset**. It is a small number (it only has to reach 16 KB), so it takes fewer bytes.

@subtopic Insertion order vs key order
@summary Cells stay where they were written; only the small offsets are kept sorted.

In a slotted page, **cells are written in insertion order**, but the **slot array is kept in key order**. Binary search runs over the slots.

![Inserting Tom, then Leslie, then Ron into a slotted page](img:c3-cell-order)

Example: insert the names **Tom**, then **Leslie**, then **Ron**.

1. **Tom** is written at the back of the page. Slot 1 points to it.
2. **Leslie** is written next to Tom. Leslie sorts before Tom, so Leslie's offset goes **first** in the slot array.
3. **Ron** is written next. To keep the order *Leslie, Ron, Tom*, the slots after the insertion point **shift right by one**, and Ron's offset goes in between.

Only the small **offsets move**. The cells themselves are never moved on insert, update or delete.

> **Why it matters:** shifting a few 2-byte offsets is far cheaper than moving whole rows. This is what makes inserting into the middle of a B-Tree page fast.

@subtopic Managing free space
@summary Freed cells go on an availability list; the page is defragmented when needed.

Deleting a record does not have to move other records. The engine can **mark the cell as deleted** and remember the free gap.

## The availability list

The page keeps a list of **free segments** (offset + size). SQLite calls them **freeblocks** and also stores the total free bytes in the page header, so it can quickly tell whether a new cell would fit after defragmenting.

![A fragmented page with free segments tracked by an availability list](img:c3-freelist)

When a new cell arrives, the engine looks for a gap that fits:

| Strategy | Picks | Downside |
|---|---|---|
| **First fit** | The first gap that is big enough | Leftover slivers may be too small to ever use |
| **Best fit** | The gap that leaves the **smallest remainder** | Must look at more gaps |

## When no gap fits

1. If the **total** free space is enough but it is fragmented: **defragment** the page by rewriting the live cells together, then insert.
2. If even that is not enough: the page **overflows**. The engine splits the node or uses an **overflow page** (Chapter 4).

> **Locality trick:** some engines store **keys and values separately** in leaf pages. Small keys packed together make the binary search touch fewer cache lines; the matching value is found by index after the key is located.

> **In practice:** PostgreSQL defragments a heap page when it needs space (*page pruning*), but the page stays in the table. Space returns to the operating system only with `VACUUM FULL` or tools like `pg_repack`. InnoDB reorganizes pages on its own and reclaims file space only with `OPTIMIZE TABLE` (a table rebuild).

@topic Versioning and checksums
@summary Knowing which format a file uses, and detecting corrupted pages.

Two practical problems remain once the format is designed:

1. Formats **change** between releases. The engine must know which version wrote a file.
2. Disks, controllers, memory and software **corrupt data** sometimes. The engine must notice before it uses bad data.

@subtopic Versioning file formats
@summary Version numbers in file names, separate files, or the header.

Every storage engine changes its binary format over time: new features, bug fixes, performance work. Most must still **read older formats** after an upgrade.

So the engine needs to know which version wrote each file:

| Method | Example |
|---|---|
| **Version in the file name** | Apache Cassandra: `na-1-big-Data.db` (4.0) vs `ma-…` (3.0). You know the version without opening the file. |
| **Version in a separate file** | PostgreSQL's `PG_VERSION` file in the data directory and in each database directory |
| **Version in the file header** | The header (or its first part) uses a format that never changes, so any release can read it and pick the right reader. Often combined with **magic numbers** (Chapter 4). |

> **DBA link:** this is why major-version upgrades sometimes need a data conversion step. PostgreSQL major versions need `pg_upgrade` or dump/restore because the on-disk catalog format changes, while minor versions use the same format. Cassandra's `nodetool upgradesstables` rewrites old-format SSTables.

@subtopic Checksums and CRCs
@summary Store a small fingerprint with each page and check it on every read.

Data can be **silently corrupted** by bad disks, controllers, cables, RAM or bugs. To catch it, engines store a small fingerprint with the data.

| Technique | Strength | Catches |
|---|---|---|
| **Checksum** (XOR, parity, sum) | Weakest | Simple single-bit errors |
| **CRC** (cyclic redundancy check) | Strong for accidents | **Burst errors**: many consecutive bits flipped, common in storage and networks |
| **Cryptographic hash** (SHA-256…) | Strongest | Also **deliberate tampering** |

> **Important:** CRCs and simple checksums detect **accidents**, not attacks. To prove data was not tampered with, use a cryptographic hash.

## How it is used

1. Before writing a page, compute its checksum and store it **in the page header**.
2. When reading the page, compute it again and **compare**.
3. If they differ, the page is corrupt: **don't use it**. Report it and repair it from a replica or backup.

Checksums are kept **per page**, not per file: you rarely read a whole file, and corruption is limited to one page instead of making the whole file suspect.

> **In practice:**
> - **InnoDB** always checksums pages (`innodb_checksum_algorithm`, `crc32` by default).
> - **PostgreSQL**: enable with `initdb --data-checksums` (the default since version 18), or offline with `pg_checksums --enable`; check with `SHOW data_checksums;`.
> - **Oracle**: `DB_BLOCK_CHECKSUM` (default `TYPICAL`); `DB_BLOCK_CHECKING` adds logical checks.
>
> A checksum error in the logs is an **emergency signal**: check the hardware and restore the affected objects.

@topic Check yourself: Chapter 3
@summary Short questions on file formats and page layout. Answers are below.

1. **Why must a storage engine do its own space management on disk?**
2. **Write the bytes of the 32-bit number `0x11223344` in little-endian order.**
3. **Why do databases store strings with a length prefix instead of a terminating null byte?**
4. **What is the mask for a flag stored in bit 3 (counting from 0), and how do you test it?**
5. **Why should fixed-size fields come before variable-size fields in a record?**
6. **In a slotted page, which part grows from the front and which from the back?**
7. **What does PostgreSQL's ctid `(12,5)` mean?**
8. **You insert Zoe into a page holding Leslie, Ron and Tom. What moves inside the page?**
9. **First fit or best fit: which leaves less wasted space, and what does it cost?**
10. **What can a CRC detect, and what can it not prove?**

---

> **1.** Disk offers only read and write at offsets: no allocator, no pointers, no garbage collection. The engine must place records, track free space and fight fragmentation itself.
>
> **2.** `44 33 22 11`: the least significant byte comes first.
>
> **3.** The length is known instantly, the data can contain zero bytes, and the value can be sliced straight out of the page.
>
> **4.** `1 << 3` = `0x08`. Test with `(flags & 0x08) != 0`.
>
> **5.** Fixed fields can then be read at precomputed offsets; only variable fields need offset calculations.
>
> **6.** The slot (offset) array grows from the front; the cells grow from the back; free space is in between.
>
> **7.** Page 12 of the table, slot (line pointer) 5 in that page.
>
> **8.** Zoe's cell is written into the free space at the back. Only the slot array changes: Zoe's offset is added at the end, because Zoe sorts last. No existing cell moves.
>
> **9.** Best fit leaves the smallest leftover gap, but it must look at more candidate gaps.
>
> **10.** It detects accidental corruption, including burst errors. It cannot prove the data wasn't deliberately changed; that needs a cryptographic hash.
