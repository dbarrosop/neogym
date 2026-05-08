# Production Nhost backend the SPA should talk to. Override by exporting
# these before invoking make.
export VITE_NHOST_SUBDOMAIN ?= spmqtxqkdoxvtrkrfnnl
export VITE_NHOST_REGION ?= eu-central-1

.PHONY: deploy-prod
deploy-prod:
	bun run build
	/tmp/cf frontend \
		deploy \
		--subdomain neogym \
		--environment production \
		--assets-dir ./.output/public/
