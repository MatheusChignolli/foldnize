# macOS signing and notarization

Production macOS releases are signed with a **Developer ID Application**
certificate and notarized by Apple. The release workflow fails instead of
publishing an unsigned macOS build when credentials are absent or invalid.

Never commit the `.p12`, `.p8`, or their passwords to this repository.

## Required GitHub secrets

Open the repository on GitHub, then go to **Settings → Secrets and variables →
Actions → New repository secret** and create these secrets:

| Secret | Value |
| --- | --- |
| `MAC_CERTIFICATE_BASE64` | Base64 representation of the exported Developer ID Application `.p12` file |
| `MAC_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` file |
| `APPLE_API_KEY_BASE64` | Base64 representation of the App Store Connect `.p8` API key |
| `APPLE_API_KEY_ID` | Key ID shown for the App Store Connect API key |
| `APPLE_API_ISSUER` | Issuer ID shown on the App Store Connect Integrations page |

`APPLE_TEAM_ID` is not required when notarizing with an App Store Connect API
key. It is different from the API key's Issuer ID.

## Encode the files

Run these commands locally from the folder containing the private files. They
copy the base64 values to the macOS clipboard without modifying the files:

```bash
base64 -i DeveloperIDApplication.p12 | tr -d '\n' | pbcopy
base64 -i AuthKey_KEYID.p8 | tr -d '\n' | pbcopy
```

After each command, paste the clipboard into its corresponding GitHub secret.
Replace the example filenames with the actual filenames.

## Publish and verify

Publish a new GitHub release using a tag that matches the app version, for
example `foldnize-app-v1.0.2`. The workflow signs the `.app`, submits it to
Apple's notary service, staples the notarization ticket, and packages the DMG.

After downloading the release artifact on a Mac, verify it with:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Foldnize.app
spctl --assess --type execute --verbose=2 /Applications/Foldnize.app
xcrun stapler validate /Applications/Foldnize.app
```

The Gatekeeper assessment should report `accepted` and identify the source as
`Notarized Developer ID`.
