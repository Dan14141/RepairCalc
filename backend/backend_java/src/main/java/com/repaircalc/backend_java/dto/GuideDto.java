package com.repaircalc.backend_java.dto;

public record GuideDto(
        String title,
        String tag,
        String time,
        String text
) {}