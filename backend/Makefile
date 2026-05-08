.PHONY: deploy-run
deploy-run:
	nhost run config-deploy \
		--service-id c6e0751a-b213-458d-9ce5-c6b2d5dafdc2 \
		--config nhost/mcp/run.toml


.PHONY: dev-env-up
dev-env-up:
	nhost \
		up \
		--apply-seeds \
		--run-service nhost/mcp/run.toml:local \


.PHONY: dev-env-down
dev-env-down:
	nhost \
		down \
		--volumes
