package com.gkshoppy.service;

import com.gkshoppy.model.Order;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {

    // Payment stub — replace with real gateway integration (Stripe, Razorpay, etc.)
    public boolean processPayment(Order order) {
        // Simulate payment processing success
        return true;
    }
}
