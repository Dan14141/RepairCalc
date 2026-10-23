package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.GuideDto;
import com.repaircalc.backend_java.dto.ProductDto;
import com.repaircalc.backend_java.dto.ProjectDto;
import com.repaircalc.backend_java.dto.RoomDto;
import com.repaircalc.backend_java.entity.ProductEntity;
import com.repaircalc.backend_java.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DataService {

    private final ProductRepository productRepository;

    // Внедряем репозиторий
    public DataService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductDto> getProducts() {
        // Берем из БД и превращаем в DTO для фронта
        return productRepository.findAll().stream()
                .map(p -> new ProductDto(
                        p.getId(), p.getName(), p.getBrand(), p.getCategory(), p.getPrice(),
                        p.getUnit(), p.getCoverage(), p.getColor(), p.getTexture(),
                        p.isWet(), p.isHeavy(), p.getRating(), p.getDescription()
                ))
                .collect(Collectors.toList());
    }

    public List<GuideDto> getGuides() {
        return List.of(
                new GuideDto("Сколько материала брать про запас?", "Расчёт материалов", "3 минуты", "Для прямой укладки...")
        );
    }

    public List<ProjectDto> getInitialProjects() {
        // ИСПРАВЛЕНО: Убираем рандомный UUID, чтобы фронт не терял проект
        RoomDto livingRoom = new RoomDto("room-default-1", "Гостиная", "living", 4.5, 4.0, 2.7, 1, 1, false, false, "oak", "paint");
        ProjectDto defaultProject = new ProjectDto("project-default-1", "Квартира на Петроградской", "Квартира", "Капитальный", List.of(livingRoom), 10, false, Instant.now().toString());
        return List.of(defaultProject);
    }
}