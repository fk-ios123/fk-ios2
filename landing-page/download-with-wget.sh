#!/usr/bin/env bash
set -euo pipefail

output_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hosts=(
  vqnlrg.elm-ec.com
  xgqosq.elm-ec.com
  mbhhrx.elm-ec.com
  zxdsra.elm-ec.com
  rbouzb.elm-ec.com
)
langs=(en de fr es pt ru ja ko th vi ar zh-TW)

for host in "${hosts[@]}"; do
  wget \
    --mirror \
    --page-requisites \
    --convert-links \
    --adjust-extension \
    --no-parent \
    --no-host-directories \
    --domains "$host" \
    --directory-prefix "$output_dir/$host" \
    "https://$host/"

  # These JSON files are requested by JavaScript and are not discovered by wget.
  case "$host" in
    vqnlrg.elm-ec.com|xgqosq.elm-ec.com|rbouzb.elm-ec.com)
      mkdir -p "$output_dir/$host/i18n"
      for lang in "${langs[@]}"; do
        wget \
          --timestamping \
          --directory-prefix "$output_dir/$host/i18n" \
          "https://$host/i18n/$lang.json"
      done
      ;;
  esac
done
