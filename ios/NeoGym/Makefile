.PHONY: generate-project deploy-testflight
generate-project:  ## Generate xcodeproj
	xcodegen generate

deploy-testflight: generate-project  ## Archive and upload to TestFlight
	bash Scripts/deploy-testflight.sh
