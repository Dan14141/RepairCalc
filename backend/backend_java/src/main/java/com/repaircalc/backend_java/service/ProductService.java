package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.ProductCalculationDto;
import com.repaircalc.backend_java.dto.ProductDto;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final DataService dataService;

    public ProductService(DataService dataService) {
        this.dataService = dataService;
    }

    public ProductCalculationDto calculateProduct(String id, double surface, int reserve) {
        ProductDto product = dataService.getProducts().stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new RuntimeException("Товар не найден"));

        int quantity = (int) Math.ceil(
                "electric".equals(product.category()) ? surface : (surface * (1 + reserve / 100.0)) / product.coverage()
        );
        return new ProductCalculationDto(quantity, product.unit(), quantity * product.price());
    }
}