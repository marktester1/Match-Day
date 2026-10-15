// Firebase settings for the web/phone version of Match Day.
// These values aren't secret: they only say which project to talk to. firestore.rules is what protects the data.
//
// Live and beta are separate Firebase projects with separate data and sign-ins. The same app files run
// on both, so the app picks the project from the address it was opened at. Everything that isn't the
// live address (the beta site, localhost) uses beta, so testing can never touch coaches' real data.

const LIVE = {
  apiKey: "AIzaSyAqd7wV2g8dJbOq7LbcwBP-9t41mBXJY7M",
  authDomain: "match-day-17b23.firebaseapp.com",
  projectId: "match-day-17b23",
  storageBucket: "match-day-17b23.firebasestorage.app",
  messagingSenderId: "723961484661",
  appId: "1:723961484661:web:919e5b4dc79db341cb6f3c"
};

const BETA = {
  apiKey: "AIzaSyC5fHSwbGk_pD5_d3ReylAv6Yr_CaEkH5c",
  authDomain: "match-day-beta-17b23.firebaseapp.com",
  projectId: "match-day-beta-17b23",
  storageBucket: "match-day-beta-17b23.firebasestorage.app",
  messagingSenderId: "67324947064",
  appId: "1:67324947064:web:f6d0ebd9ca7a5425b71b8d"
};

const LIVE_HOSTS = ["match-day-17b23.web.app", "match-day-17b23.firebaseapp.com"];

export const ENV = LIVE_HOSTS.includes(location.hostname) ? "live" : "beta";
export default ENV === "live" ? LIVE : BETA;
