package com.repaircalc.backend_java.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    public HealthController(org.springframework.jdbc.core.JdbcTemplate jdbc) { this.jdbc=jdbc; }

    @GetMapping
    public Map<String, String> checkHealth() {
        return Map.of(
                "database", jdbc.queryForObject("SELECT 'PostgreSQL ' || current_setting('server_version')", String.class),
                "status", "UP",
                "service", "RepairCalc Backend",
                "version", "0.0.1"
        );
    }
}
