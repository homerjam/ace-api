#!/bin/bash

IFS=',' read -r -a array <<< $1

for app in ${array[@]}
do
  heroku config:set --app $app $2
done