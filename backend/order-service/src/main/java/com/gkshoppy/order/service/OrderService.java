package com.gkshoppy.order.service;

import com.gkshoppy.order.entity.OrderEntity;
import com.gkshoppy.order.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderService {
    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public OrderEntity createOrder(OrderEntity order) {
        return orderRepository.save(order);
    }

    public List<OrderEntity> listOrders(Long userId) {
        return orderRepository.findByUserId(userId);
    }
}
