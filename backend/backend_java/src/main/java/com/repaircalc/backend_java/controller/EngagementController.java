package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.EngagementEventDto;
import com.repaircalc.backend_java.service.EngagementService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/engagement/events")
public class EngagementController {
    private final EngagementService service;
    public EngagementController(EngagementService service) { this.service = service; }

    @PostMapping
    public Map<String, UUID> record(@Valid @RequestBody EngagementEventDto event) {
        service.record(event);
        return Map.of("id", event.id());
    }
}
