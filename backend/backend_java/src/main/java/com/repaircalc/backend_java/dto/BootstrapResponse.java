package com.repaircalc.backend_java.dto;

import java.util.List;

public record BootstrapResponse(
        List<Object> projects,   // Позже заменим на ProjectDto
        List<String> favorites,
        List<Object> products,   // Позже заменим на ProductDto
        List<String> regions,
        List<Object> guides      // Позже заменим на GuideDto
) {}