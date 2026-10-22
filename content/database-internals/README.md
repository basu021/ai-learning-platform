# Database Internals, Part I: course content

Source of the **Database Administration** subject (private, owned by admin):
7 chapters, 50 topics, 119 subtopics, 53 diagrams. Study notes written in our
own words, following Part I of *Database Internals* (Alex Petrov, O'Reilly 2019).
The book itself is not stored here.

| Path | What |
|---|---|
| `chapters/ch*.md` | Pages. `@chapter` / `@topic` / `@subtopic` start a node, `@summary` sets its subtitle; the body is a Markdown subset (see `md2html.py`) |
| `subject.md` | Subject summary and overview page |
| `diagrams/ch*.py` | Diagrams drawn as SVG (`svg.py`), referenced as `![alt](img:name)` |

## Rebuild and publish

```sh
python3 diagrams/ch1.py …        # writes img/*.svg
./render.sh                      # img/*.svg → img/*.png (Playwright image; needs .pw/node_modules/playwright)
python3 build.py check           # converts every page, lists the outline
API=… SUBJECT_ID=… JWT_SECRET=… ADMIN_ID=… ADMIN_EMAIL=… python3 build.py publish
```

`publish` uploads changed diagrams, updates the subject, **replaces the whole
outline** (old nodes are soft-deleted, so readers' "read" marks on old nodes are
lost) and recreates it. Uploaded image URLs are cached in `images.*.json`.
JWT_SECRET is the target API's secret (local: the docker-compose value;
Hostinger: `public_html/.env`). Never commit those values.
