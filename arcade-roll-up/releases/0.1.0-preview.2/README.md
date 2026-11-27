# Arcade Roll-Up snippet preview

Use the same snippet slug and permanent HTTPS loader URL in every release. On world entry the loader checks `manifest.json` with caching disabled, loads the named release's matching Quest or Windows cabinet bundle, and starts its multiplayer runtime. The existing placement supplies the cabinet's position and Y rotation.

## Creator setup

For a private installation, add the contents of `placement.example.html` to the world's WebRoot HTML. It already points at the permanent GitHub Pages loader. Keep the other world markup. Place one cabinet per room on the floor with clear space in front. Set its position and Y rotation in the snippet settings. Use the host world's lighting. Starting with preview.2, set `desktop-controls="true"` to enable the cabinet's **DESKTOP PLAY** button. Quest grab controls work with either setting. The Creator SDK slug becomes available after the Altspace listing is published.

## Player controls

Grab the ball, enter three initials above it, and confirm. Grab again, pull farther back for more power, and release. Pull back-right to shoot left, or back-left to shoot right. The left, center, and right rings award 30, 10, and 50 points. The highlighted ring doubles its points. Each round has three shots.

With preview.2 and desktop controls enabled, click **DESKTOP PLAY** on the cabinet. Use **comma (,)** to aim left and **period (.)** to aim right. Press **slash (/)** to open the initials panel on your first turn and use its buttons to enter initials. After confirming, hold **slash (/)** to charge and release it to shoot. Press **Esc** or click the desktop button again to deactivate the shortcuts.

The currently hosted preview.1 still uses **A**, **D**, and **Space** on desktop. Use preview.2 for a shared-world keyboard test with Pinball.

## Publishing an update or rolling back

1. Build a new release under a new version in `releases/`. Use **Arcade Roll-Up → Export Creator Preview** first if the cabinet prefab changed. Set the new release version in `RollUpSnippetBuild.cs`, then run **Arcade Roll-Up → Build Snippet Release**.
2. On the approved GitHub host, publish the version directory with the runtime and both bundles. Verify the three URLs and test that version in a private world.
3. Update the stable `manifest.json` to point at the new version. Keep the previous directory. To roll back, point the manifest at that earlier version.
4. Leave and re-enter with an existing placement. Confirm that it loads the new build and keeps its position. Have both players re-enter before multiplayer testing so they use the same release.

Unity built both bundles for `0.1.0-preview.1`. In Unity Play Mode, both clients loaded a second test release after re-entry using the same placement and loader address. A separate loader test verified rollback to the first version.

GitHub Pages is live on preview.1. Both Unity clients loaded that hosted release after a retry. Preview.2 with keyboard isolation is staged separately for upload. The Altspace listing and a Quest re-entry test are pending. The creator prefab uses its world's local script and is updated through that world's build process.
