DATABASE FOLDER
---------------
GitHub Pages is static hosting, so live user data cannot be stored in this repository.
The real database is a private Google Sheet. This folder holds what defines it:

Code.gs   The Apps Script backend. Paste it into Extensions > Apps Script of your
          Google Sheet and deploy it as a web app (see the setup steps).

Sheets created automatically by Code.gs:
  users     email | name | salt | hash | token | created
  messages  name | email | text | date

WARNING: every file in this repository is publicly downloadable once published.
Never put exported user data (CSV/JSON backups) in this folder or anywhere else in the repo.

announcements.json  Messages for the announcement bar (public content, safe to publish).
                    Fields: text, link (optional), label (optional), until (optional, YYYY-MM-DD:
                    the message disappears after this date). Edit the file and push; no code changes needed.

badges.html         Footer badge code (HTML and <script> tags). Paste it once; it appears on every page.
                    Only use code from providers you trust: it runs on all pages, including the login page.
