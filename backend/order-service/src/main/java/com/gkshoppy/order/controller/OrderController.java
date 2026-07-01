package com.gkshoppy.order.controller;

import com.gkshoppy.order.entity.OrderEntity;
import com.gkshoppy.order.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderEntity> createOrder(@Valid @RequestBody OrderEntity order) {
        return ResponseEntity.ok(orderService.createOrder(order));
    }

    @GetMapping("/user/{userId}")
    public List<OrderEntity> listOrders(@PathVariable Long userId) {
        return orderService.listOrders(userId);
    }
}
