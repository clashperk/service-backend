#!/bin/zsh

seq 1 200 | xargs -n1 -P10 -I {} zsh -c '
  id=$1
  resp=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" "https://api.clashperk.com/v1/health")
  code=${resp% *}
  time=${resp#* }
  if [[ "$code" == "200" ]]; then
    printf "Req %-3s: \033[32m%s\033[0m (%ss)\n" "$id" "$code" "$time"
  elif [[ "$code" == "429" ]]; then
    printf "Req %-3s: \033[31m%s\033[0m (%ss)\n" "$id" "$code" "$time"
  else
    printf "Req %-3s: \033[33m%s\033[0m (%ss)\n" "$id" "$code" "$time"
  fi
' -- {}