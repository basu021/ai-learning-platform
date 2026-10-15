-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: ai_learning_platform
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `ai_learning_platform`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `ai_learning_platform` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `ai_learning_platform`;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('d400b53a-7154-40a3-ba33-79bb486ccf9a','bc038a7621251b42e3aa502c42824b382001126224353b5ed7992d87a540aa09','2026-10-15 12:48:54.420','20261015120000_reading_progress',NULL,NULL,'2026-10-15 12:48:54.033',1),('df3e60f9-1828-4e7a-9aab-2e166afa73bf','997ca29618a1d80f9ce17335ac156130386322fdd02e4c621d9900b832b56f04','2026-10-15 12:05:27.418','20261015000000_init',NULL,NULL,'2026-10-15 12:05:25.401',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `access_requests`
--

DROP TABLE IF EXISTS `access_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_requests` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `decided_by_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decided_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `access_requests_subject_id_status_idx` (`subject_id`,`status`),
  KEY `access_requests_user_id_idx` (`user_id`),
  KEY `access_requests_decided_by_id_fkey` (`decided_by_id`),
  CONSTRAINT `access_requests_decided_by_id_fkey` FOREIGN KEY (`decided_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `access_requests_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `access_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_requests`
--

LOCK TABLES `access_requests` WRITE;
/*!40000 ALTER TABLE `access_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `access_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `achievements`
--

DROP TABLE IF EXISTS `achievements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `achievements` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `xp_reward` int NOT NULL DEFAULT '0',
  `condition` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `achievements_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `achievements`
--

LOCK TABLES `achievements` WRITE;
/*!40000 ALTER TABLE `achievements` DISABLE KEYS */;
/*!40000 ALTER TABLE `achievements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filename` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_bytes` int NOT NULL,
  `storage_path` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inline` tinyint(1) NOT NULL DEFAULT '0',
  `uploaded_by_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `attachments_subject_id_node_id_idx` (`subject_id`,`node_id`),
  KEY `attachments_node_id_fkey` (`node_id`),
  KEY `attachments_uploaded_by_id_fkey` (`uploaded_by_id`),
  CONSTRAINT `attachments_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `content_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `attachments_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `attachments_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES ('3e8e75a3-976d-466d-aac5-b4795c66cea1','Linux',NULL,'2026-10-15 12:05:31.018'),('781d8d15-4f23-472c-a233-9c8c63490c39','Databases',NULL,'2026-10-15 12:05:31.042'),('fac22e08-70b4-4e69-a891-054c3c59a2b5','DevOps',NULL,'2026-10-15 12:05:31.059');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `change_requests`
--

DROP TABLE IF EXISTS `change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_requests` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('CREATE','UPDATE','DELETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `change_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reviewed_by_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `change_requests_subject_id_status_idx` (`subject_id`,`status`),
  KEY `change_requests_node_id_fkey` (`node_id`),
  KEY `change_requests_author_id_fkey` (`author_id`),
  KEY `change_requests_reviewed_by_id_fkey` (`reviewed_by_id`),
  CONSTRAINT `change_requests_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `change_requests_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `content_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `change_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `change_requests_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `change_requests`
--

LOCK TABLES `change_requests` WRITE;
/*!40000 ALTER TABLE `change_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `change_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_nodes`
--

DROP TABLE IF EXISTS `content_nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_nodes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('CHAPTER','TOPIC','SUBTOPIC') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `order` int NOT NULL DEFAULT '0',
  `is_preview` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `content_updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `has_content` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `content_nodes_subject_id_parent_id_idx` (`subject_id`,`parent_id`),
  KEY `content_nodes_parent_id_fkey` (`parent_id`),
  CONSTRAINT `content_nodes_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `content_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `content_nodes_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_nodes`
--

LOCK TABLES `content_nodes` WRITE;
/*!40000 ALTER TABLE `content_nodes` DISABLE KEYS */;
INSERT INTO `content_nodes` VALUES ('785ce28f-ca6f-47b6-b8e1-9e36679abf89','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'CHAPTER','Basic Commands','Learn to find where you are and move around the Linux file system with pwd and cd, with hands-on practice.','<h2>Moving Around the Linux File System</h2>\n<p>When you open a terminal, you are always \"standing\" inside one folder. Linux calls folders <strong>directories</strong>. In this chapter you will learn three things: how to see where you are, how to move to another directory, and how to get back home.</p>\n<p><strong>What you will learn:</strong></p>\n<ul>\n<li><p><code>pwd</code>: shows where you are right now</p></li>\n<li><p><code>cd</code>: moves you to another directory</p></li>\n<li><p>Going back to your home directory from anywhere</p></li>\n<li><p>Absolute paths vs relative paths</p></li>\n<li><p>The parent directory <code>..</code> and the current directory <code>.</code></p></li>\n</ul>\n\n<h2>Before you start</h2>\n<table>\n<tbody>\n<tr><th><p>Item</p></th><th><p>What you need</p></th></tr>\n<tr><td><p>System</p></td><td><p>Any Linux distribution (Ubuntu, Fedora, Debian…) or macOS Terminal</p></td></tr>\n<tr><td><p>Software</p></td><td><p>Nothing to install. These commands are built in.</p></td></tr>\n<tr><td><p>Permissions</p></td><td><p>A normal user account is enough. You do not need root or <code>sudo</code>.</p></td></tr>\n</tbody>\n</table>\n<p><strong>How to read the examples:</strong> each example line starts with a prompt such as <code>student@linux:~$</code>. You type only what comes <em>after</em> the <code>$</code>. Lines with no prompt are what Linux prints back to you.</p>\n<blockquote><p><code>$</code> means \"run as a normal user\". <code>#</code> means \"run as root (administrator)\". Every command in this chapter uses <code>$</code>.</p></blockquote>\n\n<h2>The file system is a tree</h2>\n<p>Linux keeps every file in one big tree. The top of the tree is called the <strong>root</strong> and is written as a single slash <code>/</code>. There are no drive letters like <code>C:\\</code> in Windows. Every disk, USB stick and user folder appears somewhere inside <code>/</code>. This standard layout is called the <strong>Filesystem Hierarchy Standard (FHS)</strong>.</p>\n<pre><code class=\"language-plaintext\">/                        ← root, the top of everything\n├── bin                  ← essential commands (ls, cp, cat…)\n├── boot                 ← files needed to start the system (Linux kernel)\n├── dev                  ← devices: disks, USB, terminals\n├── etc                  ← system settings\n│   ├── hostname\n│   ├── passwd           ← list of user accounts\n│   └── ssh\n├── home                 ← every normal user\'s personal folder\n│   ├── student          ← home of user \"student\"\n│   │   ├── Desktop\n│   │   ├── Documents\n│   │   └── Downloads\n│   ├── alice            ← home of user \"alice\"\n│   │   ├── Documents\n│   │   └── Pictures\n│   └── bob              ← home of user \"bob\"\n│       ├── Documents\n│       └── projects\n├── lib                  ← shared libraries used by programs in /bin and /sbin\n├── lib64                ← 64-bit libraries\n├── media                ← USB sticks and CDs appear here automatically\n│   └── student\n│       └── MY_USB\n├── mnt                  ← place to mount disks by hand\n├── opt                  ← optional, third-party software\n├── proc                 ← live information about running programs (virtual)\n├── root                 ← home of the administrator \"root\" (not in /home!)\n├── run                  ← temporary runtime data since last boot\n├── sbin                 ← system admin commands (reboot, fdisk…)\n├── srv                  ← data served by this machine (websites, FTP)\n├── sys                  ← live information about hardware (virtual)\n├── tmp                  ← temporary files, cleaned on reboot\n├── usr                  ← installed programs and their files\n│   ├── bin              ← most user programs (python3, git…)\n│   ├── lib\n│   ├── local            ← software you install yourself\n│   │   └── bin\n│   ├── sbin\n│   └── share            ← documentation, icons, manuals\n└── var                  ← data that changes often\n    ├── log              ← log files\n    ├── cache\n    ├── tmp\n    └── www              ← website files</code></pre>\n\n<h3>Every top-level directory</h3>\n<table>\n<tbody>\n<tr><th><p>Directory</p></th><th><p>What lives there</p></th><th><p>Beginner note</p></th></tr>\n<tr><td><p><code>/</code></p></td><td><p>The root: contains everything</p></td><td><p>Not the same as <code>/root</code></p></td></tr>\n<tr><td><p><code>/bin</code></p></td><td><p>Essential commands like <code>ls</code>, <code>cp</code>, <code>cat</code></p></td><td><p>On modern systems it points to <code>/usr/bin</code></p></td></tr>\n<tr><td><p><code>/boot</code></p></td><td><p>Kernel and boot loader files</p></td><td><p>Don\'t touch</p></td></tr>\n<tr><td><p><code>/dev</code></p></td><td><p>Devices shown as files (<code>/dev/sda</code> = first disk)</p></td><td><p>Don\'t touch</p></td></tr>\n<tr><td><p><code>/etc</code></p></td><td><p>System configuration files</p></td><td><p>Safe to read, needs <code>sudo</code> to change</p></td></tr>\n<tr><td><p><code>/home</code></p></td><td><p>One folder per user: <code>/home/student</code>, <code>/home/alice</code>, <code>/home/bob</code></p></td><td><p>Your files go here</p></td></tr>\n<tr><td><p><code>/lib</code>, <code>/lib64</code></p></td><td><p>Shared libraries that programs need</p></td><td><p>Don\'t touch</p></td></tr>\n<tr><td><p><code>/media</code></p></td><td><p>Removable media (USB, CD) mounted automatically</p></td><td><p>Your USB stick shows up here</p></td></tr>\n<tr><td><p><code>/mnt</code></p></td><td><p>Temporary mount point for disks you mount yourself</p></td><td><p>Often empty</p></td></tr>\n<tr><td><p><code>/opt</code></p></td><td><p>Optional / third-party software (e.g. Google Chrome)</p></td><td><p></p></td></tr>\n<tr><td><p><code>/proc</code></p></td><td><p>Virtual files about running processes and the kernel</p></td><td><p>Try <code>cat /proc/cpuinfo</code></p></td></tr>\n<tr><td><p><code>/root</code></p></td><td><p>Home directory of the administrator user <code>root</code></p></td><td><p>Normal users can\'t enter it</p></td></tr>\n<tr><td><p><code>/run</code></p></td><td><p>Runtime data created since the last boot</p></td><td><p>Cleared on reboot</p></td></tr>\n<tr><td><p><code>/sbin</code></p></td><td><p>System administration commands</p></td><td><p>Most need <code>sudo</code></p></td></tr>\n<tr><td><p><code>/srv</code></p></td><td><p>Data for services this machine provides</p></td><td><p>Often empty</p></td></tr>\n<tr><td><p><code>/sys</code></p></td><td><p>Virtual files about hardware and drivers</p></td><td><p>Don\'t touch</p></td></tr>\n<tr><td><p><code>/tmp</code></p></td><td><p>Temporary files any user can write</p></td><td><p>Deleted on reboot, so don\'t keep work here</p></td></tr>\n<tr><td><p><code>/usr</code></p></td><td><p>Installed programs, libraries and docs</p></td><td><p>Biggest directory on most systems</p></td></tr>\n<tr><td><p><code>/var</code></p></td><td><p>Changing data: logs, caches, mail, websites</p></td><td><p>Look at logs in <code>/var/log</code></p></td></tr>\n</tbody>\n</table>\n\n<h3>One computer, many users</h3>\n<p>Each person who logs in gets their own folder inside <code>/home</code>, and the prompt shows who is logged in. Here, three users each run <code>pwd</code> right after opening a terminal:</p>\n<pre><code class=\"language-bash\">student@linux:~$ pwd\n/home/student\n\nalice@linux:~$ pwd\n/home/alice\n\nbob@linux:~$ pwd\n/home/bob\n\nroot@linux:~# pwd\n/root</code></pre>\n<p>Notice two things:</p>\n<ul>\n<li><p><code>~</code> means \"<em>my</em> home\". For alice it is <code>/home/alice</code>, and for bob it is <code>/home/bob</code>.</p></li>\n<li><p>The administrator <code>root</code> lives in <code>/root</code>, not in <code>/home</code>, and the prompt ends with <code>#</code> instead of <code>$</code>.</p></li>\n</ul>\n<p>Users can usually look at the list of homes but not inside each other\'s private folders:</p>\n<pre><code class=\"language-bash\">student@linux:~$ ls /home\nalice  bob  student\nstudent@linux:~$ cd /home/bob/projects\nbash: cd: /home/bob/projects: Permission denied</code></pre>\n<p><code>ls</code> lists what is inside a directory. You will learn it properly in the next chapter. <em>Permission denied</em> means the folder exists but belongs to someone else.</p>\n<p>You can also jump straight to another user\'s home with <code>~username</code>, as long as you have permission:</p>\n<pre><code class=\"language-bash\">student@linux:~$ cd ~alice\nstudent@linux:/home/alice$ pwd\n/home/alice</code></pre>\n\n<h2>1. pwd: where am I?</h2>\n<p><code>pwd</code> stands for <strong>p</strong>rint <strong>w</strong>orking <strong>d</strong>irectory. It tells you which directory you are in right now.</p>\n<pre><code class=\"language-bash\">student@linux:~$ pwd\n/home/student</code></pre>\n<p>Linux printed <code>/home/student</code>, so you are in your home directory. Whenever you feel lost, type <code>pwd</code>.</p>\n\n<h2>2. cd: go somewhere else</h2>\n<p><code>cd</code> stands for <strong>c</strong>hange <strong>d</strong>irectory. Type <code>cd</code>, a space, and the place you want to go.</p>\n<pre><code class=\"language-bash\">student@linux:~$ cd /etc\nstudent@linux:/etc$ pwd\n/etc</code></pre>\n<p>Notice that the prompt changed from <code>~</code> to <code>/etc</code>. Many terminals show your current location in the prompt. <code>cd</code> prints nothing when it works. Silence means success.</p>\n\n<h2>3. Going home</h2>\n<p>Your <strong>home directory</strong> is your personal folder (for example <code>/home/student</code>). The terminal starts there, and the prompt shows it as <code>~</code>. To jump back home from anywhere, type <code>cd</code> on its own:</p>\n<pre><code class=\"language-bash\">student@linux:/usr/local/bin$ pwd\n/usr/local/bin\nstudent@linux:/usr/local/bin$ cd\nstudent@linux:~$ pwd\n/home/student</code></pre>\n<p><code>cd ~</code> does exactly the same thing.</p>\n\n<h2>4. Absolute paths: the full address</h2>\n<p>An <strong>absolute path</strong> always starts with <code>/</code>. It is the full address from the root of the tree, so it works no matter where you are standing.</p>\n<pre><code class=\"language-bash\">student@linux:/etc$ cd /home/student\nstudent@linux:~$ pwd\n/home/student</code></pre>\n<p>Think of it like a full postal address: country, city, street, house.</p>\n\n<h2>5. Relative paths: directions from here</h2>\n<p>A <strong>relative path</strong> does <em>not</em> start with <code>/</code>. It starts from the directory you are in now.</p>\n<pre><code class=\"language-bash\">student@linux:~$ cd /usr\nstudent@linux:/usr$ cd bin\nstudent@linux:/usr/bin$ pwd\n/usr/bin</code></pre>\n<p>Because you were in <code>/usr</code>, <code>cd bin</code> took you to <code>/usr/bin</code>, <strong>not</strong> to <code>/bin</code> or <code>/usr/local/bin</code>. That one missing <code>/</code> changes where you end up.</p>\n<table>\n<tbody>\n<tr><th><p>You type</p></th><th><p>Type of path</p></th><th><p>Where you end up (starting in <code>/usr</code>)</p></th></tr>\n<tr><td><p><code>cd bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/bin</code></p></td></tr>\n<tr><td><p><code>cd /bin</code></p></td><td><p>Absolute</p></td><td><p><code>/bin</code></p></td></tr>\n<tr><td><p><code>cd local/bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/local/bin</code></p></td></tr>\n</tbody>\n</table>\n\n<h2>6. The parent directory: ..</h2>\n<p>Two dots <code>..</code> mean \"the directory one level up\", which is the one that contains where you are now. It is called the <strong>parent directory</strong>.</p>\n<pre><code class=\"language-bash\">student@linux:/usr/bin$ cd ..\nstudent@linux:/usr$ pwd\n/usr</code></pre>\n<p>You can go up more than one level at a time:</p>\n<pre><code class=\"language-bash\">student@linux:/usr/local/bin$ cd ../..\nstudent@linux:/usr$ pwd\n/usr</code></pre>\n\n<h2>7. The current directory: .</h2>\n<p>One dot <code>.</code> means \"right here\". <code>cd .</code> keeps you where you are:</p>\n<pre><code class=\"language-bash\">student@linux:/usr/bin$ cd .\nstudent@linux:/usr/bin$ pwd\n/usr/bin</code></pre>\n<p>This seems useless now, but you will use <code>.</code> later, for example to run a script in the current folder with <code>./script.sh</code>.</p>\n\n<h2>Cheat sheet</h2>\n<table>\n<tbody>\n<tr><th><p>Command</p></th><th><p>What it does</p></th></tr>\n<tr><td><p><code>pwd</code></p></td><td><p>Show where I am</p></td></tr>\n<tr><td><p><code>cd /path/to/dir</code></p></td><td><p>Go to a directory using its full (absolute) path</p></td></tr>\n<tr><td><p><code>cd dirname</code></p></td><td><p>Go into a directory inside the current one (relative path)</p></td></tr>\n<tr><td><p><code>cd</code> or <code>cd ~</code></p></td><td><p>Go to my home directory</p></td></tr>\n<tr><td><p><code>cd ..</code></p></td><td><p>Go up one level, to the parent directory</p></td></tr>\n<tr><td><p><code>cd -</code></p></td><td><p>Go back to the directory I was in before</p></td></tr>\n<tr><td><p><code>cd .</code></p></td><td><p>Stay here (<code>.</code> = current directory)</p></td></tr>\n</tbody>\n</table>\n\n<h2>Practice</h2>\n<p>Open a terminal and try each exercise. Run <code>pwd</code> after every <code>cd</code> to check yourself. Expected output is shown for a user named <code>student</code>. Your username will be different.</p>\n\n<h3>Exercise 1: Find yourself</h3>\n<p>Open a new terminal and print where you are.</p>\n<pre><code class=\"language-bash\">$ pwd\n/home/student</code></pre>\n\n<h3>Exercise 2: Absolute jump</h3>\n<p>Go to <code>/usr/local/bin</code> with one command, then check.</p>\n<pre><code class=\"language-bash\">$ cd /usr/local/bin\n$ pwd\n/usr/local/bin</code></pre>\n\n<h3>Exercise 3: Climb up</h3>\n<p>From <code>/usr/local/bin</code>, go up one level, then up another.</p>\n<pre><code class=\"language-bash\">$ cd ..\n$ pwd\n/usr/local\n$ cd ..\n$ pwd\n/usr</code></pre>\n\n<h3>Exercise 4: Relative move</h3>\n<p>From <code>/usr</code>, go into <code>bin</code> <em>without</em> typing a leading <code>/</code>.</p>\n<pre><code class=\"language-bash\">$ cd bin\n$ pwd\n/usr/bin</code></pre>\n\n<h3>Exercise 5: Back home</h3>\n<p>Return to your home directory with the shortest command possible.</p>\n<pre><code class=\"language-bash\">$ cd\n$ pwd\n/home/student</code></pre>\n\n<h3>Exercise 6: Predict first, then run</h3>\n<p>Before running these, write down where you think you will end up. Then check with <code>pwd</code>.</p>\n<pre><code class=\"language-bash\">$ cd /etc\n$ cd ../usr/local\n$ pwd</code></pre>\n<p><strong>Answer:</strong> <code>/usr/local</code>. <code>..</code> takes you from <code>/etc</code> up to <code>/</code>, then <code>usr/local</code> goes down from there.</p>\n\n<h3>Exercise 7: Make a mistake on purpose</h3>\n<p>Try to go into a directory that does not exist:</p>\n<pre><code class=\"language-bash\">$ cd /home/nothing-here\nbash: cd: /home/nothing-here: No such file or directory</code></pre>\n<p>This error is normal. It just means the path is wrong. Check your spelling, and remember that Linux is <strong>case-sensitive</strong>: <code>Documents</code> and <code>documents</code> are different names.</p>\n\n<h3>Exercise 8: Explore the file system</h3>\n<p>Take a short tour of the tree. After each <code>cd</code>, run <code>pwd</code> to confirm where you are and <code>ls</code> to peek inside. Your output will differ a little from the example, and that\'s fine.</p>\n<p><strong>Step 1: Visit the root.</strong></p>\n<pre><code class=\"language-bash\">$ cd /\n$ pwd\n/\n$ ls\nbin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var</code></pre>\n<p>Compare this list with the tree diagram above. Can you find every directory?</p>\n<p><strong>Step 2: See who has a home.</strong></p>\n<pre><code class=\"language-bash\">$ cd /home\n$ ls\nalice  bob  student</code></pre>\n<p>Each name is a user on this computer. Your own username should be in the list.</p>\n<p><strong>Step 3: Look at the system settings.</strong></p>\n<pre><code class=\"language-bash\">$ cd /etc\n$ ls\nhostname  hosts  passwd  ssh  ...\n$ cat hostname\nlinux</code></pre>\n<p><code>cat</code> prints what\'s inside a file. <code>/etc/hostname</code> holds your computer\'s name.</p>\n<p><strong>Step 4: Find the log files.</strong></p>\n<pre><code class=\"language-bash\">$ cd /var/log\n$ pwd\n/var/log\n$ ls\napt  auth.log  dmesg  syslog  ...</code></pre>\n<p>Programs write their messages here. When something breaks, admins look here first.</p>\n<p><strong>Step 5: Try a place you\'re not allowed to go.</strong></p>\n<pre><code class=\"language-bash\">$ cd /root\nbash: cd: /root: Permission denied</code></pre>\n<p>Only the administrator can enter <code>/root</code>. You are still where you were, so check with <code>pwd</code>.</p>\n<p><strong>Step 6: Go home.</strong></p>\n<pre><code class=\"language-bash\">$ cd\n$ pwd\n/home/student</code></pre>\n<p><strong>Challenge:</strong> starting from <code>/var/log</code>, reach <code>/usr/local/bin</code> using <em>only relative paths</em>.</p>\n<p><strong>Answer:</strong> <code>cd ../../usr/local/bin</code>. The first <code>..</code> takes you to <code>/var</code>, the second to <code>/</code>, and then you go down into <code>usr/local/bin</code>.</p>\n\n<h3>Quick quiz</h3>\n<ol>\n<li><p>Which command shows your current directory? <em>(Answer: <code>pwd</code>)</em></p></li>\n<li><p>Does <code>cd docs</code> use an absolute or a relative path? <em>(Answer: relative, because it has no leading <code>/</code>)</em></p></li>\n<li><p>You are in <code>/home/student/Documents</code>. Where does <code>cd ..</code> take you? <em>(Answer: <code>/home/student</code>)</em></p></li>\n<li><p>What does <code>~</code> stand for? <em>(Answer: your home directory)</em></p></li>\n</ol>\n<p><strong>Tip:</strong> press <code>Tab</code> while typing a directory name and the terminal will complete it for you. This saves typing and avoids spelling mistakes.</p>',0,0,'2026-10-15 12:35:53.227','2026-10-15 13:14:19.876',NULL,'2026-10-15 13:14:19.875',1);
/*!40000 ALTER TABLE `content_nodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_revisions`
--

DROP TABLE IF EXISTS `content_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_revisions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('CREATE','UPDATE','DELETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot` json NOT NULL,
  `change_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `content_revisions_subject_id_node_id_created_at_idx` (`subject_id`,`node_id`,`created_at`),
  KEY `content_revisions_node_id_fkey` (`node_id`),
  KEY `content_revisions_changed_by_id_fkey` (`changed_by_id`),
  CONSTRAINT `content_revisions_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `content_revisions_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `content_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `content_revisions_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_revisions`
--

LOCK TABLES `content_revisions` WRITE;
/*!40000 ALTER TABLE `content_revisions` DISABLE KEYS */;
INSERT INTO `content_revisions` VALUES ('16f99110-3f35-43b0-842c-604a18298beb','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','UPDATE','{\"title\": \"Basic Commands\", \"content\": \"<p>this is the topic</p>\", \"summary\": \"This will guide you about linux basic commands\"}','Beginner rewrite with examples and practice','4d962294-7085-4522-8194-579abd7595a4','2026-10-15 13:00:55.411'),('22e92f76-2b4d-4b6e-bbd6-c74b5ad52318','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','UPDATE','{\"title\": \"Basic Commands\", \"content\": \"<h2>Moving Around the Linux File System</h2>\\n<p>When you open a terminal, you are always \\\"standing\\\" inside one folder. Linux calls folders <strong>directories</strong>. In this chapter you will learn three things: how to see where you are, how to move to another directory, and how to get back home.</p>\\n<p><strong>What you will learn:</strong></p>\\n<ul>\\n<li><p><code>pwd</code>: shows where you are right now</p></li>\\n<li><p><code>cd</code>: moves you to another directory</p></li>\\n<li><p>Going back to your home directory from anywhere</p></li>\\n<li><p>Absolute paths vs relative paths</p></li>\\n<li><p>The parent directory <code>..</code> and the current directory <code>.</code></p></li>\\n</ul>\\n\\n<h2>Before you start</h2>\\n<table>\\n<tbody>\\n<tr><th><p>Item</p></th><th><p>What you need</p></th></tr>\\n<tr><td><p>System</p></td><td><p>Any Linux distribution (Ubuntu, Fedora, Debian…) or macOS Terminal</p></td></tr>\\n<tr><td><p>Software</p></td><td><p>Nothing to install. These commands are built in.</p></td></tr>\\n<tr><td><p>Permissions</p></td><td><p>A normal user account is enough. You do not need root or <code>sudo</code>.</p></td></tr>\\n</tbody>\\n</table>\\n<p><strong>How to read the examples:</strong> each example line starts with a prompt such as <code>student@linux:~$</code>. You type only what comes <em>after</em> the <code>$</code>. Lines with no prompt are what Linux prints back to you.</p>\\n<blockquote><p><code>$</code> means \\\"run as a normal user\\\". <code>#</code> means \\\"run as root (administrator)\\\". Every command in this chapter uses <code>$</code>.</p></blockquote>\\n\\n<h2>The file system is a tree</h2>\\n<p>Linux keeps every file in one big tree. The top of the tree is called the <strong>root</strong> and is written as a single slash <code>/</code>. There are no drive letters like <code>C:\\\\</code> in Windows. Every disk, USB stick and user folder appears somewhere inside <code>/</code>. This standard layout is called the <strong>Filesystem Hierarchy Standard (FHS)</strong>.</p>\\n<pre><code class=\\\"language-plaintext\\\">/                        ← root, the top of everything\\n├── bin                  ← essential commands (ls, cp, cat…)\\n├── boot                 ← files needed to start the system (Linux kernel)\\n├── dev                  ← devices: disks, USB, terminals\\n├── etc                  ← system settings\\n│   ├── hostname\\n│   ├── passwd           ← list of user accounts\\n│   └── ssh\\n├── home                 ← every normal user\'s personal folder\\n│   ├── student          ← home of user \\\"student\\\"\\n│   │   ├── Desktop\\n│   │   ├── Documents\\n│   │   └── Downloads\\n│   ├── alice            ← home of user \\\"alice\\\"\\n│   │   ├── Documents\\n│   │   └── Pictures\\n│   └── bob              ← home of user \\\"bob\\\"\\n│       ├── Documents\\n│       └── projects\\n├── lib                  ← shared libraries used by programs in /bin and /sbin\\n├── lib64                ← 64-bit libraries\\n├── media                ← USB sticks and CDs appear here automatically\\n│   └── student\\n│       └── MY_USB\\n├── mnt                  ← place to mount disks by hand\\n├── opt                  ← optional, third-party software\\n├── proc                 ← live information about running programs (virtual)\\n├── root                 ← home of the administrator \\\"root\\\" (not in /home!)\\n├── run                  ← temporary runtime data since last boot\\n├── sbin                 ← system admin commands (reboot, fdisk…)\\n├── srv                  ← data served by this machine (websites, FTP)\\n├── sys                  ← live information about hardware (virtual)\\n├── tmp                  ← temporary files, cleaned on reboot\\n├── usr                  ← installed programs and their files\\n│   ├── bin              ← most user programs (python3, git…)\\n│   ├── lib\\n│   ├── local            ← software you install yourself\\n│   │   └── bin\\n│   ├── sbin\\n│   └── share            ← documentation, icons, manuals\\n└── var                  ← data that changes often\\n    ├── log              ← log files\\n    ├── cache\\n    ├── tmp\\n    └── www              ← website files</code></pre>\\n\\n<h3>Every top-level directory</h3>\\n<table>\\n<tbody>\\n<tr><th><p>Directory</p></th><th><p>What lives there</p></th><th><p>Beginner note</p></th></tr>\\n<tr><td><p><code>/</code></p></td><td><p>The root: contains everything</p></td><td><p>Not the same as <code>/root</code></p></td></tr>\\n<tr><td><p><code>/bin</code></p></td><td><p>Essential commands like <code>ls</code>, <code>cp</code>, <code>cat</code></p></td><td><p>On modern systems it points to <code>/usr/bin</code></p></td></tr>\\n<tr><td><p><code>/boot</code></p></td><td><p>Kernel and boot loader files</p></td><td><p>Don\'t touch</p></td></tr>\\n<tr><td><p><code>/dev</code></p></td><td><p>Devices shown as files (<code>/dev/sda</code> = first disk)</p></td><td><p>Don\'t touch</p></td></tr>\\n<tr><td><p><code>/etc</code></p></td><td><p>System configuration files</p></td><td><p>Safe to read, needs <code>sudo</code> to change</p></td></tr>\\n<tr><td><p><code>/home</code></p></td><td><p>One folder per user: <code>/home/student</code>, <code>/home/alice</code>, <code>/home/bob</code></p></td><td><p>Your files go here</p></td></tr>\\n<tr><td><p><code>/lib</code>, <code>/lib64</code></p></td><td><p>Shared libraries that programs need</p></td><td><p>Don\'t touch</p></td></tr>\\n<tr><td><p><code>/media</code></p></td><td><p>Removable media (USB, CD) mounted automatically</p></td><td><p>Your USB stick shows up here</p></td></tr>\\n<tr><td><p><code>/mnt</code></p></td><td><p>Temporary mount point for disks you mount yourself</p></td><td><p>Often empty</p></td></tr>\\n<tr><td><p><code>/opt</code></p></td><td><p>Optional / third-party software (e.g. Google Chrome)</p></td><td><p></p></td></tr>\\n<tr><td><p><code>/proc</code></p></td><td><p>Virtual files about running processes and the kernel</p></td><td><p>Try <code>cat /proc/cpuinfo</code></p></td></tr>\\n<tr><td><p><code>/root</code></p></td><td><p>Home directory of the administrator user <code>root</code></p></td><td><p>Normal users can\'t enter it</p></td></tr>\\n<tr><td><p><code>/run</code></p></td><td><p>Runtime data created since the last boot</p></td><td><p>Cleared on reboot</p></td></tr>\\n<tr><td><p><code>/sbin</code></p></td><td><p>System administration commands</p></td><td><p>Most need <code>sudo</code></p></td></tr>\\n<tr><td><p><code>/srv</code></p></td><td><p>Data for services this machine provides</p></td><td><p>Often empty</p></td></tr>\\n<tr><td><p><code>/sys</code></p></td><td><p>Virtual files about hardware and drivers</p></td><td><p>Don\'t touch</p></td></tr>\\n<tr><td><p><code>/tmp</code></p></td><td><p>Temporary files any user can write</p></td><td><p>Deleted on reboot, so don\'t keep work here</p></td></tr>\\n<tr><td><p><code>/usr</code></p></td><td><p>Installed programs, libraries and docs</p></td><td><p>Biggest directory on most systems</p></td></tr>\\n<tr><td><p><code>/var</code></p></td><td><p>Changing data: logs, caches, mail, websites</p></td><td><p>Look at logs in <code>/var/log</code></p></td></tr>\\n</tbody>\\n</table>\\n\\n<h3>One computer, many users</h3>\\n<p>Each person who logs in gets their own folder inside <code>/home</code>, and the prompt shows who is logged in. Here, three users each run <code>pwd</code> right after opening a terminal:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ pwd\\n/home/student\\n\\nalice@linux:~$ pwd\\n/home/alice\\n\\nbob@linux:~$ pwd\\n/home/bob\\n\\nroot@linux:~# pwd\\n/root</code></pre>\\n<p>Notice two things:</p>\\n<ul>\\n<li><p><code>~</code> means \\\"<em>my</em> home\\\". For alice it is <code>/home/alice</code>, and for bob it is <code>/home/bob</code>.</p></li>\\n<li><p>The administrator <code>root</code> lives in <code>/root</code>, not in <code>/home</code>, and the prompt ends with <code>#</code> instead of <code>$</code>.</p></li>\\n</ul>\\n<p>Users can usually look at the list of homes but not inside each other\'s private folders:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ ls /home\\nalice  bob  student\\nstudent@linux:~$ cd /home/bob/projects\\nbash: cd: /home/bob/projects: Permission denied</code></pre>\\n<p><code>ls</code> lists what is inside a directory. You will learn it properly in the next chapter. <em>Permission denied</em> means the folder exists but belongs to someone else.</p>\\n<p>You can also jump straight to another user\'s home with <code>~username</code>, as long as you have permission:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ cd ~alice\\nstudent@linux:/home/alice$ pwd\\n/home/alice</code></pre>\\n\\n<h2>1. pwd: where am I?</h2>\\n<p><code>pwd</code> stands for <strong>p</strong>rint <strong>w</strong>orking <strong>d</strong>irectory. It tells you which directory you are in right now.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ pwd\\n/home/student</code></pre>\\n<p>Linux printed <code>/home/student</code>, so you are in your home directory. Whenever you feel lost, type <code>pwd</code>.</p>\\n\\n<h2>2. cd: go somewhere else</h2>\\n<p><code>cd</code> stands for <strong>c</strong>hange <strong>d</strong>irectory. Type <code>cd</code>, a space, and the place you want to go.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ cd /etc\\nstudent@linux:/etc$ pwd\\n/etc</code></pre>\\n<p>Notice that the prompt changed from <code>~</code> to <code>/etc</code>. Many terminals show your current location in the prompt. <code>cd</code> prints nothing when it works. Silence means success.</p>\\n\\n<h2>3. Going home</h2>\\n<p>Your <strong>home directory</strong> is your personal folder (for example <code>/home/student</code>). The terminal starts there, and the prompt shows it as <code>~</code>. To jump back home from anywhere, type <code>cd</code> on its own:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/local/bin$ pwd\\n/usr/local/bin\\nstudent@linux:/usr/local/bin$ cd\\nstudent@linux:~$ pwd\\n/home/student</code></pre>\\n<p><code>cd ~</code> does exactly the same thing.</p>\\n\\n<h2>4. Absolute paths: the full address</h2>\\n<p>An <strong>absolute path</strong> always starts with <code>/</code>. It is the full address from the root of the tree, so it works no matter where you are standing.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/etc$ cd /home/student\\nstudent@linux:~$ pwd\\n/home/student</code></pre>\\n<p>Think of it like a full postal address: country, city, street, house.</p>\\n\\n<h2>5. Relative paths: directions from here</h2>\\n<p>A <strong>relative path</strong> does <em>not</em> start with <code>/</code>. It starts from the directory you are in now.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ cd /usr\\nstudent@linux:/usr$ cd bin\\nstudent@linux:/usr/bin$ pwd\\n/usr/bin</code></pre>\\n<p>Because you were in <code>/usr</code>, <code>cd bin</code> took you to <code>/usr/bin</code>, <strong>not</strong> to <code>/bin</code> or <code>/usr/local/bin</code>. That one missing <code>/</code> changes where you end up.</p>\\n<table>\\n<tbody>\\n<tr><th><p>You type</p></th><th><p>Type of path</p></th><th><p>Where you end up (starting in <code>/usr</code>)</p></th></tr>\\n<tr><td><p><code>cd bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/bin</code></p></td></tr>\\n<tr><td><p><code>cd /bin</code></p></td><td><p>Absolute</p></td><td><p><code>/bin</code></p></td></tr>\\n<tr><td><p><code>cd local/bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/local/bin</code></p></td></tr>\\n</tbody>\\n</table>\\n\\n<h2>6. The parent directory: ..</h2>\\n<p>Two dots <code>..</code> mean \\\"the directory one level up\\\", which is the one that contains where you are now. It is called the <strong>parent directory</strong>.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/bin$ cd ..\\nstudent@linux:/usr$ pwd\\n/usr</code></pre>\\n<p>You can go up more than one level at a time:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/local/bin$ cd ../..\\nstudent@linux:/usr$ pwd\\n/usr</code></pre>\\n\\n<h2>7. The current directory: .</h2>\\n<p>One dot <code>.</code> means \\\"right here\\\". <code>cd .</code> keeps you where you are:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/bin$ cd .\\nstudent@linux:/usr/bin$ pwd\\n/usr/bin</code></pre>\\n<p>This seems useless now, but you will use <code>.</code> later, for example to run a script in the current folder with <code>./script.sh</code>.</p>\\n\\n<h2>Cheat sheet</h2>\\n<table>\\n<tbody>\\n<tr><th><p>Command</p></th><th><p>What it does</p></th></tr>\\n<tr><td><p><code>pwd</code></p></td><td><p>Show where I am</p></td></tr>\\n<tr><td><p><code>cd /path/to/dir</code></p></td><td><p>Go to a directory using its full (absolute) path</p></td></tr>\\n<tr><td><p><code>cd dirname</code></p></td><td><p>Go into a directory inside the current one (relative path)</p></td></tr>\\n<tr><td><p><code>cd</code> or <code>cd ~</code></p></td><td><p>Go to my home directory</p></td></tr>\\n<tr><td><p><code>cd ..</code></p></td><td><p>Go up one level, to the parent directory</p></td></tr>\\n<tr><td><p><code>cd -</code></p></td><td><p>Go back to the directory I was in before</p></td></tr>\\n<tr><td><p><code>cd .</code></p></td><td><p>Stay here (<code>.</code> = current directory)</p></td></tr>\\n</tbody>\\n</table>\\n\\n<h2>Practice</h2>\\n<p>Open a terminal and try each exercise. Run <code>pwd</code> after every <code>cd</code> to check yourself. Expected output is shown for a user named <code>student</code>. Your username will be different.</p>\\n\\n<h3>Exercise 1: Find yourself</h3>\\n<p>Open a new terminal and print where you are.</p>\\n<pre><code class=\\\"language-bash\\\">$ pwd\\n/home/student</code></pre>\\n\\n<h3>Exercise 2: Absolute jump</h3>\\n<p>Go to <code>/usr/local/bin</code> with one command, then check.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /usr/local/bin\\n$ pwd\\n/usr/local/bin</code></pre>\\n\\n<h3>Exercise 3: Climb up</h3>\\n<p>From <code>/usr/local/bin</code>, go up one level, then up another.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd ..\\n$ pwd\\n/usr/local\\n$ cd ..\\n$ pwd\\n/usr</code></pre>\\n\\n<h3>Exercise 4: Relative move</h3>\\n<p>From <code>/usr</code>, go into <code>bin</code> <em>without</em> typing a leading <code>/</code>.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd bin\\n$ pwd\\n/usr/bin</code></pre>\\n\\n<h3>Exercise 5: Back home</h3>\\n<p>Return to your home directory with the shortest command possible.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd\\n$ pwd\\n/home/student</code></pre>\\n\\n<h3>Exercise 6: Predict first, then run</h3>\\n<p>Before running these, write down where you think you will end up. Then check with <code>pwd</code>.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /etc\\n$ cd ../usr/local\\n$ pwd</code></pre>\\n<p><strong>Answer:</strong> <code>/usr/local</code>. <code>..</code> takes you from <code>/etc</code> up to <code>/</code>, then <code>usr/local</code> goes down from there.</p>\\n\\n<h3>Exercise 7: Make a mistake on purpose</h3>\\n<p>Try to go into a directory that does not exist:</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /home/nothing-here\\nbash: cd: /home/nothing-here: No such file or directory</code></pre>\\n<p>This error is normal. It just means the path is wrong. Check your spelling, and remember that Linux is <strong>case-sensitive</strong>: <code>Documents</code> and <code>documents</code> are different names.</p>\\n\\n<h3>Quick quiz</h3>\\n<ol>\\n<li><p>Which command shows your current directory? <em>(Answer: <code>pwd</code>)</em></p></li>\\n<li><p>Does <code>cd docs</code> use an absolute or a relative path? <em>(Answer: relative, because it has no leading <code>/</code>)</em></p></li>\\n<li><p>You are in <code>/home/student/Documents</code>. Where does <code>cd ..</code> take you? <em>(Answer: <code>/home/student</code>)</em></p></li>\\n<li><p>What does <code>~</code> stand for? <em>(Answer: your home directory)</em></p></li>\\n</ol>\\n<p><strong>Tip:</strong> press <code>Tab</code> while typing a directory name and the terminal will complete it for you. This saves typing and avoids spelling mistakes.</p>\", \"summary\": \"Learn to find where you are and move around the Linux file system with pwd and cd, with hands-on practice.\"}','Add file system exploration exercise','4d962294-7085-4522-8194-579abd7595a4','2026-10-15 13:14:19.868'),('2352a7f9-307f-4570-ac7d-4e8ce861fe55','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','UPDATE','{\"title\": \"Basic Commands\", \"content\": \"<h2>Moving Around the Linux File System</h2>\\n<p>When you open a terminal, you are always \\\"standing\\\" inside one folder. Linux calls folders <strong>directories</strong>. In this chapter you will learn three things: how to see where you are, how to move to another directory, and how to get back home.</p>\\n<p><strong>What you will learn:</strong></p>\\n<ul>\\n<li><p><code>pwd</code>: shows where you are right now</p></li>\\n<li><p><code>cd</code>: moves you to another directory</p></li>\\n<li><p>Going back to your home directory from anywhere</p></li>\\n<li><p>Absolute paths vs relative paths</p></li>\\n<li><p>The parent directory <code>..</code> and the current directory <code>.</code></p></li>\\n</ul>\\n\\n<h2>Before you start</h2>\\n<table>\\n<tbody>\\n<tr><th><p>Item</p></th><th><p>What you need</p></th></tr>\\n<tr><td><p>System</p></td><td><p>Any Linux distribution (Ubuntu, Fedora, Debian…) or macOS Terminal</p></td></tr>\\n<tr><td><p>Software</p></td><td><p>Nothing to install. These commands are built in.</p></td></tr>\\n<tr><td><p>Permissions</p></td><td><p>A normal user account is enough. You do not need root or <code>sudo</code>.</p></td></tr>\\n</tbody>\\n</table>\\n<p><strong>How to read the examples:</strong> each example line starts with a prompt such as <code>student@linux:~$</code>. You type only what comes <em>after</em> the <code>$</code>. Lines with no prompt are what Linux prints back to you.</p>\\n<blockquote><p><code>$</code> means \\\"run as a normal user\\\". <code>#</code> means \\\"run as root (administrator)\\\". Every command in this chapter uses <code>$</code>.</p></blockquote>\\n\\n<h2>The file system is a tree</h2>\\n<p>Linux keeps every file in one big tree. The top of the tree is called the <strong>root</strong> and is written as a single slash <code>/</code>. Everything else lives inside it:</p>\\n<pre><code class=\\\"language-plaintext\\\">/                  ← root, the top of everything\\n├── etc            ← system settings\\n├── home           ← users\' personal folders\\n│   └── student    ← YOUR home directory\\n│       ├── Documents\\n│       └── Downloads\\n└── usr\\n    ├── bin        ← programs\\n    └── local\\n        └── bin</code></pre>\\n<p>Read it like this: <code>student</code> is inside <code>home</code>, and <code>home</code> is inside <code>/</code>. Written as a path, that is <code>/home/student</code>.</p>\\n\\n<h2>1. pwd: where am I?</h2>\\n<p><code>pwd</code> stands for <strong>p</strong>rint <strong>w</strong>orking <strong>d</strong>irectory. It tells you which directory you are in right now.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ pwd\\n/home/student</code></pre>\\n<p>Linux printed <code>/home/student</code>, so you are in your home directory. Whenever you feel lost, type <code>pwd</code>.</p>\\n\\n<h2>2. cd: go somewhere else</h2>\\n<p><code>cd</code> stands for <strong>c</strong>hange <strong>d</strong>irectory. Type <code>cd</code>, a space, and the place you want to go.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ cd /etc\\nstudent@linux:/etc$ pwd\\n/etc</code></pre>\\n<p>Notice that the prompt changed from <code>~</code> to <code>/etc</code>. Many terminals show your current location in the prompt. <code>cd</code> prints nothing when it works. Silence means success.</p>\\n\\n<h2>3. Going home</h2>\\n<p>Your <strong>home directory</strong> is your personal folder (for example <code>/home/student</code>). The terminal starts there, and the prompt shows it as <code>~</code>. To jump back home from anywhere, type <code>cd</code> on its own:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/local/bin$ pwd\\n/usr/local/bin\\nstudent@linux:/usr/local/bin$ cd\\nstudent@linux:~$ pwd\\n/home/student</code></pre>\\n<p><code>cd ~</code> does exactly the same thing.</p>\\n\\n<h2>4. Absolute paths: the full address</h2>\\n<p>An <strong>absolute path</strong> always starts with <code>/</code>. It is the full address from the root of the tree, so it works no matter where you are standing.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/etc$ cd /home/student\\nstudent@linux:~$ pwd\\n/home/student</code></pre>\\n<p>Think of it like a full postal address: country, city, street, house.</p>\\n\\n<h2>5. Relative paths: directions from here</h2>\\n<p>A <strong>relative path</strong> does <em>not</em> start with <code>/</code>. It starts from the directory you are in now.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:~$ cd /usr\\nstudent@linux:/usr$ cd bin\\nstudent@linux:/usr/bin$ pwd\\n/usr/bin</code></pre>\\n<p>Because you were in <code>/usr</code>, <code>cd bin</code> took you to <code>/usr/bin</code>, <strong>not</strong> to <code>/bin</code> or <code>/usr/local/bin</code>. That one missing <code>/</code> changes where you end up.</p>\\n<table>\\n<tbody>\\n<tr><th><p>You type</p></th><th><p>Type of path</p></th><th><p>Where you end up (starting in <code>/usr</code>)</p></th></tr>\\n<tr><td><p><code>cd bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/bin</code></p></td></tr>\\n<tr><td><p><code>cd /bin</code></p></td><td><p>Absolute</p></td><td><p><code>/bin</code></p></td></tr>\\n<tr><td><p><code>cd local/bin</code></p></td><td><p>Relative</p></td><td><p><code>/usr/local/bin</code></p></td></tr>\\n</tbody>\\n</table>\\n\\n<h2>6. The parent directory: ..</h2>\\n<p>Two dots <code>..</code> mean \\\"the directory one level up\\\", which is the one that contains where you are now. It is called the <strong>parent directory</strong>.</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/bin$ cd ..\\nstudent@linux:/usr$ pwd\\n/usr</code></pre>\\n<p>You can go up more than one level at a time:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/local/bin$ cd ../..\\nstudent@linux:/usr$ pwd\\n/usr</code></pre>\\n\\n<h2>7. The current directory: .</h2>\\n<p>One dot <code>.</code> means \\\"right here\\\". <code>cd .</code> keeps you where you are:</p>\\n<pre><code class=\\\"language-bash\\\">student@linux:/usr/bin$ cd .\\nstudent@linux:/usr/bin$ pwd\\n/usr/bin</code></pre>\\n<p>This seems useless now, but you will use <code>.</code> later, for example to run a script in the current folder with <code>./script.sh</code>.</p>\\n\\n<h2>Cheat sheet</h2>\\n<table>\\n<tbody>\\n<tr><th><p>Command</p></th><th><p>What it does</p></th></tr>\\n<tr><td><p><code>pwd</code></p></td><td><p>Show where I am</p></td></tr>\\n<tr><td><p><code>cd /path/to/dir</code></p></td><td><p>Go to a directory using its full (absolute) path</p></td></tr>\\n<tr><td><p><code>cd dirname</code></p></td><td><p>Go into a directory inside the current one (relative path)</p></td></tr>\\n<tr><td><p><code>cd</code> or <code>cd ~</code></p></td><td><p>Go to my home directory</p></td></tr>\\n<tr><td><p><code>cd ..</code></p></td><td><p>Go up one level, to the parent directory</p></td></tr>\\n<tr><td><p><code>cd -</code></p></td><td><p>Go back to the directory I was in before</p></td></tr>\\n<tr><td><p><code>cd .</code></p></td><td><p>Stay here (<code>.</code> = current directory)</p></td></tr>\\n</tbody>\\n</table>\\n\\n<h2>Practice</h2>\\n<p>Open a terminal and try each exercise. Run <code>pwd</code> after every <code>cd</code> to check yourself. Expected output is shown for a user named <code>student</code>. Your username will be different.</p>\\n\\n<h3>Exercise 1: Find yourself</h3>\\n<p>Open a new terminal and print where you are.</p>\\n<pre><code class=\\\"language-bash\\\">$ pwd\\n/home/student</code></pre>\\n\\n<h3>Exercise 2: Absolute jump</h3>\\n<p>Go to <code>/usr/local/bin</code> with one command, then check.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /usr/local/bin\\n$ pwd\\n/usr/local/bin</code></pre>\\n\\n<h3>Exercise 3: Climb up</h3>\\n<p>From <code>/usr/local/bin</code>, go up one level, then up another.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd ..\\n$ pwd\\n/usr/local\\n$ cd ..\\n$ pwd\\n/usr</code></pre>\\n\\n<h3>Exercise 4: Relative move</h3>\\n<p>From <code>/usr</code>, go into <code>bin</code> <em>without</em> typing a leading <code>/</code>.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd bin\\n$ pwd\\n/usr/bin</code></pre>\\n\\n<h3>Exercise 5: Back home</h3>\\n<p>Return to your home directory with the shortest command possible.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd\\n$ pwd\\n/home/student</code></pre>\\n\\n<h3>Exercise 6: Predict first, then run</h3>\\n<p>Before running these, write down where you think you will end up. Then check with <code>pwd</code>.</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /etc\\n$ cd ../usr/local\\n$ pwd</code></pre>\\n<p><strong>Answer:</strong> <code>/usr/local</code>. <code>..</code> takes you from <code>/etc</code> up to <code>/</code>, then <code>usr/local</code> goes down from there.</p>\\n\\n<h3>Exercise 7: Make a mistake on purpose</h3>\\n<p>Try to go into a directory that does not exist:</p>\\n<pre><code class=\\\"language-bash\\\">$ cd /home/nothing-here\\nbash: cd: /home/nothing-here: No such file or directory</code></pre>\\n<p>This error is normal. It just means the path is wrong. Check your spelling, and remember that Linux is <strong>case-sensitive</strong>: <code>Documents</code> and <code>documents</code> are different names.</p>\\n\\n<h3>Quick quiz</h3>\\n<ol>\\n<li><p>Which command shows your current directory? <em>(Answer: <code>pwd</code>)</em></p></li>\\n<li><p>Does <code>cd docs</code> use an absolute or a relative path? <em>(Answer: relative, because it has no leading <code>/</code>)</em></p></li>\\n<li><p>You are in <code>/home/student/Documents</code>. Where does <code>cd ..</code> take you? <em>(Answer: <code>/home/student</code>)</em></p></li>\\n<li><p>What does <code>~</code> stand for? <em>(Answer: your home directory)</em></p></li>\\n</ol>\\n<p><strong>Tip:</strong> press <code>Tab</code> while typing a directory name and the terminal will complete it for you. This saves typing and avoids spelling mistakes.</p>\", \"summary\": \"Learn to find where you are and move around the Linux file system with pwd and cd, with hands-on practice.\"}','Full filesystem tree, all top-level directories, multiple users','4d962294-7085-4522-8194-579abd7595a4','2026-10-15 13:12:29.507');
/*!40000 ALTER TABLE `content_revisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `occurrence_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `what_was_done` text COLLATE utf8mb4_unicode_ci,
  `problems_faced` text COLLATE utf8mb4_unicode_ci,
  `commands_used` text COLLATE utf8mb4_unicode_ci,
  `confidence_level` int NOT NULL DEFAULT '3',
  `needs_improvement` text COLLATE utf8mb4_unicode_ci,
  `notes_for_tomorrow` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `feedback_occurrence_id_idx` (`occurrence_id`),
  KEY `feedback_user_id_idx` (`user_id`),
  CONSTRAINT `feedback_occurrence_id_fkey` FOREIGN KEY (`occurrence_id`) REFERENCES `task_occurrences` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `feedback_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
INSERT INTO `feedback` VALUES ('a46b35cf-d2b1-4802-8297-9b28bbc37774','b6716393-059e-4509-afc0-38c1c0b9ad12','e265668a-cf84-4f17-b39b-dd13a4ec1429','I have practiced all basic commands','Nothing all was easy','ls, pwd, cd',5,'Multi language support ','I will practice again','2026-10-15 13:18:24.924','2026-10-15 13:18:24.924');
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_progress`
--

DROP TABLE IF EXISTS `learning_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_progress` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mastery` double NOT NULL DEFAULT '0',
  `tasks_completed` int NOT NULL DEFAULT '0',
  `avg_confidence` double NOT NULL DEFAULT '0',
  `avg_time_spent` double NOT NULL DEFAULT '0',
  `last_practiced_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `learning_progress_user_id_scope_key_key` (`user_id`,`scope_key`),
  KEY `learning_progress_user_id_subject_id_idx` (`user_id`,`subject_id`),
  CONSTRAINT `learning_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_progress`
--

LOCK TABLES `learning_progress` WRITE;
/*!40000 ALTER TABLE `learning_progress` DISABLE KEYS */;
INSERT INTO `learning_progress` VALUES ('26759e01-1f3f-42d1-b935-92f614b457e6','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89',16.666666666666664,1,5,0,'2026-10-15 13:18:24.992','2026-10-15 13:18:24.996','2026-10-15 13:18:24.996');
/*!40000 ALTER TABLE `learning_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_read_idx` (`user_id`,`read`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('3d614139-e62c-4c30-860e-cbcf747d0b48','e265668a-cf84-4f17-b39b-dd13a4ec1429','New practice task assigned','Administrator assigned \"Where am I? Using pwd\" in \"Linux\" (Once on 2026-10-15).','assign','/tasks',0,'2026-10-15 13:14:39.845','2026-10-15 13:14:39.845'),('8ee6549a-81a3-48bb-98f4-3a6107745370','e265668a-cf84-4f17-b39b-dd13a4ec1429','New practice task assigned','Administrator assigned \"Absolute vs relative paths\" in \"Linux\" (Once on 2026-10-17).','assign','/tasks',0,'2026-10-15 13:14:39.894','2026-10-15 13:14:39.894'),('afa6adde-6ced-45d4-ba49-064c2ff9421e','e265668a-cf84-4f17-b39b-dd13a4ec1429','New practice task assigned','Administrator assigned \"Navigation challenge\" in \"Linux\" (Once on 2026-10-19).','assign','/tasks',1,'2026-10-15 13:14:39.941','2026-10-15 13:17:13.727'),('ceb85e5f-412a-4f4d-8322-37fd9e3275f5','e265668a-cf84-4f17-b39b-dd13a4ec1429','New practice task assigned','Administrator assigned \"Tour the root directory\" in \"Linux\" (Once on 2026-10-16).','assign','/tasks',0,'2026-10-15 13:14:39.873','2026-10-15 13:14:39.873'),('d490eda7-dcef-4117-8992-5d55ca28b954','e265668a-cf84-4f17-b39b-dd13a4ec1429','New practice task assigned','Administrator assigned \"Explore users and system folders\" in \"Linux\" (Once on 2026-10-18).','assign','/tasks',0,'2026-10-15 13:14:39.919','2026-10-15 13:14:39.919');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `read_progress`
--

DROP TABLE IF EXISTS `read_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `read_progress` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_opened_at` datetime(3) DEFAULT NULL,
  `last_opened_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  `time_spent_sec` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `read_progress_user_id_scope_key_key` (`user_id`,`scope_key`),
  KEY `read_progress_user_id_subject_id_idx` (`user_id`,`subject_id`),
  CONSTRAINT `read_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `read_progress`
--

LOCK TABLES `read_progress` WRITE;
/*!40000 ALTER TABLE `read_progress` DISABLE KEYS */;
INSERT INTO `read_progress` VALUES ('27c2f386-7f65-49a1-80fa-8aa6e3eb2547','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'9d57a151-d84a-4a03-bf92-8795b43d8ec8','2026-10-15 13:14:14.483','2026-10-15 13:20:26.636',NULL,18,'2026-10-15 13:14:14.485','2026-10-15 13:20:26.643'),('8a55ce46-d16c-49dd-9188-96ec85177694','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','785ce28f-ca6f-47b6-b8e1-9e36679abf89','2026-10-15 13:14:23.473','2026-10-15 13:20:35.866',NULL,52,'2026-10-15 12:58:06.447','2026-10-15 13:20:35.874'),('c1b869cb-4e5d-452e-9ea0-760d1994bdc6','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','785ce28f-ca6f-47b6-b8e1-9e36679abf89','2026-10-15 12:54:56.550','2026-10-15 13:19:28.524',NULL,779,'2026-10-15 12:54:56.556','2026-10-15 13:19:28.533'),('cff2295c-256a-4575-8945-08845c7cd130','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'9d57a151-d84a-4a03-bf92-8795b43d8ec8','2026-10-15 12:54:53.564','2026-10-15 13:15:35.611',NULL,11,'2026-10-15 12:54:53.567','2026-10-15 13:15:35.614');
/*!40000 ALTER TABLE `read_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `streaks`
--

DROP TABLE IF EXISTS `streaks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `streaks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily',
  `current_count` int NOT NULL DEFAULT '0',
  `longest_count` int NOT NULL DEFAULT '0',
  `last_active_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `streaks_user_id_type_key` (`user_id`,`type`),
  CONSTRAINT `streaks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `streaks`
--

LOCK TABLES `streaks` WRITE;
/*!40000 ALTER TABLE `streaks` DISABLE KEYS */;
INSERT INTO `streaks` VALUES ('edfc2f72-7fc6-4691-86a0-4964da13d21d','e265668a-cf84-4f17-b39b-dd13a4ec1429','daily',1,1,'2026-10-15 00:00:00.000','2026-10-15 13:18:24.952','2026-10-15 13:18:24.952');
/*!40000 ALTER TABLE `streaks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `study_events`
--

DROP TABLE IF EXISTS `study_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `study_events` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('OPEN','COMPLETE','UNCOMPLETE','RESET') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `study_events_user_id_subject_id_created_at_idx` (`user_id`,`subject_id`,`created_at`),
  CONSTRAINT `study_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `study_events`
--

LOCK TABLES `study_events` WRITE;
/*!40000 ALTER TABLE `study_events` DISABLE KEYS */;
INSERT INTO `study_events` VALUES ('08cf09ff-2ed6-4a12-98db-737fe5cfa59e','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','RESET','2026-10-15 12:58:06.619'),('0bd2f179-fa1e-4f54-b768-92fdd1714391','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:15:35.695'),('0ca478fa-1f26-43a6-be88-7a50033c4c9c','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:10:44.416'),('28f4c272-c52f-4116-9f3a-038539947864','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','COMPLETE','2026-10-15 12:58:06.526'),('2aa26b42-afd4-4302-a4d9-bc6b373554c7','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 12:55:05.216'),('4b97750f-ec41-4d0b-b715-d84044c45e14','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','UNCOMPLETE','2026-10-15 12:58:06.559'),('554af13f-1403-4969-8583-ff66cb13cc74','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:14:50.745'),('5b948544-837a-48c2-bdc8-156d34deb209','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:14:23.486'),('6d7b3660-a083-410e-a831-98a80c58c7e5','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:10:42.429'),('70e89e6f-9575-4e5f-b8ef-e1019c65c227','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:15:33.353'),('93bc2925-993b-4637-b760-07328e3351b1','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 12:54:56.565'),('a0fc770e-c755-4464-99c6-78b545728ac2','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:03:55.143'),('a6a1f244-8827-438c-b79d-bdbb1150f7cd','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','COMPLETE','2026-10-15 12:58:06.593'),('ad471839-7440-4f48-a0a8-9b2f45f8bc7e','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:20:24.523'),('ba8fe12c-ac50-40e5-ab09-33b3f43bae88','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:19:53.913'),('bd71ca81-1a7c-49ad-9b74-1e1df7b9592d','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 13:14:14.498'),('c738ccb3-7327-4861-b371-063a46400c0c','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:20:26.656'),('c7edc0bb-e2c3-437c-af12-c68e3b924606','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 12:55:12.274'),('d1e4ffdd-c06a-4ee5-99a3-08ce00db7755','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','COMPLETE','2026-10-15 12:55:08.964'),('d60f4cf3-7f7a-4472-9ea2-9b4c5265dc1f','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 12:55:07.676'),('e03d7560-7820-488d-a99a-cb3d4e4c3963','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 12:54:53.574'),('f113a605-4b46-46fd-b713-301106c1f4a8','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 13:19:56.402'),('f646da63-2d6a-4881-8cf5-756e082812a5','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','UNCOMPLETE','2026-10-15 12:55:13.771'),('f8131ba3-df1b-4186-b583-23b608c15439','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','OPEN','2026-10-15 12:58:06.465'),('fe42f6d5-d1eb-4194-b413-33a9bd4b9dd6','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'OPEN','2026-10-15 12:55:10.484');
/*!40000 ALTER TABLE `study_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `study_time`
--

DROP TABLE IF EXISTS `study_time`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `study_time` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `day` date NOT NULL,
  `seconds` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `study_time_user_id_scope_key_day_key` (`user_id`,`scope_key`,`day`),
  KEY `study_time_user_id_subject_id_day_idx` (`user_id`,`subject_id`,`day`),
  CONSTRAINT `study_time_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `study_time`
--

LOCK TABLES `study_time` WRITE;
/*!40000 ALTER TABLE `study_time` DISABLE KEYS */;
INSERT INTO `study_time` VALUES ('15c626a9-c278-4da3-991b-25a415bcc6e9','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','785ce28f-ca6f-47b6-b8e1-9e36679abf89','2026-10-15',52),('38dffb82-3e64-4b70-8b51-ae50ad3aa1eb','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'9d57a151-d84a-4a03-bf92-8795b43d8ec8','2026-10-15',11),('c67774e6-0f4b-4e5c-bb45-3586505f738c','e265668a-cf84-4f17-b39b-dd13a4ec1429','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','785ce28f-ca6f-47b6-b8e1-9e36679abf89','2026-10-15',779),('f987e8e9-8783-4bf5-943a-102cf2ff32ba','4d962294-7085-4522-8194-579abd7595a4','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'9d57a151-d84a-4a03-bf92-8795b43d8ec8','2026-10-15',18);
/*!40000 ALTER TABLE `study_time` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subject_members`
--

DROP TABLE IF EXISTS `subject_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subject_members` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('VIEWER','EDITOR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VIEWER',
  `granted_by_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `subject_members_subject_id_user_id_key` (`subject_id`,`user_id`),
  KEY `subject_members_user_id_idx` (`user_id`),
  KEY `subject_members_granted_by_id_fkey` (`granted_by_id`),
  CONSTRAINT `subject_members_granted_by_id_fkey` FOREIGN KEY (`granted_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `subject_members_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `subject_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subject_members`
--

LOCK TABLES `subject_members` WRITE;
/*!40000 ALTER TABLE `subject_members` DISABLE KEYS */;
INSERT INTO `subject_members` VALUES ('bffd63cd-c181-43f8-88c5-ddb28624b556','9d57a151-d84a-4a03-bf92-8795b43d8ec8','e265668a-cf84-4f17-b39b-dd13a4ec1429','VIEWER','4d962294-7085-4522-8194-579abd7595a4','2026-10-15 13:14:39.825');
/*!40000 ALTER TABLE `subject_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `visibility` enum('PUBLIC','LISTED','PRIVATE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PRIVATE',
  `status` enum('DRAFT','PUBLISHED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `category_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT '#6366f1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `content_updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `subjects_owner_id_idx` (`owner_id`),
  KEY `subjects_visibility_status_idx` (`visibility`,`status`),
  KEY `subjects_category_id_fkey` (`category_id`),
  CONSTRAINT `subjects_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `subjects_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subjects`
--

LOCK TABLES `subjects` WRITE;
/*!40000 ALTER TABLE `subjects` DISABLE KEYS */;
INSERT INTO `subjects` VALUES ('9d57a151-d84a-4a03-bf92-8795b43d8ec8','4d962294-7085-4522-8194-579abd7595a4','Linux',NULL,NULL,'PUBLIC','PUBLISHED',NULL,NULL,'#6366f1','2026-10-15 12:34:33.781','2026-10-15 12:34:33.781',NULL,'2026-10-15 12:34:33.781');
/*!40000 ALTER TABLE `subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_occurrences`
--

DROP TABLE IF EXISTS `task_occurrences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_occurrences` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('PENDING','IN_PROGRESS','COMPLETED','SKIPPED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `completed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_occurrences_task_id_due_date_key` (`task_id`,`due_date`),
  KEY `task_occurrences_user_id_due_date_idx` (`user_id`,`due_date`),
  CONSTRAINT `task_occurrences_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `task_occurrences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_occurrences`
--

LOCK TABLES `task_occurrences` WRITE;
/*!40000 ALTER TABLE `task_occurrences` DISABLE KEYS */;
INSERT INTO `task_occurrences` VALUES ('b6716393-059e-4509-afc0-38c1c0b9ad12','eda6c2c2-7421-4989-ae38-5db47ac61c40','e265668a-cf84-4f17-b39b-dd13a4ec1429','2026-10-15','COMPLETED','2026-10-15 13:18:24.920','2026-10-15 13:15:15.591','2026-10-15 13:18:24.932');
/*!40000 ALTER TABLE `task_occurrences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_sessions`
--

DROP TABLE IF EXISTS `task_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `occurrence_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` datetime(3) DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `task_sessions_occurrence_id_idx` (`occurrence_id`),
  KEY `task_sessions_user_id_idx` (`user_id`),
  CONSTRAINT `task_sessions_occurrence_id_fkey` FOREIGN KEY (`occurrence_id`) REFERENCES `task_occurrences` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `task_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_sessions`
--

LOCK TABLES `task_sessions` WRITE;
/*!40000 ALTER TABLE `task_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignee_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instructions` longtext COLLATE utf8mb4_unicode_ci,
  `difficulty` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'beginner',
  `estimated_mins` int DEFAULT NULL,
  `xp_reward` int NOT NULL DEFAULT '10',
  `frequency` enum('ONCE','DAILY','WEEKLY','MONTHLY','CUSTOM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ONCE',
  `weekdays` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `month_day` int DEFAULT NULL,
  `interval_days` int DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `generated_thru` date DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tasks_assignee_id_active_idx` (`assignee_id`,`active`),
  KEY `tasks_subject_id_idx` (`subject_id`),
  KEY `tasks_node_id_fkey` (`node_id`),
  KEY `tasks_created_by_id_fkey` (`created_by_id`),
  CONSTRAINT `tasks_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tasks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tasks_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `content_nodes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tasks_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES ('11a1b737-9b51-4a36-9dae-99f596273dc1','9d57a151-d84a-4a03-bf92-8795b43d8ec8',NULL,'4d962294-7085-4522-8194-579abd7595a4','4d962294-7085-4522-8194-579abd7595a4','tmp test',NULL,'beginner',NULL,10,'CUSTOM',NULL,NULL,2,'2026-10-15',NULL,'2026-10-14',0,'2026-10-15 13:29:39.647','2026-10-15 13:29:39.766','2026-10-15 13:29:39.761'),('4264c1a3-1771-48fe-9c67-7283bc8a0b51','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','4d962294-7085-4522-8194-579abd7595a4','e265668a-cf84-4f17-b39b-dd13a4ec1429','Navigation challenge','<p>Solve each one using <strong>only relative paths</strong> (no leading <code>/</code>) unless it says otherwise. Check every answer with <code>pwd</code>.</p>\n<ol><li><p>Start in <code>/var/log</code> → reach <code>/usr/local/bin</code>.</p></li>\n<li><p>Start in <code>/etc</code> → reach your home directory (hint: <code>~</code> is allowed).</p></li>\n<li><p>Start in <code>/usr/share</code> → reach <code>/usr/bin</code>.</p></li>\n<li><p>Predict, <em>then</em> run: from <code>/home</code>, where does <code>cd ./../etc/../tmp</code> take you?</p></li>\n<li><p>Make a typo on purpose (e.g. <code>cd /Home</code>) and explain the error.</p></li></ol>\n<p><strong>Done when:</strong> all 5 work and your prediction for #4 was right (answer: <code>/tmp</code>).</p>','beginner',20,30,'DAILY',NULL,NULL,NULL,'2026-10-19',NULL,'2026-10-14',1,'2026-10-15 13:14:39.935','2026-10-15 13:21:58.033',NULL),('812743c2-59a1-4bf6-8406-82b7b0117f74','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','4d962294-7085-4522-8194-579abd7595a4','e265668a-cf84-4f17-b39b-dd13a4ec1429','Absolute vs relative paths','<p>Reach the same places in two different ways. Run <code>pwd</code> after every move.</p>\n<ol><li><p>From your home, go to <code>/usr/local/bin</code> with an <strong>absolute</strong> path.</p></li>\n<li><p>Go back home with <code>cd</code>.</p></li>\n<li><p>Now go to <code>/usr</code>, then reach <code>/usr/local/bin</code> with a <strong>relative</strong> path.</p></li>\n<li><p>From <code>/usr/local/bin</code>, go up to <code>/usr</code> with <code>..</code> in a single command.</p></li></ol>\n<p><strong>Done when:</strong> you can say which of your commands were absolute and which were relative, and why.</p>','beginner',15,20,'WEEKLY','2,6',NULL,NULL,'2026-10-17',NULL,'2026-10-14',1,'2026-10-15 13:14:39.889','2026-10-15 13:22:20.076',NULL),('af71a60d-ca22-4ca4-8b73-517d5438a8b5','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','4d962294-7085-4522-8194-579abd7595a4','e265668a-cf84-4f17-b39b-dd13a4ec1429','Explore users and system folders','<p>Look around the parts of the system every Linux user should know.</p>\n<ol><li><p><code>ls /home</code>: how many users have a home directory? Is yours there?</p></li>\n<li><p><code>cat /etc/hostname</code>: what is your computer\'s name?</p></li>\n<li><p><code>cd /var/log</code> and <code>ls</code>: list 3 log files you see.</p></li>\n<li><p>Try <code>cd /root</code>. What error do you get, and why?</p></li>\n<li><p>Use <code>cd -</code> to jump back to the previous directory.</p></li></ol>\n<p><strong>Done when:</strong> you have answers for all 5 steps.</p>','beginner',15,20,'WEEKLY','2,3',NULL,NULL,'2026-10-18','2026-12-31','2026-10-14',1,'2026-10-15 13:14:39.913','2026-10-15 13:21:19.848',NULL),('e5201935-116d-4d73-b511-2049f3bca7a8','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','4d962294-7085-4522-8194-579abd7595a4','e265668a-cf84-4f17-b39b-dd13a4ec1429','Tour the root directory','<p>Visit the top of the file system and match it with the tree in the chapter.</p>\n<ol><li><p><code>cd /</code>, then <code>pwd</code> and <code>ls</code></p></li>\n<li><p>Pick 5 directories from the list and write one line on what each one holds (use the chapter\'s table).</p></li>\n<li><p>Find one directory in your <code>ls</code> output that is <em>not</em> in the chapter\'s table, if there is one.</p></li></ol>\n<p><strong>Done when:</strong> you have 5 directories described in your own words.</p>','beginner',10,15,'WEEKLY','5',NULL,NULL,'2026-10-16',NULL,'2026-10-14',1,'2026-10-15 13:14:39.863','2026-10-15 13:21:49.897',NULL),('eda6c2c2-7421-4989-ae38-5db47ac61c40','9d57a151-d84a-4a03-bf92-8795b43d8ec8','785ce28f-ca6f-47b6-b8e1-9e36679abf89','4d962294-7085-4522-8194-579abd7595a4','e265668a-cf84-4f17-b39b-dd13a4ec1429','Where am I? Using pwd','<p>Open a new terminal and find out where you are.</p>\n<ol><li><p>Run <code>pwd</code> and write down the output.</p></li>\n<li><p>Look at your prompt. What does <code>~</code> stand for?</p></li>\n<li><p>Run <code>echo $HOME</code>. Does it match what <code>pwd</code> printed?</p></li></ol>\n<p><strong>Done when:</strong> you can explain why <code>pwd</code>, <code>~</code> and <code>$HOME</code> all point to the same place.</p>','beginner',5,10,'CUSTOM',NULL,NULL,2,'2026-10-15','2026-10-28','2026-10-14',1,'2026-10-15 13:14:39.835','2026-10-15 13:30:19.624',NULL);
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_achievements`
--

DROP TABLE IF EXISTS `user_achievements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_achievements` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `achievement_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unlocked_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_achievements_user_id_achievement_id_key` (`user_id`,`achievement_id`),
  KEY `user_achievements_user_id_idx` (`user_id`),
  KEY `user_achievements_achievement_id_fkey` (`achievement_id`),
  CONSTRAINT `user_achievements_achievement_id_fkey` FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_achievements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_achievements`
--

LOCK TABLES `user_achievements` WRITE;
/*!40000 ALTER TABLE `user_achievements` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_achievements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','USER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `provider` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `provider_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `refresh_token` text COLLATE utf8mb4_unicode_ci,
  `level` int NOT NULL DEFAULT '1',
  `total_xp` int NOT NULL DEFAULT '0',
  `daily_task_count` int NOT NULL DEFAULT '5',
  `daily_hours` double NOT NULL DEFAULT '2',
  `difficulty` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'beginner',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('4d962294-7085-4522-8194-579abd7595a4','admin@rbasu.in','admin','$2b$12$qIzg9OhcGLLKMhXnLZ9mgOLNZYa17udsNWRqFj4NTvfWJ5Rw5cGp2','Administrator',NULL,'ADMIN','local',NULL,0,NULL,1,0,5,2,'beginner','2026-10-15 12:05:29.135','2026-10-15 13:30:25.526',NULL),('e265668a-cf84-4f17-b39b-dd13a4ec1429','learn@rbasu.in','learn','$2b$12$.QnSz3luH2X.4wwY.nqc8uk7Bfu6TX150R6OZ74DMB5x2zIYX5Sf6','Learner',NULL,'USER','local',NULL,0,NULL,1,10,5,2,'beginner','2026-10-15 12:05:30.990','2026-10-15 13:19:31.212',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xp_history`
--

DROP TABLE IF EXISTS `xp_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xp_history` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int NOT NULL,
  `source` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `xp_history_user_id_idx` (`user_id`),
  KEY `xp_history_created_at_idx` (`created_at`),
  CONSTRAINT `xp_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xp_history`
--

LOCK TABLES `xp_history` WRITE;
/*!40000 ALTER TABLE `xp_history` DISABLE KEYS */;
INSERT INTO `xp_history` VALUES ('786e8463-b968-4c28-8f61-5f4551e23808','e265668a-cf84-4f17-b39b-dd13a4ec1429',10,'task_completion','b6716393-059e-4509-afc0-38c1c0b9ad12','2026-10-15 13:18:24.938');
/*!40000 ALTER TABLE `xp_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'ai_learning_platform'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-15 14:28:44
