#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DST_PATH="${DST_PATH:-${SCRIPT_DIR}/schemas}"

SUBDOMAIN="${NHOST_SUBDOMAIN:-local}"
REGION="${NHOST_REGION:-local}"
ADMIN_SECRET="${NHOST_ADMIN_SECRET:-nhost-admin-secret}"

# These are the roles exposed by our Hasura metadata (admin is implicit).
ROLES="admin user public"

HASURA_URL="https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql"
CONSTELLATION_URL="https://${SUBDOMAIN}.graphql.${REGION}.nhost.run/v1/graphql"

mkdir -p "$DST_PATH"
TMP_PATH=$(mktemp -d "${DST_PATH}/.schema-dump.XXXXXX")
trap 'rm -rf "$TMP_PATH"' 0
trap 'exit 1' HUP INT TERM

for role in ${ROLES}; do
    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${HASURA_URL}" -o "${TMP_PATH}/schema.hasura.${role}.graphqls"

    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${CONSTELLATION_URL}" -o "${TMP_PATH}/schema.nhost.${role}.graphqls"

    nhost schema diff \
        -a "${TMP_PATH}/schema.hasura.${role}.graphqls" \
        -b "${TMP_PATH}/schema.nhost.${role}.graphqls" > "${TMP_PATH}/schema.${role}.diff"
done

# Keep the last complete set of dumps if any generation step fails.
for role in ${ROLES}; do
    mv "${TMP_PATH}/schema.hasura.${role}.graphqls" "${DST_PATH}/"
    mv "${TMP_PATH}/schema.nhost.${role}.graphqls" "${DST_PATH}/"
    mv "${TMP_PATH}/schema.${role}.diff" "${DST_PATH}/"
done
