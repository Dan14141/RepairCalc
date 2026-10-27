package com.repaircalc.backend_java.dto;

import java.math.BigDecimal;

import java.util.List;

public record EstimateItemDto(
        ProductDto product,
        int quantity,
        BigDecimal cost,
        List<String> rooms,
        double surface
) {}