package com.repaircalc.backend_java.dto;

import java.util.List;

public record ProjectDto(
        String id,
        String name,
        String object, // "Квартира", "Дом", "Студия"
        String repair, // "Косметический", "Капитальный", "Дизайнерский"
        List<RoomDto> rooms,
        int reserve, // 5, 10, 15
        boolean labor,
        String updatedAt
) {}