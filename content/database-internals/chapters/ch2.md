@chapter 2. B-Tree Basics
@summary Why databases use B-Trees, how they are shaped, and how they grow and shrink.

## Why this chapter matters

Almost every index you will ever create (a primary key, a `CREATE INDEX`, an InnoDB table itself) is a **B-Tree**. When you understand its shape, many everyday facts make sense:

- why a lookup in a billion-row table needs only **3–4 page reads**
- why **random inserts** cause page splits and fragmentation
- why **range queries** on an indexed column are cheap

B-Trees were invented by Rudolf Bayer and Edward McCreight in 1971, and are still the default index structure in MySQL, PostgreSQL, Oracle, SQL Server and SQLite.

## What you will learn

| Topic | The question it answers |
|---|---|
| Binary search trees | Why not just use the search trees from programming classes? |
| Disks and on-disk structures | What do HDDs and SSDs force a data structure to do? |
| B-Tree structure | What are root, internal and leaf nodes, separator keys and fanout? |
| Lookups | How is a key found, and how many reads does it take? |
| Splits and merges | What happens when a page is full, or nearly empty? |

> In this course, "B-Tree" means the **B+-Tree** variant that databases actually use: values live only in the leaves. You will see why on the *B-Tree structure* page.

@topic Binary search trees
@summary The classic in-memory search tree, and why it is a poor fit for disk.

A **binary search tree (BST)** is a sorted, in-memory structure for looking up keys. It is the starting point for understanding B-Trees.

This topic has three pages: how a BST works, why it must stay balanced, and why even a balanced BST is wrong for disk.

@subtopic How a binary search tree works
@summary One key per node, two children, smaller keys left and larger keys right.

Each **node** of a BST holds:

- a **key**
- the **value** for that key
- **two child pointers**: left and right (hence *binary*)

The tree starts at one **root** node. The rule that makes it a *search* tree:

> Every key in the **left** subtree is **smaller** than the node's key. Every key in the **right** subtree is **larger**.

```plaintext
            50
          /    \
        30      70
       /  \    /  \
     20   40  60   80
```

## Finding a key

To find `60`: start at the root. `60 > 50`, go right. `60 < 70`, go left. Found.

- Keep going **left** to reach the smallest key; keep going **right** for the largest.
- A search may stop early, on any level, because values are stored in every node.
- Each step **halves** the remaining search space, so a lookup takes about **log₂ N** steps.

| Keys in the tree | Steps to find one (balanced) |
|---|---|
| 1,000 | ~10 |
| 1,000,000 | ~20 |
| 1,000,000,000 | ~30 |

@subtopic Keeping the tree balanced
@summary Insert order can turn a tree into a linked list; rotations fix that.

The shape of a BST depends on the **order of inserts**. Insert keys that are already sorted and every new key goes to the right:

![A balanced tree compared with a degenerate one built from sorted inserts](img:c2-bst-balance)

The degenerate tree on the right is really a **linked list**: finding the last key takes **N** steps instead of **log₂ N**.

## What "balanced" means

A tree is **balanced** when its height is about **log₂ N** and the two subtrees of any node differ in height by at most one. (This is the AVL tree rule; other trees allow a small constant difference.)

## Rotations

To stay balanced, the tree is reorganized after inserts and deletes. A common step is a **rotation**: when a branch becomes a chain, the middle node (the **pivot**) moves up one level and its parent becomes its child.

```plaintext
 before:        after rotating around 3:
   5                    3
  /                    / \
 3          ──▶       2   5
/
2
```

Balanced trees give **O(log N)** lookups. Without balancing, the worst case is **O(N)**.

> **DBA link:** the same problem appears on disk. Inserting **sorted keys** (auto-increment ids, timestamps) into a B-Tree always hits the **rightmost leaf**. B-Trees stay balanced by design, but this pattern still shapes how pages fill and split (Chapter 4, *Right-only appends*).

@subtopic Why binary trees fail on disk
@summary Low fanout means a tall tree, and every level can mean a disk seek.

A balanced BST is great in memory. On disk it has two serious problems.

## 1. Poor locality

Nodes are created in random order, so a child is rarely stored **near its parent**. Following each pointer may mean reading a **different disk page**.

## 2. The tree is too tall

**Fanout** is the maximum number of children per node. A BST has fanout **2**, so its height is **log₂ N**. With a billion keys that is about **30 levels**, which could be 30 disk reads for one lookup.

On top of that, frequent rebalancing means moving nodes and rewriting pointers, which is expensive on disk.

## What a disk-friendly tree needs

| Property | Why |
|---|---|
| **High fanout** | Many keys per node, so neighbouring keys are in the same page (locality) |
| **Low height** | Fewer levels, so fewer disk reads per lookup |

These two go together: **the higher the fanout, the lower the height**.

> **Paged binary trees** group BST nodes into pages to improve locality, but they are still hard to keep balanced on disk. B-Trees solve the problem properly by making each node one whole page, holding hundreds of keys.

@topic Disks and on-disk structures
@summary How HDDs and SSDs work, and the rules they impose on storage structures.

On-disk structures exist because data is too large to keep in memory: only part of it can be cached, and the rest must be found on disk efficiently.

Data structures are designed around the hardware they run on. Many classic database algorithms were designed for **spinning disks**; flash (SSDs) and non-volatile memory brought new designs.

This topic covers hard disk drives, solid state drives, and what both mean for data structures.

@subtopic Hard disk drives (HDD)
@summary Seeks are expensive; sequential reads and writes are cheap.

A hard disk has **spinning platters** and a **read/write head** on a moving arm.

To read data at a random place, the drive must:

1. move the head to the right track (**seek**)
2. wait for the platter to rotate to the right sector (**rotational latency**)
3. transfer the data

Steps 1 and 2 are **mechanical** and take milliseconds. Once the head is in place, reading the next bytes is cheap.

| Term | Value |
|---|---|
| Smallest unit read or written | A **sector**, 512 bytes to 4 KB |
| Random read (seek + rotation) | ~5–10 ms |
| Sequential throughput | ~100–250 MB/s |

That is why you constantly hear **"sequential I/O good, random I/O bad"** for HDDs: one random read costs as much time as reading roughly a megabyte sequentially.

> **DBA link:** many classic tuning rules come from HDDs: putting redo/WAL logs on separate spindles, large sequential read-ahead, and preferring full scans over many random index lookups when a query reads a large fraction of a table.

@subtopic Solid state drives (SSD)
@summary Pages are written, blocks are erased, and a translation layer hides it all.

An SSD has **no moving parts**. It is built from flash memory cells organized in a hierarchy:

![How flash memory is organized inside an SSD](img:c2-ssd)

## The key rules

| Rule | Consequence |
|---|---|
| The smallest unit you can **read or write** is a **page** (2–16 KB) | Like a disk block |
| You can only write to **erased** cells | No overwrite in place |
| The smallest unit you can **erase** is a **block** (64–512 pages) | Erasing is coarse, so blocks are called *erase blocks* |
| Pages in an empty block are written **in order** | Writes are append-like inside a block |

## Flash Translation Layer (FTL)

Because pages cannot be overwritten, the SSD controller has an **FTL** that:

- maps logical page ids to **physical locations**, so an "overwrite" is really a write to a fresh page plus a mapping update
- tracks free, used and discarded pages
- runs **garbage collection**: finds blocks with mostly dead pages, copies the live pages elsewhere, and erases the block

Garbage collection runs in the background, but it can still **slow down writes**, especially random, small or unaligned ones.

## Random vs sequential on SSD

The gap is **much smaller** than on HDDs, because there is no seek. Sequential I/O is still somewhat faster thanks to prefetching and internal parallelism. What matters more on SSDs is **writing full, aligned blocks** and avoiding many tiny random writes. Chapters 6 and 7 show how buffering and immutability help.

> **In practice:** keep free space on SSDs (over-provisioning helps garbage collection), enable `TRIM`/`discard` where your filesystem supports it, and watch write latency spikes: they are often GC, not the database.

@subtopic Designing for block storage
@summary Everything is read in blocks, so design structures to use the whole block.

## The block device rule

Both HDDs and SSDs are **block devices**. The operating system hides their internals behind a block interface:

> To read **one byte**, the system reads the **whole block** that contains it.

You cannot avoid this, so good on-disk structures make it work for them: if a whole block is read anyway, put as much **useful, related data** in it as possible.

## Pointers on disk

On disk, a "pointer" is usually a **page number** or a **byte offset** in a file. The engine computes and follows these itself (unless it uses memory-mapped files). Long chains of pointers that cross many pages are slow and complex, so on-disk structures:

- keep related data in the **same page** (locality)
- reduce the number of **out-of-page pointers**
- prefer **wide, shallow** shapes

## Typical page sizes

| Database | Default page/block size | Setting |
|---|---|---|
| MySQL InnoDB | 16 KB | `innodb_page_size` (set at initialization) |
| PostgreSQL | 8 KB | compile-time `BLCKSZ` |
| Oracle | 8 KB (common default) | `DB_BLOCK_SIZE` |
| SQL Server | 8 KB | fixed |
| SQLite | 4 KB | `PRAGMA page_size` |

B-Trees are the answer that combines all of this: **one node = one page**, high fanout, low height, and rare rebalancing.

@topic B-Tree structure
@summary Root, internal and leaf nodes, separator keys, fanout and occupancy.

Think of a B-Tree as a big **library catalog room**: first you pick the right cabinet, then the right shelf, then the right drawer, then you flip through the cards in that drawer.

Each level narrows the search, and each step is one **page read**.

![A three-level B-Tree with separator keys and linked leaves](img:c2-btree)

The pages in this topic explain each part of this picture.

@subtopic Nodes, pages and fanout
@summary Root, internal and leaf nodes; one node is one page.

A B-Tree is built from **nodes**. Each node holds up to **N keys** and **N + 1 pointers** to child nodes.

| Node type | Description |
|---|---|
| **Root** | The top node. It has no parent. There is exactly one. |
| **Internal** (branch) | Connects the root to the leaves. Large trees have one or more levels of them. |
| **Leaf** | The bottom level. Holds the actual data (or pointers to it). Has no children. |

Because a B-Tree organizes **fixed-size pages**, the words **node** and **page** mean the same thing here.

## Fanout and occupancy

- **Fanout:** how many keys (children) a node holds. Hundreds per page is normal.
- **Occupancy:** how full a node is compared to its capacity.

High fanout:

- keeps the tree **short**
- puts many neighbouring keys in **one read**
- makes **rebalancing rare**: splits and merges only happen when a node is full or nearly empty

## B-Tree vs B+-Tree

| | B-Tree (original) | B+-Tree (what databases use) |
|---|---|---|
| Where values live | In any node | **Only in leaves** |
| Internal nodes hold | Keys and values | **Only separator keys** and child pointers |
| Effect | Search may stop early | Internal nodes are smaller, so fanout is **higher**; all changes happen in leaves |

MySQL calls its B+-Tree indexes "B-tree" too. In this course we do the same.

@subtopic Separator keys
@summary Keys in internal nodes split the tree into ranges and guide the search.

The keys in internal nodes are called **separator keys** (also *index entries* or *divider cells*). They divide the key space into **subranges**, and each subrange has its own child pointer.

For a node with keys `K1 < K2 < … < Kn`:

| Pointer | Points to the subtree with keys |
|---|---|
| First pointer | **less than** `K1` |
| Pointer between `Ki-1` and `Ki` | **≥ `Ki-1`** and **< `Ki`** |
| Last pointer | **≥ `Kn`** |

```plaintext
            [ 10 | 20 ]
           /     |     \
   keys < 10   10 ≤ k < 20   k ≥ 20
```

Keys inside a node are **kept sorted**, so the engine can use **binary search** within a page.

## Sibling pointers

Many implementations link nodes on the same level, most often the **leaves**:

- a **forward** link to the next leaf makes **range scans** fast: read one leaf, follow the link, read the next, without going back up the tree
- **forward and backward** links (a doubly linked list) allow scanning in **reverse order**, for example `ORDER BY id DESC`

## Built from the bottom up

A BST grows from the top down. A B-Tree grows from the **bottom up**: leaves fill and split, which adds keys to the internal nodes above. The tree only gets **taller when the root splits**.

Since nodes keep room for future inserts, a B-Tree can be as little as **50% full**, but in practice it is usually much fuller.

@subtopic How tall does a B-Tree get?
@summary Height grows with log base fanout, so even huge tables need only 3–4 levels.

A lookup reads **one page per level**, so the **height** of the tree is the number of page reads.

With fanout **f** and **M** keys, the height is about **log_f M**. Because *f* is in the hundreds, the height grows extremely slowly:

![Tree height as the number of keys grows, for different fanouts](img:c2-height)

## A worked example (InnoDB)

Assume a `BIGINT` primary key and rows of about 200 bytes in 16 KB pages:

| Level | Entries per page | Total reachable |
|---|---|---|
| Root | ~1,000 child pointers (8-byte key + pointer) | 1,000 pages |
| Internal | ~1,000 each | 1,000,000 leaf pages |
| Leaf | ~75 rows each | **~75 million rows** |

So about **75 million rows in a tree of height 3**, and billions with height 4. The root and internal levels are small and almost always **in the buffer pool**, so a point lookup usually costs **one physical read**, or none.

## Two ways to count cost

| What you count | Log base | For 4 billion keys |
|---|---|---|
| **Page reads** (disk transfers) | fanout (hundreds) | 3–4 |
| **Key comparisons** (binary search in each page) | 2 | ~32 |

Comparisons are cheap CPU work; page reads are what you feel. Textbooks just write **O(log M)**, because the base only changes a constant factor.

> **In practice:** PostgreSQL's `pgstattuple` extension has `SELECT * FROM pgstatindex('orders_pkey');`, which shows `tree_level`, leaf pages and density. In MySQL, `mysql.innodb_index_stats` shows `n_leaf_pages` and `size` per index.

@topic Lookups
@summary Walking from the root to a leaf for point queries and range scans.

Every B-Tree operation starts with the same step: **find the right leaf**.

- **Point query** (`WHERE id = 42`): find the exact key, or confirm it does not exist.
- **Range query** (`WHERE id BETWEEN 100 AND 200`, `>`, `<`): find the first key, then read forward.
- **Insert / update / delete**: find the leaf where the key belongs, then change it.

@subtopic The lookup algorithm
@summary Binary search in each page, follow one pointer per level, until the leaf.

To find key **K**:

1. Start at the **root** page.
2. **Binary search** the separator keys for the subrange that contains *K*.
3. Follow that **child pointer** to the next level.
4. Repeat steps 2–3 until you reach a **leaf**.
5. In the leaf, binary search for *K*. Either it is there, or you know its **predecessor** (the largest key smaller than *K*).

Each level gives a more **detailed view**: the root splits the whole key space coarsely, and each level below splits a smaller range more finely.

```plaintext
find 42:
  root     [ 30 | 60 ]            30 ≤ 42 < 60  → middle child
  internal [ 35 | 40 | 50 ]       40 ≤ 42 < 50  → third child
  leaf     [ 40 | 41 | 42 | 45 ]  found 42
```

## Range scans

For a range, find the **first key** of the range with the steps above, then:

- read entries in order within the leaf
- follow the **sibling pointer** to the next leaf
- stop when a key falls outside the range, or the `LIMIT` is reached

> **DBA link:** this is why an index on `(customer_id, created_at)` makes `WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10` instant: one descent to the right leaf, then a short walk along the leaves, with no sorting needed.

@subtopic Counting keys and pointers
@summary Different books count node capacity differently; the ideas are the same.

You will see node capacity described in different ways in different sources. Don't let it confuse you.

| Source style | How capacity is described |
|---|---|
| Bayer & McCreight (original paper) | A number **k**: each page holds between **k and 2k keys** (so k+1 to 2k+1 child pointers); the root may hold 1 to 2k keys |
| Many modern texts (and this course) | A node holds up to **N keys** and **N + 1 pointers** |

Both describe the same structure. The useful rules to remember:

- an internal node with **n keys** has **n + 1 children**
- a **leaf** holds up to N **key/value pairs**
- every node except the root is kept **at least about half full**

@topic Splits and merges
@summary How a B-Tree stays balanced as rows are inserted and deleted.

A B-Tree stays balanced by **splitting** full nodes on insert and **merging** nearly empty nodes on delete. Both changes can travel **up the tree**, all the way to the root.

| Operation | Trigger | Effect on height |
|---|---|---|
| Split | A node overflows | Height +1 only when the **root** splits |
| Merge | Two neighbours underflow and fit in one node | Height −1 only when the root ends up with one child |

@subtopic Node splits
@summary A full page is cut in half and a separator key is promoted to the parent.

Inserting starts like a lookup: find the target leaf and the position for the new key. If the leaf has room, the key is simply added. **Updates** work the same way: find the leaf and change the value.

If the node is **full** (it **overflows**), it must be split:

![A leaf split while inserting 11](img:c2-split)

## The four steps of a split

1. **Allocate** a new node.
2. **Move half** of the entries from the full node to the new one. The position where the node is cut is the **split point** (midpoint).
3. **Insert** the new key into whichever of the two nodes it belongs to.
4. **Promote**: add a separator key and a pointer to the new node in the **parent**.

| Node type | Splits when | What moves |
|---|---|---|
| Leaf | Inserting would exceed **N** key/value pairs | Keys with their values |
| Internal | Inserting would exceed **N + 1** pointers | Keys and child pointers; the split-point key moves **up** to the parent |

## Splits can cascade

If the parent is also full, it splits too, and so on up the tree. When the **root** splits, a **new root** is created above it, and the tree becomes **one level taller**. That is the only way a B-Tree grows in height; otherwise it grows **sideways**.

> **DBA link:** splits are real I/O. They write extra pages, and pages split in half are only ~50% full, so random inserts (for example random UUID keys) leave an index larger and more fragmented than sequential inserts do. In InnoDB you can count them: `SET GLOBAL innodb_monitor_enable = 'index_page_splits';` then read `INFORMATION_SCHEMA.INNODB_METRICS`.

@subtopic Node merges
@summary When neighbours become too empty, they are combined into one page.

Deleting starts by finding the leaf and removing the key and its value.

If a node becomes too empty (**underflow**), the tree tries to fix it:

- if the node and its neighbour **fit in one node**, they are **merged**
- if they **don't fit**, keys are **redistributed** between them instead (rebalancing, Chapter 4)

![Two half-empty leaves merged after deleting 16](img:c2-merge)

## The three steps of a merge

1. **Copy** all entries from the right node into the left node (or the other way, as long as order is kept).
2. **Remove** the right node's pointer and separator key from the **parent**. For internal nodes, the separator is pulled **down** into the merged node (**demoted**).
3. **Free** the right node.

| Node type | Merge when |
|---|---|
| Leaf | The two neighbours together hold **≤ N** key/value pairs |
| Internal | The two neighbours together hold **≤ N + 1** pointers |

Like splits, merges can **cascade** up to the root. If the root is left with a single child, that child becomes the new root and the tree gets **one level shorter**.

> **In practice:** many engines merge lazily or not at all. They leave half-empty pages in place, because the space is likely to be reused. That is why indexes rarely shrink after a big `DELETE`, and why tools like `OPTIMIZE TABLE` (MySQL), `REINDEX` (PostgreSQL) or `ALTER INDEX … REBUILD` (Oracle) exist.

@topic Check yourself: Chapter 2
@summary Short questions on B-Tree basics. Answers are below.

1. **Why does inserting sorted keys into a plain binary search tree make it slow?**
2. **What two properties make a tree suitable for disk, and how are they related?**
3. **On an SSD, why can't a page simply be overwritten in place?**
4. **What is the difference between a B-Tree and a B+-Tree? Which one do databases use?**
5. **An internal node holds the keys `[ 10 | 20 | 30 ]`. Which child do you follow to find `20`?**
6. **About how many page reads does a point lookup need in a 50-million-row InnoDB table? Why is it usually even fewer physical reads?**
7. **List the four steps of a node split.**
8. **When does a B-Tree get taller?**
9. **You deleted 40% of a table's rows, but the index files are the same size. Why?**

---

> **1.** Every new key goes to the same side, so the tree becomes a linked list and lookups take O(N) instead of O(log N).
>
> **2.** High fanout and low height. They are inversely related: more keys per node means fewer levels.
>
> **3.** Flash cells can only be written after they are erased, and erasing works on whole blocks. The FTL writes the new version to a fresh page and remaps it.
>
> **4.** A B+-Tree keeps values only in leaves; internal nodes hold only separator keys, which gives higher fanout. Databases use B+-Trees.
>
> **5.** The pointer between `20` and `30`: that subtree holds keys ≥ 20 and < 30.
>
> **6.** About three levels, so three page reads. The root and internal pages are hot and stay in the buffer pool, so usually only the leaf (or nothing) is read from disk.
>
> **7.** Allocate a new node, move half the entries to it, insert the new key into the right node, add a separator key and pointer to the parent.
>
> **8.** Only when the root splits and a new root is created above it.
>
> **9.** Most engines don't merge or return emptied pages to the operating system; the free space is reused by later inserts. Rebuilding the index or table reclaims it.
