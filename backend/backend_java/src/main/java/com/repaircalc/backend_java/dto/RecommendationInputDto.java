package com.repaircalc.backend_java.dto;

public record RecommendationInputDto(
        RoomDto room,
        int reserve,
        String priority
) {}