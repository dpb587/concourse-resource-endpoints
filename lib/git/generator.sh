#!/bin/bash

# args target

FLY_TARGET="$1"
ATC_URL=$( fly -t "$FLY_TARGET" targets | grep "^$FLY_TARGET " | awk '{ print $2 }' )

(
  for pipeline in $( fly -t "$FLY_TARGET" pipelines | awk '{ print $1 }' ) ; do
    fly -t "$FLY_TARGET" get-pipeline -p "$pipeline" \
      | yaml2json /dev/stdin \
      | jq -c \
        --arg pipeline "$pipeline" \
        '
          .resources | map(select("git" == .type))
            | map({
              "check": ( $pipeline + "/" + .name ),
              "filter": {
                "uri": (
                  .source.uri
                    | gsub("^git@github.com:(?<a>.+)$"; "https://github.com/\(.a)")
                    | gsub("^(?<a>.+)\\.git$"; "\(.a)")
                ),
                "branch": ( .source.branch // "master" ),
                "paths": ( .source.paths // [] ),
                "ignore_paths": ( .source.ignore_paths // [] )
              }
            })
        '
  done
) \
  | jq --slurp \
    --arg atc_url "$ATC_URL" \
    '
      {
        "atc": {
          "url": $atc_url,
          "headers": {
            "authorization": "@todo"
          }
        },
        "secret": "@todo",
        "checks": ( flatten | unique | sort_by(.check) )
      }
    '
