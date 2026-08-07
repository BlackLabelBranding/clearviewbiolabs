"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_PASSCODE_COOKIE, currentAdminPasscode } from "@/lib/admin";

export async function unlockAdmin(formData: FormData) {
  const passcode = String(formData.get("passcode") || "").trim();
  if (passcode !== currentAdminPasscode()) {
    redirect("/admin?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PASSCODE_COOKIE, passcode, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin");
}

export async function lockAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_PASSCODE_COOKIE);
  redirect("/admin");
}
