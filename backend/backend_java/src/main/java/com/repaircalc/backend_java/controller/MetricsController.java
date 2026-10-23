package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.MetricsReportDto;
import com.repaircalc.backend_java.service.MetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/metrics")
public class MetricsController {
    private final MetricsService metricsService;

    public MetricsController(MetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @GetMapping
    public MetricsReportDto getMetrics() {
        return metricsService.getMetrics();
    }
}