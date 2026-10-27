package com.repaircalc.backend_java.dto;

import java.math.BigDecimal;

public record CategoryTotalDto(
        String id,
        String name,
        String color,
        BigDecimal total
) {}