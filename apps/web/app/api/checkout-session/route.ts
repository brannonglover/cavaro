import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * GET /api/checkout-session?session_id=xxx
 * Returns { email } for a completed checkout session (for success page display).
 */
export async function GET(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!stripeSecret || !sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' || session.mode !== 'subscription') {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const email =
      session.customer_details?.email ??
      (typeof session.customer === 'string'
        ? null
        : (session.customer as { email?: string })?.email) ??
      null;

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (err) {
    console.error('Checkout session fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
