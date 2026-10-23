package com.repaircalc.backend_java.dto;

public record CategoryTotalDto(
        String id,
        String name,
        String color,
        int total
) {}