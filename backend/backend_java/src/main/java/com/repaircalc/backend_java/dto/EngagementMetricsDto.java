package com.repaircalc.backend_java.dto;

import java.util.List;

public record EngagementMetricsDto(String since, Shares shares, Ratings ratings) {
    public record Shares(long total, long visitors) {}
    public record Ratings(long total, List<Long> distribution) {}
}
