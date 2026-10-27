package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.service.DataService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/catalog")
public class CatalogController {
    private final DataService data;
    public CatalogController(DataService data) { this.data=data; }
    @GetMapping
    public DataService.CatalogPage catalog(@RequestParam(defaultValue="") String search,
            @RequestParam(defaultValue="all") String category,@RequestParam(defaultValue="recommended") String sort,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="48") int size,
            @RequestParam(required=false) List<String> ids) {
        return data.catalog(search,category,sort,page,size,ids);
    }
}
