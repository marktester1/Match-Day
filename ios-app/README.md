# Match Day for iPhone

A small native iPhone app (Swift, no third-party code) that opens the hosted Match Day web app in a
full-screen web view. App updates still go out through Firebase Hosting (beta first, then live), so
most changes need no new App Store build.

- Open `ios/App/App.xcodeproj` in Xcode.
- Which site it opens is the `MATCHDAY_URL` build setting (target App → Build Settings). It is
  **beta** for TestFlight builds. Change it to `https://match-day-17b23.web.app` (and the display
  name in `Info.plist` to "Match Day") for the App Store build.
- The page knows it's inside the app from `MatchDayApp/` in the user agent (`inApp` in index.html).
  Inside the app it hides Google sign-in (Google blocks it in apps' web views; offering it would
  also need Sign in with Apple) and web push (iOS doesn't support it in apps' web views). Native
  push and sign-in are on the backlog.
- The Match Day hosts are "app-bound domains" (`WKAppBoundDomains` in Info.plist): that's what lets
  the offline service worker run in the app. Links to anything else open in Safari or their own app.
- Bundle ID `com.markmilesconsultancy.matchday`; version is `MARKETING_VERSION`, and each TestFlight
  upload needs a higher `CURRENT_PROJECT_VERSION` (build number).

## TestFlight

Needs an Apple Developer Program membership, the account signed into Xcode (Settings → Accounts),
and the app created in App Store Connect with the bundle ID above. Then in Xcode: choose
"Any iOS Device", Product → Archive, then Distribute App → TestFlight & App Store.
