package com.repaircalc.backend_java.dto;

import java.util.List;

public record EstimateDto(
        List<EstimateItemDto> items,
        int materials,
        int labor,
        int total,
        double totalArea,
        List<CategoryTotalDto> categories
) {}