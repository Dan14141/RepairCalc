package com.repaircalc.backend_java.dto;

import java.math.BigDecimal;

import java.util.List;

public record RecommendationResultDto(
        String summary,
        List<GroupDto> groups,
        List<ExcludedDto> excluded
) {
    public record GroupDto(String category, List<CandidateDto> candidates) {}
    public record CandidateDto(
            String productId,
            double score,
            List<String> reasons,
            String tradeoff,
            int quantity,
            BigDecimal total,
            List<EvidenceDto> evidence
    ) {}
    public record EvidenceDto(String title, String excerpt, String source) {}
    public record ExcludedDto(String productId, String reason) {}
}