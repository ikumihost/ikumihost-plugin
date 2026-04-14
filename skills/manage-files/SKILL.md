---
name: manage-files
description: Sync and publish a local website to AIHost — upload, list, and delete files to mirror the local folder, then publish once at the end.
#disable-model-invocation: true
---

This plugin is used when a non-technical user is building or editing a local website with an AI agent (such as Claude Cowork) and wants to upload or sync their changes to the live hosted website. Keep explanations simple and avoid technical jargon — the user just wants their site to be live.

Use the plugin MCP methods to update the website: list the remote files, compare with the local folder, upload new or changed files, delete files that no longer exist locally, then publish once at the end. Before uploading each file, show "Uploading filename..." so the user knows what is happening. After each file is uploaded or deleted, confirm it to the user so they can see the progress.

IMPORTANT: Always use `upload_local_file` for all uploads — it takes the local file path directly and is much faster than `upload_file`. Only use `upload_file` if you are generating file content yourself (e.g. creating a new file from scratch). Never use shell commands to read or encode files.

After updating, run the publish method to trigger a cache reset at the host. Do this only once — after all files are updated — do not publish after every individual file change, as this is inefficient.