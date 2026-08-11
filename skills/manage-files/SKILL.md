---
name: manage-files
description: Sync and publish a local website to AIHost — upload, list, and delete files to mirror the local folder, then publish once at the end.
#disable-model-invocation: true
---

This plugin is used when a non-technical user is building or editing a local website with an AI agent (such as Claude Cowork) and wants to upload or sync their changes to the live hosted website. Keep explanations simple and avoid technical jargon — the user just wants their site to be live.

To sync the website:
1. Call `list_files` to get the current remote file list.
2. Use the Glob tool to find all local files in the website folder.
3. Call `upload_local_files` (plural) with the full list of local files in one call — the server processes them all in parallel and skips unchanged files automatically. Do not use shell commands to check sizes or dates. Do not call `upload_local_file` (singular) in a loop.
4. Call `delete_file` for any remote file that no longer exists locally.
5. Call `publish` once at the end.

The `upload_local_files` response already includes a summary. Report it to the user and mention any specific changes (e.g. contact form handler added).

IMPORTANT: Always use `upload_local_file` for all uploads. Never use shell commands to read, encode, or inspect files. Never compare file sizes or dates yourself — the server handles that.

After updating, run the publish method to trigger a cache reset at the host. Do this only once — after all files are updated — do not publish after every individual file change, as this is inefficient.
