package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.*;
import com.repaircalc.backend_java.entity.ProductEntity;
import com.repaircalc.backend_java.repository.ProductRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;

@Service
public class DataService {
    private final ProductRepository repository;
    public DataService(ProductRepository repository) { this.repository = repository; }

    public static ProductDto dto(ProductEntity p) {
        return new ProductDto(p.getId(),p.getName(),p.getBrand(),p.getCategory(),p.getPrice(),
                p.getUnit(),p.getCoverage(),p.getColor(),p.getTexture(),p.isWet(),p.isHeavy(),p.getRating(),p.getDescription());
    }
    public List<ProductDto> getProducts() {
        return repository.findByCoverageGreaterThanOrderById(0).stream().map(DataService::dto).toList();
    }
    public ProductDto getProduct(String id) {
        return repository.findById(id).map(DataService::dto).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Товар не найден"));
    }
    public long catalogCount() { return repository.count(); }
    public record CatalogPage(List<ProductDto> products, long total, int page, int size) {}
    public CatalogPage catalog(String search, String category, String order, int page, int size, List<String> ids) {
        if (page < 0 || size < 1 || size > 100 || search.length() > 200 ||
                !List.of("all","floor","walls","prep","electric","other").contains(category) ||
                !List.of("recommended","price-up","price-down").contains(order))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректные параметры каталога");
        Sort sort = order.equals("price-up") ? Sort.by("price","id") : order.equals("price-down") ?
                Sort.by(Sort.Order.desc("price"),Sort.Order.asc("id")) : Sort.by("id");
        var result = repository.findAll((root, query, cb) -> {
            var conditions = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (!category.equals("all")) conditions.add(cb.equal(root.get("category"),category));
            if (!search.isBlank()) {
                String pattern = "%" + search.toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_") + "%";
                conditions.add(cb.or(cb.like(cb.lower(root.get("name")),pattern,'\\'),
                        cb.like(cb.lower(root.get("brand")),pattern,'\\'), cb.like(root.get("id"),pattern,'\\')));
            }
            if (ids != null) conditions.add(root.get("id").in(ids));
            return cb.and(conditions.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, PageRequest.of(page,size,sort));
        return new CatalogPage(result.getContent().stream().map(DataService::dto).toList(),result.getTotalElements(),page,size);
    }
    public List<GuideDto> getGuides() {
        return List.of(new GuideDto("Сколько материала брать про запас?", "Расчёт материалов", "3 минуты",
                "Запас применяется к площади каждой комнаты. Для обоев учитывайте раскрой и подгонку рисунка; для штукатурки — указанную в карточке толщину слоя."));
    }
    public List<ProjectDto> getInitialProjects() {
        var catalog = getProducts();
        String floor = catalog.stream().filter(p->p.category().equals("floor")).map(ProductDto::id).findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Импортируйте каталог"));
        String wall = catalog.stream().filter(p->p.category().equals("walls")).map(ProductDto::id).findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Импортируйте каталог"));
        var room = new RoomDto("room-default-1","Гостиная","living",4.5,4.0,2.7,1,1,false,false,floor,wall);
        return List.of(new ProjectDto("project-default-1","Мой проект","Квартира","Косметический",List.of(room),10,false,Instant.now().toString()));
    }
}
