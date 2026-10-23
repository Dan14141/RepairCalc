package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.EstimateDto;
import com.repaircalc.backend_java.dto.ProjectDto;
import com.repaircalc.backend_java.service.CalculationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/estimate")
public class EstimateController {

    private final CalculationService calculationService;

    public EstimateController(CalculationService calculationService) {
        this.calculationService = calculationService;
    }

    @PostMapping
    public EstimateDto calculateEstimate(@RequestBody ProjectDto project) {
        return calculationService.calculateEstimate(project);
    }
}