import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId = String(body?.userId ?? "");
    const trackId = String(body?.trackId ?? "");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (!trackId) {
      return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
    }

    // 1) Load track
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("id, title, band_slug, price_cents")
      .eq("id", trackId)
      .maybeSingle();

    if (trackError) {
      return NextResponse.json({ error: trackError.message }, { status: 500 });
    }

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const priceCents = Number(track.price_cents ?? 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Invalid track price" }, { status: 400 });
    }

    const artistCents = Math.floor(priceCents * 0.87);

    // 2) Check if already purchased
    const { data: existingPurchase, error: purchaseCheckError } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("track_id", trackId)
      .maybeSingle();

    if (purchaseCheckError) {
      return NextResponse.json({ error: purchaseCheckError.message }, { status: 500 });
    }

    if (existingPurchase) {
      return NextResponse.json(
        { error: "Track already owned", alreadyOwned: true },
        { status: 400 }
      );
    }

    // 3) Load buyer wallet
    const { data: buyerRow, error: buyerLoadError } = await supabase
      .from("streetcred")
      .select("balance_cents")
      .eq("user_id", userId)
      .maybeSingle();

    if (buyerLoadError) {
      return NextResponse.json({ error: buyerLoadError.message }, { status: 500 });
    }

    if (!buyerRow) {
      return NextResponse.json({ error: "Buyer wallet not found" }, { status: 400 });
    }

    const currentBuyerBalance = Number(buyerRow.balance_cents ?? 0);

    if (currentBuyerBalance < priceCents) {
      return NextResponse.json(
        {
          error: "Not enough Street Cred",
          needCents: priceCents,
          balanceCents: currentBuyerBalance,
        },
        { status: 400 }
      );
    }

    const newBuyerBalance = currentBuyerBalance - priceCents;

    // 4) Deduct buyer
    const { error: buyerUpdateError } = await supabase
      .from("streetcred")
      .update({ balance_cents: newBuyerBalance })
      .eq("user_id", userId);

    if (buyerUpdateError) {
      return NextResponse.json({ error: buyerUpdateError.message }, { status: 500 });
    }

    // 5) Insert purchase
    const { error: purchaseInsertError } = await supabase
      .from("purchases")
      .insert({
        user_id: userId,
        track_id: trackId,
        price_cents: priceCents,
      });

    if (purchaseInsertError) {
      // rollback buyer
      await supabase
        .from("streetcred")
        .update({ balance_cents: currentBuyerBalance })
        .eq("user_id", userId);

      return NextResponse.json({ error: purchaseInsertError.message }, { status: 500 });
    }

    // 6) Load band wallet
    const { data: bandRow, error: bandLoadError } = await supabase
      .from("streetcred")
      .select("balance_cents")
      .eq("band_slug", String(track.band_slug))
      .maybeSingle();

    if (bandLoadError) {
      await supabase.from("purchases").delete().eq("user_id", userId).eq("track_id", trackId);
      await supabase
        .from("streetcred")
        .update({ balance_cents: currentBuyerBalance })
        .eq("user_id", userId);

      return NextResponse.json({ error: bandLoadError.message }, { status: 500 });
    }

    if (!bandRow) {
      await supabase.from("purchases").delete().eq("user_id", userId).eq("track_id", trackId);
      await supabase
        .from("streetcred")
        .update({ balance_cents: currentBuyerBalance })
        .eq("user_id", userId);

      return NextResponse.json({ error: "Band wallet not found" }, { status: 400 });
    }

    const currentBandBalance = Number(bandRow.balance_cents ?? 0);
    const newBandBalance = currentBandBalance + artistCents;

    // 7) Credit band
    const { error: bandUpdateError } = await supabase
      .from("streetcred")
      .update({ balance_cents: newBandBalance })
      .eq("band_slug", String(track.band_slug));

    if (bandUpdateError) {
      await supabase.from("purchases").delete().eq("user_id", userId).eq("track_id", trackId);
      await supabase
        .from("streetcred")
        .update({ balance_cents: currentBuyerBalance })
        .eq("user_id", userId);

      return NextResponse.json({ error: bandUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      trackId,
      title: String(track.title ?? ""),
      bandSlug: String(track.band_slug ?? ""),
      priceCents,
      artistCents,
      buyerBalanceCents: newBuyerBalance,
      bandBalanceCents: newBandBalance,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Track purchase failed" }, { status: 500 });
  }
}