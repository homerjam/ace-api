#!/usr/bin/env python
import sys
import boto

BUCKET_NAME = sys.argv[1]   # examplebucket
REGION = sys.argv[2]        # eu-west-2
DELETE_DATE = sys.argv[3]   # 2018-01-01

bucket = boto.s3.connect_to_region(REGION).get_bucket(BUCKET_NAME)

for v in bucket.list_versions():
    if (isinstance(v, boto.s3.deletemarker.DeleteMarker) and
            v.is_latest and
            DELETE_DATE in v.last_modified):
        bucket.delete_key(v.name, version_id=v.version_id)
