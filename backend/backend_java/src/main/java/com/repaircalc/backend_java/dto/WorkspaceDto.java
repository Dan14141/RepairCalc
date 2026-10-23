package com.repaircalc.backend_java.dto;

import java.util.List;

public record WorkspaceDto(
        List<ProjectDto> projects,
        List<String> favorites
) {}