package com.repaircalc.backend_java.dto;

import java.util.List;

public record MetricsReportDto(
        String generatedAt,
        PeriodDto period,
        String modelVersion,
        String dataset,
        int labeledProducts,
        List<MatchingDto> matching,
        List<ConsumptionDto> consumption,
        AutomationDto automation,
        EstimatesDto estimates,
        JourneyDto journey,
        RequestsDto requests,
        EngagementMetricsDto engagement
) {
    public record PeriodDto(String from, String to) {}
    public record MatchingDto(String id, String name, int tp, int fp, int fn) {}
    public record ConsumptionDto(String id, String name, String unit, int samples, double absoluteError) {}
    public record AutomationDto(int automatic, int eligible) {}
    public record EstimatesDto(int completed, int totalSeconds, Double p95Seconds) {}
    public record JourneyDto(int started, int completed, int totalClicks) {}
    public record RequestsDto(int total, int failed) {}
}
