#!/bin/bash

# Usage:
# $ ./migrate.sh SRC DEST [DB]
#
# Example:
# $ ./migrate.sh https://user:password@host https://user:password@host database

cd "$(dirname "$0")"

export COUCH_URL=$1

if [ "$3" ]
then
  DB_ARRAY=($3)
else
  DB_LIST=$(couchshell ls)
  IFS=' ' read -r -a DB_ARRAY <<< $DB_LIST
fi

export COUCH_URL=$2

for SLUG in ${DB_ARRAY[@]}
do
  couchshell rmdir $SLUG
  couchshell mkdir $SLUG
  couchbackup --url $1 --db $SLUG > /tmp/$SLUG.backup
  cat /tmp/$SLUG.backup | couchrestore --url $2 --db $SLUG --parallelism 1 --buffer-size 100
done