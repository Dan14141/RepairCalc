package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.MetricsReportDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MetricsService {
    public MetricsReportDto getMetrics() {
        return new MetricsReportDto(
                "2026-10-23T09:00:00Z",
                new MetricsReportDto.PeriodDto("2026-10-16T00:00:00Z", "2026-10-23T00:00:00Z"),
                "demo-matcher-v1",
                "Демонстрационный сабсет",
                240,
                List.of(
                        new MetricsReportDto.MatchingDto("floor", "Напольные покрытия", 108, 12, 12),
                        new MetricsReportDto.MatchingDto("walls", "Покрытия для стен", 68, 12, 12)
                ),
                List.of(
                        new MetricsReportDto.ConsumptionDto("floor", "Напольные покрытия", "упак.", 80, 20)
                ),
                new MetricsReportDto.AutomationDto(864, 1200),
                new MetricsReportDto.EstimatesDto(180, 432, 4.8),
                new MetricsReportDto.JourneyDto(250, 180, 1080),
                new MetricsReportDto.RequestsDto(2000, 24)
        );
    }
}