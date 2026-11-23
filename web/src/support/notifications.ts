/// Notification permission and the Settings test notification.
///
/// On iPhone a web app can show notifications only once it's on the Home
/// Screen (iOS 16.4 or later). In Safari itself `Notification` doesn't exist.

/// "unsupported" covers Safari tabs and old iOS versions, where there's no
/// way to ask at all.
export type NotificationStatus = "unsupported" | "default" | "granted" | "denied";

export function notificationStatus(): NotificationStatus {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export type TestResult = "sent" | "unsupported" | "denied" | "failed";

/// Asks for permission if it hasn't been asked yet, then shows a notification
/// straight away. Must be called from a tap: iOS only shows the permission
/// prompt in response to one.
export async function sendTestNotification(): Promise<TestResult> {
  if (!("Notification" in window)) return "unsupported";

  // Call requestPermission before any other await, so iOS still counts it as
  // part of the tap.
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";

  const title = "Test Notification";
  const options: NotificationOptions = {
    body: "Notifications from TaskMng are working.",
    icon: new URL("icons/icon-192.png", document.baseURI).href,
    // A repeat test replaces the last one instead of piling up.
    tag: "taskmng-test",
  };

  try {
    // A Home Screen app on iOS can only show notifications through its
    // service worker; `new Notification` is there but shows nothing. The
    // constructor is only the fallback for the dev server, which has no
    // service worker.
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return "sent";
  } catch {
    return "failed";
  }
}
