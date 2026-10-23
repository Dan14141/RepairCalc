package com.repaircalc.backend_java.dto;

import java.util.List;

public record EstimateItemDto(
        ProductDto product,
        int quantity,
        int cost,
        List<String> rooms,
        double surface
) {}