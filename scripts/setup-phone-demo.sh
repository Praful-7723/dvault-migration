#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
demo_dir=.dvault-demo
host=${1:-}
port=${2:-4443}
if ! node -e '
const {isIPv4} = require("node:net");
const [host, port] = process.argv.slice(1);
const [a, b] = host.split(".").map(Number);
if (!isIPv4(host) || !(a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) ||
    !/^\d{1,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) process.exit(1);
' "$host" "$port"; then
    echo "Usage: sh scripts/setup-phone-demo.sh <Mac private IPv4> [port >= 1024]" >&2
    exit 1
fi

umask 077
if [ -e "$demo_dir" ]; then
    echo "Phone setup already exists. Reuse it, or move .dvault-demo aside before generating a new one." >&2
    exit 1
fi
temp_dir=$(mktemp -d .dvault-demo-staging.XXXXXX)
trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM

cat > "$temp_dir/tls.conf" <<EOF_CONFIG
[req]
distinguished_name = name
prompt = no
[name]
CN = Dvault Private Demo
[root]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[leaf]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = IP:$host
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF_CONFIG

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$temp_dir/ca.key" 2>/dev/null
openssl req -new -x509 -key "$temp_dir/ca.key" -days 7 -sha256 \
    -config "$temp_dir/tls.conf" -extensions root -out "$temp_dir/demo-ca.pem"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$temp_dir/server.key" 2>/dev/null
openssl req -new -key "$temp_dir/server.key" -subj "/CN=$host" -out "$temp_dir/server.csr"
openssl x509 -req -in "$temp_dir/server.csr" -CA "$temp_dir/demo-ca.pem" -CAkey "$temp_dir/ca.key" \
    -CAcreateserial -days 7 -sha256 -extfile "$temp_dir/tls.conf" -extensions leaf -out "$temp_dir/server.crt"
openssl x509 -in "$temp_dir/demo-ca.pem" -outform DER -out "$temp_dir/Dvault-Demo-CA.cer"
openssl verify -CAfile "$temp_dir/demo-ca.pem" -verify_ip "$host" "$temp_dir/server.crt"
# The issued leaf is all the server needs. Keep the CA private key out of the setup bundle.
rm -f "$temp_dir/ca.key" "$temp_dir/server.csr" "$temp_dir/demo-ca.srl" "$temp_dir/tls.conf"

upload_token=$(openssl rand -hex 18)
cat > "$temp_dir/phone.env" <<EOF_ENV
DVAULT_HTTPS_ORIGIN=https://$host:$port
DVAULT_HTTPS_CERT=$demo_dir/server.crt
DVAULT_HTTPS_KEY=$demo_dir/server.key
DVAULT_DEMO_TOKEN=$upload_token
EOF_ENV
mv "$temp_dir" "$demo_dir"
echo "Phone URL  https://$host:$port/v2/"
echo "Start with node --env-file=.dvault-demo/phone.env scripts/serve.js"
echo "Transfer only .dvault-demo/Dvault-Demo-CA.cer to the phone."
