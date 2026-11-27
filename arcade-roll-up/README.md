# Arcade Roll-Up snippet preview

Use the same snippet slug and permanent HTTPS loader URL in every release. On world entry the loader checks `manifest.json` with caching disabled, loads the named release's matching Quest or Windows cabinet bundle, and starts its multiplayer runtime. The existing placement supplies the cabinet's position and Y rotation.

## Creator setup

After hosting is configured, use the `arcade-roll-up` snippet slug in Creator SDK. For a private installation before the slug is published, add the contents of `placement.example.html` to the world's WebRoot HTML and substitute the approved permanent loader URL. Keep the other world markup. Place one cabinet per room on the floor with clear space in front. Set its position and Y rotation in the snippet settings. Use the host world's lighting.

## Player controls

Grab the ball, enter three initials above it, and confirm. Grab again, pull farther back for more power, and release. Pull back-right to shoot left, or back-left to shoot right. The left, center, and right rings award 30, 10, and 50 points. The highlighted ring doubles its points. Each round has three shots.

## Publishing an update or rolling back

1. Build a new release under a new version in `releases/`. Use **Arcade Roll-Up → Export Creator Preview** first if the cabinet prefab changed. Set the new release version in `RollUpSnippetBuild.cs`, then run **Arcade Roll-Up → Build Snippet Release**.
2. On the approved GitHub host, publish the version directory with the runtime and both bundles. Verify the three URLs and test that version in a private world.
3. Update the stable `manifest.json` to point at the new version. Keep the previous directory. To roll back, point the manifest at that earlier version.
4. Leave and re-enter with an existing placement. Confirm that it loads the new build and keeps its position. Have both players re-enter before multiplayer testing so they use the same release.

Unity built both bundles for `0.1.0-preview.1`. In Unity Play Mode, both clients loaded a second test release after re-entry using the same placement and loader address. A separate loader test verified rollback to the first version.

GitHub hosting, the snippet listing, and a hosted Quest re-entry test are pending. The creator prefab uses its world's local script and is updated through that world's build process.
