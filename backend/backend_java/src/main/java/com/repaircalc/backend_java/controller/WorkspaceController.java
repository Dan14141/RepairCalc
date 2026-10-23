package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.WorkspaceDto;
import com.repaircalc.backend_java.service.DataService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/workspace")
public class WorkspaceController {

    private final DataService dataService;
    private WorkspaceDto savedWorkspace = null; // Храним в памяти

    public WorkspaceController(DataService dataService) {
        this.dataService = dataService;
    }

    @PutMapping
    public WorkspaceDto saveWorkspace(@RequestBody WorkspaceDto workspace) {
        this.savedWorkspace = workspace; // Сохраняем
        return workspace;
    }

    // Вспомогательный метод для BootstrapController
    public WorkspaceDto getSavedWorkspace() {
        if (savedWorkspace == null) {
            return new WorkspaceDto(dataService.getInitialProjects(), java.util.List.of());
        }
        return savedWorkspace;
    }
}