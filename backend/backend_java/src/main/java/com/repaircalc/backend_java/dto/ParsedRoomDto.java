package com.repaircalc.backend_java.dto;

import java.util.List;

public record ParsedRoomDto(
        DraftDto draft,
        List<String> extracted,
        List<String> assumptions,
        String clarification
) {
    public record DraftDto(
            String name,
            String type,
            double length,
            double width,
            double height,
            int windows,
            int doors,
            boolean wet,
            boolean heavy
    ) {}
}