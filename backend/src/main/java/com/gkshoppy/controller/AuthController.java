package com.gkshoppy.controller;

import com.gkshoppy.model.User;
import com.gkshoppy.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import jakarta.servlet.http.HttpSession;

@Controller
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/auth")
    public String authPage(@RequestParam(value = "next", required = false) String next, Model model) {
        model.addAttribute("next", next);
        return "auth";
    }

    @PostMapping("/auth/signup")
    public String signup(@RequestParam String email, @RequestParam String username, @RequestParam String password, HttpSession session, Model model) {
        if (userRepository.findByEmail(email).isPresent()) {
            model.addAttribute("error", "Email already registered");
            return "auth";
        }
        if (userRepository.findByUsername(username).isPresent()) {
            model.addAttribute("error", "Username already taken");
            return "auth";
        }
        User u = new User();
        u.setEmail(email);
        u.setUsername(username);
        u.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(u);
        session.setAttribute("userId", u.getId());
        return "redirect:/profile";
    }

    @PostMapping("/auth/login")
    public String login(@RequestParam String emailOrUsername, @RequestParam String password, HttpSession session, Model model) {
        User user = userRepository.findByEmail(emailOrUsername).orElse(null);
        if (user == null) user = userRepository.findByUsername(emailOrUsername).orElse(null);
        if (user == null) {
            model.addAttribute("error", "Invalid credentials");
            return "auth";
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            model.addAttribute("error", "Invalid credentials");
            return "auth";
        }
        session.setAttribute("userId", user.getId());
        return "redirect:/profile";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/";
    }
}
