#!/bin/bash

IFS=',' read -r -a array <<< $2

for app in ${array[@]}
do
  heroku config:set --app $app $1
done