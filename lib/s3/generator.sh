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
          .resources | map(select("s3" == .type or ("semver" == .type and "s3" == (.driver // "s3"))))
            | map({
              "check": ( $pipeline + "/" + .name ),
              "filter": {
                "bucket": .source.bucket,
                "path": (
                  if .source.regexp then
                    .source.regexp | split("/")[0:-1] | join("/")
                  else
                    if .source.key then
                      .source.key
                    else
                      if .source.versioned_file then
                        .source.versioned_file
                      else
                        null
                      end
                    end
                  end
                )
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
        "checks": ( flatten | unique | sort_by(.check) )
      }
    '
