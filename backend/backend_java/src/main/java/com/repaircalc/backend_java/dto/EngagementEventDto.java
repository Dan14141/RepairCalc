package com.repaircalc.backend_java.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record EngagementEventDto(
        @NotNull UUID id,
        @NotNull UUID visitorId,
        @NotNull @Pattern(regexp = "share|rating") String kind,
        @Size(max = 200) String projectId,
        String method,
        Double rating
) {}
