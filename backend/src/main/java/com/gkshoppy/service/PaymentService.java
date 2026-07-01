package com.gkshoppy.service;

import com.gkshoppy.model.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PaymentService {

    @Value("${stripe.apiKey:}")
    private String stripeApiKey;

    // Payment scaffold — uses Stripe REST API via HttpClient if stripe.apiKey is configured, otherwise falls back to a local stub
    public boolean processPayment(Order order) {
        if (stripeApiKey == null || stripeApiKey.isBlank()) {
            // No real gateway configured — simulate success
            return true;
        }

        long amount = Math.max(0, Math.round(order.getTotal() * 100)); // amount in smallest currency unit
        Map<String, String> form = Map.of(
                "amount", String.valueOf(amount),
                "currency", "inr",
                "payment_method_types[]", "card"
        );
        String body = form.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.stripe.com/v1/payment_intents"))
                .header("Authorization", "Bearer " + stripeApiKey)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        try {
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            int status = resp.statusCode();
            if (status >= 200 && status < 300) {
                return true;
            } else {
                // log resp.body() in real app
                return false;
            }
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
