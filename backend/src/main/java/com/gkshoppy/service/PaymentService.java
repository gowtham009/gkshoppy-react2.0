package com.gkshoppy.service;

import com.gkshoppy.model.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {

    @Value("${stripe.apiKey:}")
    private String stripeApiKey;

    // Payment scaffold — uses Stripe if stripe.apiKey is configured, otherwise falls back to a local stub
    public boolean processPayment(Order order) {
        if (stripeApiKey == null || stripeApiKey.isBlank()) {
            // No real gateway configured — simulate success
            return true;
        }
        // TODO: Implement real Stripe / gateway integration here.
        // This is a scaffold spot where you would exchange order details for a PaymentIntent
        // and confirm payment. For now, return true to preserve behavior.
        return true;
    }
}
