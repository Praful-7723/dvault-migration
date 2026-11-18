#!/bin/zsh
set -e
cd -- "${0:A:h}"
if [[ -f /Volumes/ExternalSSD/MobileStudio/env.sh ]]; then
  source /Volumes/ExternalSSD/MobileStudio/env.sh
fi
node scripts/portable.js app
