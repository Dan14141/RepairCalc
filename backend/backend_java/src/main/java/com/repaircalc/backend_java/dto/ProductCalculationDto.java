package com.repaircalc.backend_java.dto;

public record ProductCalculationDto(
        int quantity,
        String unit,
        int total
) {}