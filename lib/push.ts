import webpush from "web-push";
import { createSecretAdminClient } from "@/lib/admin";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configurationStatus() {
  return {
    publicKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    privateKey: Boolean(process.env.VAPID_PRIVATE_KEY),
    subject: Boolean(process.env.VAPID_SUBJECT),
    supabaseSecret: Boolean(process.env.SUPABASE_SECRET_KEY),
  };
}

export async function sendAdminPush(payload: PushPayload) {
  const status = configurationStatus();
  if (!Object.values(status).every(Boolean)) {
    console.error("Clear View push configuration incomplete", status);
    return { configured: false, sent: 0 };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const supabase = createSecretAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("clearview_push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (error) {
    console.error("Clear View push subscription query failed", { code: error.code, message: error.message });
    return { configured: true, sent: 0 };
  }
  if (!subscriptions?.length) {
    console.warn("Clear View push skipped: no registered devices");
    return { configured: true, sent: 0 };
  }

  let sent = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 60 * 60 });
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      const message = error instanceof Error ? error.message : "Unknown push provider error";
      console.error("Clear View push delivery failed", { statusCode, message });
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("clearview_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
    }
  }));

  console.info("Clear View push delivery complete", { attempted: subscriptions.length, sent });
  return { configured: true, sent };
}
