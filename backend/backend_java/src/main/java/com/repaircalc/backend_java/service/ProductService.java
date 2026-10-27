package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;

@Service
public class ProductService {
    private final DataService data;
    public ProductService(DataService data) { this.data = data; }
    public static int quantity(ProductDto product, double surface, int reserve) {
        if (!Double.isFinite(surface) || surface < 0 || surface > 100000 || reserve < 0 || reserve > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Некорректная площадь или запас");
        if (product.coverage() <= 0)
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"В карточке недостаточно данных для расчёта расхода");
        double result = Math.ceil("electric".equals(product.category()) ? surface : surface*(1+reserve/100.0)/product.coverage());
        if (result > Integer.MAX_VALUE) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Слишком большое количество");
        return (int)result;
    }
    public ProductCalculationDto calculateProduct(String id, double surface, int reserve) {
        var product = data.getProduct(id);
        int quantity = quantity(product,surface,reserve);
        return new ProductCalculationDto(quantity,product.unit(),product.price().multiply(BigDecimal.valueOf(quantity)));
    }
}
