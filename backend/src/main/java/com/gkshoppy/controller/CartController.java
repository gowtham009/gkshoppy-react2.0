package com.gkshoppy.controller;

import com.gkshoppy.model.Product;
import com.gkshoppy.repository.ProductRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;

@Controller
public class CartController {

    private final ProductRepository productRepository;

    public CartController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping("/cart")
    public String cartPage(HttpSession session, Model model) {
        Map<Long, Integer> cart = cartFromSession(session);
        Map<Product, Integer> items = new HashMap<>();
        double total = 0.0;
        for (Map.Entry<Long, Integer> e : cart.entrySet()) {
            productRepository.findById(e.getKey()).ifPresent(p -> {
                items.put(p, e.getValue());
            });
        }
        for (Map.Entry<Product, Integer> e : items.entrySet()) {
            total += e.getKey().getPrice() * e.getValue();
        }
        model.addAttribute("items", items);
        model.addAttribute("total", total);
        return "cart";
    }

    @PostMapping("/cart/add")
    public String addToCart(@RequestParam Long productId, @RequestParam(defaultValue = "1") Integer qty, HttpSession session) {
        Map<Long, Integer> cart = cartFromSession(session);
        cart.put(productId, cart.getOrDefault(productId, 0) + qty);
        session.setAttribute("cart", cart);
        return "redirect:/cart";
    }

    @PostMapping("/cart/remove")
    public String removeFromCart(@RequestParam Long productId, HttpSession session) {
        Map<Long, Integer> cart = cartFromSession(session);
        cart.remove(productId);
        session.setAttribute("cart", cart);
        return "redirect:/cart";
    }

    @SuppressWarnings("unchecked")
    private Map<Long, Integer> cartFromSession(HttpSession session) {
        Object c = session.getAttribute("cart");
        if (c instanceof Map) {
            return (Map<Long, Integer>) c;
        }
        Map<Long, Integer> cart = new HashMap<>();
        session.setAttribute("cart", cart);
        return cart;
    }
}
