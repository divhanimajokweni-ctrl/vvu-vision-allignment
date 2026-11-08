#!/usr/bin/env bash
set -euo pipefail
: "${CF_API_TOKEN:?set CF_API_TOKEN (Cloudflare DNS edit token)}"
ZONE_ID="${ZONE_ID:-2846811e65f26118c2b851b3ecd12946}"
DOMAIN="venturevisionubuntu.co.za"
api(){ curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$@"; }
upsert(){
  local type=$1 name=$2 content=$3 priority=${4:-}
  local fqdn="$name.$DOMAIN"
  [ "$name" = "@" ] && fqdn="$DOMAIN"
  local id
  id=$(api "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=$type&name=$fqdn&per_page=100" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=[x for x in (d.get("result") or []) if x.get("name")=="'"$fqdn"'"]; print(r[0]["id"] if r else "")')
  local body
  body=$(TYPE="$type" NAME="$name" CONTENT="$content" PRIORITY="$priority" python3 - <<'PY'
import json,os
d={"type":os.environ["TYPE"],"name":os.environ["NAME"],"content":os.environ["CONTENT"],"ttl":1,"proxied":False}
if os.environ.get("PRIORITY"): d["priority"]=int(os.environ["PRIORITY"])
print(json.dumps(d))
PY
)
  if [ -n "$id" ]; then
    api -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$id" --data "$body" >/dev/null
    echo "updated $type $fqdn"
  else
    api -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" --data "$body" >/dev/null
    echo "created $type $fqdn"
  fi
}
upsert TXT resend._domainkey 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQ3b62Iuki4dHg6QQCo2RamTshVFzUmuGteGidwyopvCgpvxhnUUYiIoJqSJdXHFCspp6dSxjh7qbEn3owZM2av2aIpusd1KqK1tE3MnSs4O3OjuHciA/t6sciBYfatPxd69c7UrrxSaSVYrinIozP2iUi4HSVyeJQduJz6MKnkwIDAQAB'
upsert MX send feedback-smtp.eu-west-1.amazonses.com 10
upsert TXT send 'v=spf1 include:amazonses.com ~all'
upsert CNAME mail send.forge.rmta.net
upsert TXT _dmarc 'v=DMARC1; p=quarantine; rua=mailto:admin@venturevisionubuntu.co.za'
echo "done: DKIM/SPF/Forge/DMARC upserted. Root @ MX NOT changed (keep Google Workspace). Run Resend verify with RESEND_API_KEY."
