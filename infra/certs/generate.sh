#!/usr/bin/env bash
# Generates a self-signed CA and a broker certificate for local testing.
#
# These are TEST certificates. They are not trusted by anything outside this
# network and must never be used for the pilot deployment, where a real CA is
# required. The firmware verifies the certificate chain, so a real deployment
# with a self-signed cert here would train people to disable verification.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAYS_CA=3650
DAYS_CERT=825

mkdir -p "$DIR"

if [[ ! -f "$DIR/ca.key" ]]; then
  openssl genrsa -out "$DIR/ca.key" 4096
  openssl req -x509 -new -nodes -key "$DIR/ca.key" -sha256 -days "$DAYS_CA" \
    -subj "/CN=TuturAI Test CA/O=TuturAI" -out "$DIR/ca.crt"
  echo "created CA"
fi

# The broker is reached by IP on a hotspot, so the SAN must carry IP entries. A
# certificate with only a DNS name will fail hostname verification even though the
# chain is valid.
HOST_IP="${1:-127.0.0.1}"

openssl genrsa -out "$DIR/server.key" 2048
openssl req -new -key "$DIR/server.key" -subj "/CN=tuturai-broker" -out "$DIR/server.csr"

cat > "$DIR/server.ext" <<EOF
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,DNS:tuturai-broker,IP:127.0.0.1,IP:$HOST_IP
EOF

openssl x509 -req -in "$DIR/server.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" \
  -CAcreateserial -out "$DIR/server.crt" -days "$DAYS_CERT" -sha256 \
  -extfile "$DIR/server.ext"

echo "created server certificate for IP $HOST_IP"
echo
echo "Copy ca.crt to the firmware's NVS as the trusted CA."
echo "The firmware will never disable certificate verification."