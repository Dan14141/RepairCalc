package com.repaircalc.backend_java.dto;

import java.util.List;

public record AssignmentDto(
        String productId,
        List<String> works,
        List<String> rooms,
        double score,
        String explanation,
        String status
) {}