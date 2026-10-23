package com.repaircalc.backend_java.controller;

import com.repaircalc.backend_java.dto.ProductCalculationDto;
import com.repaircalc.backend_java.dto.request.CalcRequestDto;
import com.repaircalc.backend_java.service.ProductService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/product")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping("/{id}/calc")
    public ProductCalculationDto calculateProduct(@PathVariable String id, @RequestBody CalcRequestDto request) {
        return productService.calculateProduct(id, request.surface(), request.reserve());
    }
}