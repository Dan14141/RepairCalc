package com.repaircalc.backend_java.dto;

import java.math.BigDecimal;

public record ProductCalculationDto(
        int quantity,
        String unit,
        BigDecimal total
) {}