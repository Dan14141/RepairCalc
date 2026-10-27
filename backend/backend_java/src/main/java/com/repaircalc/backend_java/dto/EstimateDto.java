package com.repaircalc.backend_java.dto;

import java.math.BigDecimal;

import java.util.List;

public record EstimateDto(
        List<EstimateItemDto> items,
        BigDecimal materials,
        BigDecimal labor,
        BigDecimal total,
        double totalArea,
        List<CategoryTotalDto> categories,
        List<String> warnings
) {}
