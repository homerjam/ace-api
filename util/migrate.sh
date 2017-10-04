#!/bin/bash

cd "$(dirname "$0")"

export COUCH_URL=$1
dbs=$(couchshell ls)

IFS=' ' read -r -a array <<< $dbs

export COUCH_URL=$2

for slug in ${array[@]}
do
  couchshell rmdir $slug
  couchshell mkdir $slug
  couchbackup --url $1 --db $slug > /tmp/$slug.backup
  cat /tmp/$slug.backup | couchrestore --url $2 --db $slug --parallelism 1 --buffer-size 100
done