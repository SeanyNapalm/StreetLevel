import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const kind = String(session.metadata?.kind ?? "");
    const amountDollars = Number(session.metadata?.amountDollars ?? 0);
    const userId = String(session.metadata?.userId ?? "");
    const returnTo = String(session.metadata?.returnTo ?? "");
    const bandSlug = String(session.metadata?.bandSlug ?? "");

    if (kind !== "street_cred") {
      return NextResponse.json({ error: "Wrong session type" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId in metadata" }, { status: 400 });
    }

    if (!amountDollars || amountDollars < 1) {
      return NextResponse.json({ error: "Invalid amountDollars in metadata" }, { status: 400 });
    }

    const amountCents = amountDollars * 100;

    const { data: existingRow, error: selectError } = await supabase
      .from("streetcred")
      .select("balance_cents")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existingRow) {
      const currentBalance = Number(existingRow.balance_cents ?? 0);

      const { error: updateError } = await supabase
        .from("streetcred")
        .update({
          balance_cents: currentBalance + amountCents,
        })
        .eq("user_id", userId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase
        .from("streetcred")
        .insert({
          user_id: userId,
          balance_cents: amountCents,
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      amountCents,
      bandSlug,
      returnTo,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}