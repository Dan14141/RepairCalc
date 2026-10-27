package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.BootstrapDto;
import com.repaircalc.backend_java.dto.WorkspaceDto;
import com.repaircalc.backend_java.service.DataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/bootstrap")
public class BootstrapController {

    private final DataService dataService;
    private final WorkspaceController workspaceController;

    public BootstrapController(DataService dataService, WorkspaceController workspaceController) {
        this.dataService = dataService;
        this.workspaceController = workspaceController;
    }

    @GetMapping
    public BootstrapDto getBootstrap() {
        WorkspaceDto ws = workspaceController.getSavedWorkspace();
        return new BootstrapDto(
                ws.projects(),
                ws.favorites(),
                dataService.getProducts(),
                List.of("Санкт-Петербург", "Москва", "Казань"),
                dataService.getGuides(),
                dataService.catalogCount()
        );
    }
}
