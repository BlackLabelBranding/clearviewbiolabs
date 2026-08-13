import webpush from "web-push";
import { createSecretAdminClient } from "@/lib/admin";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    && process.env.VAPID_PRIVATE_KEY
    && process.env.VAPID_SUBJECT
    && process.env.SUPABASE_SECRET_KEY,
  );
}

export async function sendAdminPush(payload: PushPayload) {
  if (!configured()) return { configured: false, sent: 0 };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const supabase = createSecretAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("clearview_push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (error || !subscriptions?.length) return { configured: true, sent: 0 };

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
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("clearview_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
    }
  }));

  return { configured: true, sent };
}
