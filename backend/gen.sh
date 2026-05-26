#!/bin/bash
set -euo pipefail

DST_PATH="./schemas"

mkdir -p "$DST_PATH"
rm -f "${DST_PATH}/schema."*

SUBDOMAIN="local"
REGION="local"
ADMIN_SECRET="nhost-admin-secret"

ROLES=(admin user public)

HASURA_URL="https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql"
CONSTELLATION_URL="https://${SUBDOMAIN}.graphql.${REGION}.nhost.run/v1/graphql"

for role in "${ROLES[@]}"; do
    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${HASURA_URL}" -o "${DST_PATH}/schema.hasura.${role}.graphqls"

    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${CONSTELLATION_URL}" -o "${DST_PATH}/schema.nhost.${role}.graphqls"

    nhost schema diff \
        -a "${DST_PATH}/schema.hasura.${role}.graphqls" \
        -b "${DST_PATH}/schema.nhost.${role}.graphqls" > "${DST_PATH}/schema.${role}.diff"
done
