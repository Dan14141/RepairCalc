package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.*;
import com.repaircalc.backend_java.dto.request.ClassifyRequestDto;
import com.repaircalc.backend_java.dto.request.ParseRoomRequestDto;
import com.repaircalc.backend_java.service.MlService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ml")
public class MlController {
    private final MlService mlService;

    public MlController(MlService mlService) {
        this.mlService = mlService;
    }

    @PostMapping("/recommendations")
    public RecommendationResultDto getRecommendations(@RequestBody RecommendationInputDto input) {
        return mlService.getRecommendations(input);
    }

    @PostMapping("/parse-room")
    public ParsedRoomDto parseRoom(@RequestBody ParseRoomRequestDto request) {
        return mlService.parseRoom(request.text());
    }

    @GetMapping("/assignments")
    public List<AssignmentDto> getAssignments() {
        return mlService.getAssignments(null);
    }

    @PostMapping("/classify")
    public List<AssignmentDto> classify(@RequestBody ClassifyRequestDto request) {
        return mlService.getAssignments(request.productIds());
    }

    @PutMapping("/assignments/{productId}")
    public AssignmentDto saveAssignment(@PathVariable String productId, @RequestBody AssignmentDto assignment) {
        return assignment; // Просто возвращаем
    }
}