package com.repaircalc.backend_java.dto;

public record ProductDto(
        String id,
        String name,
        String brand,
        String category, // "floor", "walls", "prep", "electric"
        int price,
        String unit,
        double coverage,
        String color,
        String texture,
        boolean wet,
        boolean heavy,
        String rating,
        String description
) {}