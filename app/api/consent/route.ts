import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConsentBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  institution?: string;
  institutionType?: string;
  researchConfirmed?: boolean;
  ageConfirmed?: boolean;
  sourcePage?: string;
};

export async function POST(request: Request) {
  let body: ConsentBody;
  try {
    body = await request.json() as ConsentBody;
  } catch {
    return NextResponse.json({ error: "Invalid consent data" }, { status: 400 });
  }

  if (!body.researchConfirmed || !body.ageConfirmed) {
    return NextResponse.json({ error: "Required acknowledgments must be accepted" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clearview_record_consent", {
    p_consent: {
      firstName: String(body.firstName || "").trim(),
      lastName: String(body.lastName || "").trim(),
      email: String(body.email || "").trim(),
      institution: String(body.institution || "").trim(),
      institutionType: String(body.institutionType || "").trim(),
      researchConfirmed: true,
      ageConfirmed: true,
      sourcePage: String(body.sourcePage || "/").slice(0, 200),
    },
  });

  if (error) {
    return NextResponse.json({ error: "Consent could not be recorded" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    consentId: data?.[0]?.consent_id || null,
    acceptedAt: data?.[0]?.accepted_at || null,
  });
}
