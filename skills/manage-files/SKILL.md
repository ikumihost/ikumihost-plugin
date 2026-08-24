---
name: manage-files
description: Sync and publish a local website to IkumiHost — plan the sync, upload changed files, then publish once at the end.
---

This skill is used when a user is building or editing a local website with an AI agent and wants their changes live on their hosted IkumiHost website. Keep explanations simple and avoid technical jargon — the user just wants their site to be live, and does not need to know "uploading" and "publishing" are separate steps internally. Talk about the whole thing as "publishing."

Before syncing, confirm with the user that they want this round of changes published now (e.g. "Want me to publish this to your live site?") — unless their own request already said so (e.g. "update and publish my site", "make this live"). Once you have the go-ahead, run the whole sequence below without pausing to ask again partway through — from the user's point of view, publishing is one single action, not an upload step followed by a separate publish step.

If the user seems to be in the middle of making several changes (e.g. they're likely to ask for more edits next), it's fine to offer a choice instead of assuming: "Want me to publish this now, or keep going and publish everything at the end?" Publishing is like hitting save on a document, not something to do after every small tweak — batching several changes into one publish is normal and often better.

Two ways to sync, pick based on how sure you are what changed:

- **You already know exactly which files changed** (you just edited them yourself in this conversation): call `upload_files` with just those files. Skips checking the rest of the site — much faster, especially on a site with many images or other large files that haven't changed.
- **You're not sure, or this is the first sync of the session**: call `plan_sync` with every local file. It checks the whole site and also catches files that were deleted locally and need removing remotely.

Either way:

1. For each file you're sending, get its size in bytes and the lowercase hex MD5 of its content (`md5 -q <file>` on macOS, `md5sum <file>` on Linux — one shell call for several files is fine).
2. Call `upload_files` (specific files) or `plan_sync` (everything) with that list (`path` relative to the website root, `size`, `md5`).
3. Follow the instructions in the response exactly — typically: save the returned upload script anywhere you can write to it (it only ever reads the website files, so a read-only website folder is fine — do not copy the website files anywhere), then run it with `sh`, passing the website folder's path as an argument. Confirm every line prints OK, then delete the script. Do not read, edit, or "improve" the script.
4. If a `plan_sync` response lists files that exist on the website but not locally, delete each with `delete_file` only if the user removed them on purpose — ask the user if unsure.
5. Call `publish` exactly once at the end, automatically — no extra confirmation here, since the user already agreed to publish before you started.

Report the outcome to the user in plain words (what changed and that the site is now live), and mention anything the server flagged (e.g. a contact form handler was added).

If a tool asks for authorization or returns an authentication error, tell the user to connect the IkumiHost connector (Connect button) and log in with their IkumiHost account.
