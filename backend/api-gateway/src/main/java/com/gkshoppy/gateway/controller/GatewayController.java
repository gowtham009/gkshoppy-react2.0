package com.gkshoppy.gateway.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GatewayController {
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("GK Shoppy API Gateway is running");
    }
}
