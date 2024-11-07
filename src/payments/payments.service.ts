import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    const line_items = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: 2,
    }));
    const session = await this.stripe.checkout.sessions.create({
      // Colocar id de mi order
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
      line_items,
      mode: 'payment',
      success_url: envs.stripeSucessUrl,
      cancel_url: envs.stripeCancelUrl,
    });
    return session;
  }

  async stripeWebhook(request: Request, response: Response) {
    const sig = request.headers['stripe-signature'];
    let event: Stripe.Event;

    // Production
    const endpointSecret = envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(
        request['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object as Stripe.Charge;
        console.log({
          metadata: chargeSucceeded.metadata,
        });

        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    return response.status(200).json({ sig });
  }
}
