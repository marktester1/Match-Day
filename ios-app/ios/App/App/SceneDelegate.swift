import UIKit
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MatchDayViewController()
        window?.makeKeyAndVisible()
    }
}

/// Match Day in a full-screen web view. The app itself is the hosted web app (MatchDayURL in Info.plist),
/// so updates go out through Firebase Hosting as usual. Links to other sites (WhatsApp, email, the
/// privacy page's mailto) open outside the app.
class MatchDayViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let site = URL(string: Bundle.main.object(forInfoDictionaryKey: "MatchDayURL") as? String ?? "")!
    // The page's background (--bg), light and dark, so the status bar area and loading screen match it.
    private let pageBg = UIColor { t in t.userInterfaceStyle == .dark
        ? UIColor(red: 0x0e / 255, green: 0x15 / 255, blue: 0x11 / 255, alpha: 1)
        : UIColor(red: 0xf2 / 255, green: 0xf5 / 255, blue: 0xf0 / 255, alpha: 1) }

    // The Match Day hosts listed under WKAppBoundDomains in Info.plist. Being "app-bound" is what lets
    // the offline service worker run inside the app.
    private var appHosts: Set<String> {
        Set(Bundle.main.object(forInfoDictionaryKey: "WKAppBoundDomains") as? [String] ?? [])
    }

    override func loadView() {
        view = UIView()
        view.backgroundColor = pageBg
        let config = WKWebViewConfiguration()
        config.limitsNavigationsToAppBoundDomains = true
        config.applicationNameForUserAgent = "MatchDayApp/1.0" // the page hides features the app can't do yet
        config.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = pageBg
        webView.scrollView.backgroundColor = pageBg
        // The page starts below the clock and battery; at the bottom it runs to the edge and keeps
        // clear of the home bar itself (env(safe-area-inset-bottom)).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: site))
    }

    // Match Day pages stay in the app; anything else opens in Safari or its own app.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { return decisionHandler(.allow) }
        if let host = url.host, appHosts.contains(host), url.scheme == "https" { return decisionHandler(.allow) }
        if action.targetFrame?.isMainFrame == false { return decisionHandler(.allow) } // embedded frames, e.g. sign-in helpers
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    // target="_blank" links (e.g. Share on WhatsApp) open outside the app.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    // No signal on the very first open (before the app has saved itself for offline use).
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showOffline()
    }

    // iOS can unload a background web view to free memory; reload instead of showing a blank screen.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    private func showOffline() {
        let html = """
        <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0e1511;color:#e4ece6;font:17px -apple-system,sans-serif;text-align:center">
        <div style="padding:24px"><p style="font-size:22px;font-weight:700">No connection</p>
        <p>Match Day needs signal the first time it opens. After that it works offline.</p>
        <p><a href="\(site.absoluteString)" style="display:inline-block;margin-top:12px;padding:12px 22px;border-radius:10px;background:#2e8b4e;color:#fff;text-decoration:none;font-weight:700">Try again</a></p></div>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}
