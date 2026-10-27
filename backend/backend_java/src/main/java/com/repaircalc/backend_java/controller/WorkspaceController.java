package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.WorkspaceDto;
import com.repaircalc.backend_java.service.DataService;
import com.repaircalc.backend_java.service.CalculationService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import java.util.HashSet;

@RestController
@RequestMapping("/workspace")
public class WorkspaceController {
    private final DataService data;
    private final CalculationService calculation;
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    public WorkspaceController(DataService data,CalculationService calculation,JdbcTemplate jdbc,JsonMapper json) {
        this.data=data;this.calculation=calculation;this.jdbc=jdbc;this.json=json;
    }
    @PutMapping
    public WorkspaceDto saveWorkspace(@RequestBody WorkspaceDto workspace) {
        if(workspace==null || workspace.projects()==null || workspace.projects().isEmpty() || workspace.projects().size()>100 || workspace.favorites()==null || workspace.favorites().size()>1000 ||
                workspace.projects().stream().anyMatch(java.util.Objects::isNull) ||
                workspace.projects().stream().map(com.repaircalc.backend_java.dto.ProjectDto::id).distinct().count()!=workspace.projects().size() ||
                workspace.favorites().stream().anyMatch(id->id==null || id.isBlank()) || new HashSet<>(workspace.favorites()).size()!=workspace.favorites().size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Некорректные проекты или избранное");
        workspace.projects().forEach(calculation::calculateEstimate);
        jdbc.update("INSERT INTO repaircalc.app_workspace(id,payload) VALUES(1,?::jsonb) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=now()",json.writeValueAsString(workspace));
        return workspace;
    }
    public WorkspaceDto getSavedWorkspace() {
        List<String> saved=jdbc.queryForList("SELECT payload::text FROM repaircalc.app_workspace WHERE id=1",String.class);
        return saved.isEmpty()?new WorkspaceDto(data.getInitialProjects(),List.of()):json.readValue(saved.get(0),WorkspaceDto.class);
    }
}
