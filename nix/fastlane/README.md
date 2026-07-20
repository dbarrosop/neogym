# Fastlane Nix package inputs

This directory is the source for the repository overlay's Fastlane package. It
is not a project-local Bundler installation: `flake.nix` exposes the resulting
`fastlane` executable directly in the devshell.

- `Gemfile` pins Fastlane and the Ruby 3.4 gems it needs.
- `Gemfile.lock` pins the complete Ruby dependency graph.
- `gemset.nix` adds fixed hashes so Nix fetches and builds the graph
  reproducibly.

To update Fastlane, update the version in `Gemfile`, regenerate `Gemfile.lock`
and `gemset.nix` with Bundix, format `gemset.nix`, then verify:

```sh
nix develop . --command fastlane --version
nix flake check
```

Do not add `ios/NeoGym/Gemfile`, run `bundle install`, or install a global
Fastlane gem.
