#!/bin/sh
# Builds the distributable plugin zip one level up (../ikumihost-plugin.zip).
# The manifest (.claude-plugin/plugin.json) must sit at the ZIP ROOT, so we
# zip the folder's contents from inside it — never the parent folder.
#
# v2.x: the plugin is a thin pointer — skill + remote URL connector. The local
# stdio server in mcp/ is legacy (pre-remote-MCP) and no longer ships.
set -e
cd "$(dirname "$0")"

ZIP=../ikumihost-plugin.zip
rm -f "$ZIP"
zip -r "$ZIP" .claude-plugin .mcp.json skills \
  -x "*.DS_Store"

unzip -l "$ZIP"
