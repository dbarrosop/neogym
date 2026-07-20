(final: prev: {
  rover = prev.rover.overrideAttrs (old: rec {
    version = "0.24.0";

    src = final.fetchFromGitHub {
      owner = "apollographql";
      repo = "rover";
      tag = "v${version}";
      hash = "sha256-uyeePAHBDCzXzwIWrKcc9LHClwSI7DMBYod/o4LfK+Y=";
    };

    cargoDeps = final.rustPlatform.fetchCargoVendor {
      inherit src;
      hash = "sha256-uR5XvkHUmZzCHZITKgScmzqjLOIvbPyrih/0B1OpsAc=";
    };
  });

  fastlane = final.bundlerApp {
    pname = "fastlane";
    gemdir = ./fastlane;
    exes = [ "fastlane" ];

    buildInputs = [ final.makeBinaryWrapper ];

    postBuild = ''
      wrapProgram $out/bin/fastlane --set FASTLANE_SKIP_UPDATE_CHECK 1
    '';

    meta = prev.fastlane.meta;
  };
})
