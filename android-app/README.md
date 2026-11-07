# Match Day for Android (Google Play)

A **Trusted Web Activity**: the live Match Day web app (https://app.matchday-app.uk) running in Chrome
as a Play Store app. Notifications, Google sign-in and offline work exactly as on the web, and app
updates go out through the normal beta → live releases (no new Play upload for most changes).

`twa-manifest.json` holds the app's settings (package `com.markmilesconsultancy.matchday`, colours,
icon, notifications on). Bubblewrap, Google's tool, makes the Android project and the upload file
from it. The **signing key stays outside the project** (`~/matchday-keys/`) and is never committed.

## Steps (Mark, in Terminal)

1. **Install Bubblewrap** (once):

       npm install -g @bubblewrap/cli

   The first time it runs it may offer to download its own Java (JDK 17) and Android tools: say yes
   if it says the ones on this Mac don't suit it.

2. **Make the signing key** (once). It asks for a password (twice) and your name and company; keep
   the password in your password manager. The key file goes in `~/matchday-keys`, not the project.

       mkdir -p ~/matchday-keys
       keytool -genkeypair -v -keystore ~/matchday-keys/matchday-upload.keystore -alias matchday -keyalg RSA -keysize 2048 -validity 10000

   **Back up** `~/matchday-keys/matchday-upload.keystore` and its password somewhere safe (not
   GitHub). With Play App Signing (step 5) Google keeps the real app key; if this upload key is ever
   lost, Google can reset it, but that takes days.

3. **Make the Android project** from the settings:

       cd ~/Match-Day/android-app && bubblewrap update --skipVersionUpgrade

4. **Build the file for the Play Store.** It asks for the key's password:

       bubblewrap build

   This makes `app-release-bundle.aab` (the upload) and `app-release-signed.apk` (to try on a phone).

5. **Play Console** (play.google.com/console), once the organisation account is verified:
   - **Create app**: name "Match Day", app, free (in-app purchase later), English (United Kingdom).
   - **Testing → Internal testing → Create new release**: upload `app-release-bundle.aab`. Accept
     **Play App Signing**. Add yourself and a few coaches as testers (by Gmail address).
   - **Setup → App signing**: copy the **SHA-256 certificate fingerprint** of the **App signing
     key**, and send it to Claude. (It's public information, not a secret.)

6. **Claude** then puts `/.well-known/assetlinks.json` on the website with that fingerprint (beta first,
   then live). That's what proves the app and app.matchday-app.uk belong together; without it the app
   shows a browser address bar at the top.

7. Testers install from the link Play Console gives for internal testing.

## Updating the app itself

Only needed for app-level changes (name, icon, colours, Android version). Bump `appVersionCode` (and
`appVersionName`) in `twa-manifest.json`, then steps 3–4 and upload in Play Console.
