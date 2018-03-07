#!/bin/bash

cd "$(dirname "$0")"

IFS=',' read -r -a array <<< $2

for slug in ${array[@]}
do
  # couchbackup --url $1 --db $slug > $(dirname "$(pwd)")/tmp/backup/$slug.backup

  node update-entities $1 $slug
  node update-files $1 $slug
  # node update-ecom $1 $slug
  node ../design $1 $slug
  node update-index $1 $slug
done