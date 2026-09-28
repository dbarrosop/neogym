.PHONY: generate-project archive-release deploy-testflight
generate-project:  ## Generate xcodeproj
	xcodegen generate

archive-release: generate-project  ## Signed archive + non-upload export and verification
	bash Scripts/archive-release.sh

deploy-testflight: generate-project  ## Guarded archive, local verification, then approved upload
	bash Scripts/deploy-testflight.sh
