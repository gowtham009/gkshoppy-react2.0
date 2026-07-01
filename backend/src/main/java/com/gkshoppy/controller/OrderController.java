package com.gkshoppy.controller;

import com.gkshoppy.model.Order;
import com.gkshoppy.repository.OrderRepository;
import com.gkshoppy.repository.UserRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

import jakarta.servlet.http.HttpSession;
import java.util.List;

@Controller
public class OrderController {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    public OrderController(OrderRepository orderRepository, UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/orders")
    public String myOrders(HttpSession session, Model model) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return "redirect:/auth?next=/orders";
        }
        var user = userRepository.findById(userId).orElse(null);
        if (user == null) return "redirect:/auth?next=/orders";
        List<Order> orders = orderRepository.findByUserOrderByCreatedAtDesc(user);
        model.addAttribute("orders", orders);
        return "orders";
    }

    // Simple admin list of all orders — access controlled by a session attribute isAdmin=true
    @GetMapping("/admin/orders")
    public String adminOrders(HttpSession session, Model model) {
        Object isAdmin = session.getAttribute("isAdmin");
        if (!(isAdmin instanceof Boolean) || !((Boolean) isAdmin)) {
            return "redirect:/"; // not authorized
        }
        List<Order> orders = orderRepository.findAll();
        model.addAttribute("orders", orders);
        return "orders";
    }

    // Update status (admin)
    @PostMapping("/admin/order/{id}/status")
    public String updateOrderStatus(@org.springframework.web.bind.annotation.PathVariable Long id, @org.springframework.web.bind.annotation.RequestParam String status, HttpSession session) {
        Object isAdmin = session.getAttribute("isAdmin");
        if (!(isAdmin instanceof Boolean) || !((Boolean) isAdmin)) {
            return "redirect:/";
        }
        orderRepository.findById(id).ifPresent(o -> { o.setStatus(status); orderRepository.save(o); });
        return "redirect:/admin/orders";
    }
}
