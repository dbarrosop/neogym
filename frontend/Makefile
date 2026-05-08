.PHONY: deploy-prod
deploy-prod:
	bun run build
	/tmp/cf frontend \
		deploy \
		--subdomain neogym \
		--environment production \
		--assets-dir ./.output/public/
