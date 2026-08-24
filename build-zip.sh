#!/bin/sh
# Builds the distributable plugin zip one level up (../ikumihost-plugin.zip).
# The manifest (.claude-plugin/plugin.json) must sit at the ZIP ROOT, so we
# zip the folder's contents from inside it — never the parent folder.
#
# The plugin is a thin pointer — skill + remote URL connector (.mcp.json
# points at mcp.ikumihost.com). No local server, nothing else to bundle.
set -e
cd "$(dirname "$0")"

ZIP=../ikumihost-plugin.zip
rm -f "$ZIP"
zip -r "$ZIP" .claude-plugin .mcp.json skills \
  -x "*.DS_Store"

unzip -l "$ZIP"
