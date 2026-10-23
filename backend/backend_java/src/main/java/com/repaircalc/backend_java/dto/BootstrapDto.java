package com.repaircalc.backend_java.dto;

import java.util.List;

public record BootstrapDto(
        List<ProjectDto> projects,
        List<String> favorites,
        List<ProductDto> products,
        List<String> regions,
        List<GuideDto> guides
) {}