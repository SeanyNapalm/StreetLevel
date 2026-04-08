import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const amountDollars = Number(body?.amountDollars ?? 5);
    const bandSlug = String(body?.bandSlug ?? "");
    const userId = String(body?.userId ?? "");
    const returnTo = String(body?.returnTo ?? "");

    let unitAmount = Math.ceil((amountDollars * 1.029 + 0.30) * 100);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const safeReturnTo =
      returnTo && returnTo.startsWith("/") ? returnTo : "/band";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `StreetLevel $${amountDollars} Credit`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "street_cred",
        amountDollars: String(amountDollars),
        bandSlug,
        userId,
        returnTo: safeReturnTo,
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}