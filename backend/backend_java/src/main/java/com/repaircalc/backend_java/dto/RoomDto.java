package com.repaircalc.backend_java.dto;

public record RoomDto(
        String id,
        String name,
        String type, // "living", "kitchen", "bathroom", "bedroom", "kids", "balcony"
        double length,
        double width,
        double height,
        int windows,
        int doors,
        boolean wet,
        boolean heavy,
        String floor,
        String wall
) {}