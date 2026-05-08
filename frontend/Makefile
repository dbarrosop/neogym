# Production Nhost backend the SPA should talk to. Override by exporting
# these before invoking make.
export VITE_NHOST_SUBDOMAIN ?= spmqtxqkdoxvtrkrfnnl
export VITE_NHOST_REGION ?= eu-central-1
export VITE_MCP_URL ?= https://tcruocjehgxmkwzpnshv-3000.svc.eu-central-1.nhost.run

.PHONY: deploy-prod
deploy-prod:
	bun run build
	/tmp/cf frontend \
		deploy \
		--subdomain neogym \
		--environment production \
		--assets-dir ./.output/public/
