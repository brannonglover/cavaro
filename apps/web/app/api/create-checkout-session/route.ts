import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export async function POST(request: NextRequest) {
  if (!stripe || !stripePriceId) {
    return NextResponse.json(
      { error: 'Subscription not configured' },
      { status: 503 }
    );
  }

  try {
    const origin = request.headers.get('origin') || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
