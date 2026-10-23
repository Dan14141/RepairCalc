package com.repaircalc.backend_java.config;

import com.repaircalc.backend_java.entity.ProductEntity;
import com.repaircalc.backend_java.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(ProductRepository repository) {
        return args -> {
            if (repository.count() == 0) {
                // Переносим сюда весь список товаров (можешь скопировать из старого DataService)
                repository.save(createProduct("oak", "Ламинат Дуб натуральный", "TARKETT", "floor", 2490, "упак.", 2.13, "#c3a17a", "wood", false, true, "4,8", "Тёплый оттенок..."));
                repository.save(createProduct("stone", "Керамогранит Тёплый камень", "KERAMA MARAZZI", "floor", 2190, "упак.", 1.44, "#c7c0b1", "stone", true, true, "4,9", "Матовый..."));
                repository.save(createProduct("paint", "Краска для стен, матовая", "DULUX", "walls", 3290, "ведро", 35.0, "#dce0d1", "paint", true, true, "4,9", "Моющаяся..."));
                // ... добавь остальные товары по аналогии
            }
        };
    }

    private ProductEntity createProduct(String id, String name, String brand, String category, int price, String unit, double coverage, String color, String texture, boolean wet, boolean heavy, String rating, String description) {
        ProductEntity p = new ProductEntity();
        p.setId(id); p.setName(name); p.setBrand(brand); p.setCategory(category);
        p.setPrice(price); p.setUnit(unit); p.setCoverage(coverage); p.setColor(color);
        p.setTexture(texture); p.setWet(wet); p.setHeavy(heavy); p.setRating(rating); p.setDescription(description);
        return p;
    }
}