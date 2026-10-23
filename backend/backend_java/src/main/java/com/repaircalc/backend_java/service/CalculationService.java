package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CalculationService {

    private final DataService dataService;

    public CalculationService(DataService dataService) {
        this.dataService = dataService;
    }

    public EstimateDto calculateEstimate(ProjectDto project) {
        List<ProductDto> catalog = dataService.getProducts();

        // Группируем товары для сметы
        Map<String, EstimateItemDto> rows = new LinkedHashMap<>();

        for (RoomDto room : project.rooms()) {
            double floorArea = room.length() * room.width();
            double wallArea = Math.max(0, 2 * (room.length() + room.width()) * room.height() - room.windows() * 2.1 - room.doors() * 1.6);

            // Добавляем пол и стены
            addItem(rows, catalog, room.floor(), floorArea, project.reserve(), room.name(), false);
            addItem(rows, catalog, room.wall(), wallArea, project.reserve(), room.name(), false);

            // Грунтовка (добавляется всегда)
            addItem(rows, catalog, "primer", wallArea, project.reserve(), room.name(), false);

            // Если ремонт не косметический, добавляем штукатурку и розетки
            if (!"Косметический".equals(project.repair())) {
                addItem(rows, catalog, room.wet() ? "cement" : "plaster", wallArea, project.reserve(), room.name(), false);
                double socketsCount = Math.max(2, Math.ceil(floorArea / 4));
                addItem(rows, catalog, room.wet() ? "socket-wet" : "socket", socketsCount, 0, room.name(), true);
            }
        }

        List<EstimateItemDto> items = new ArrayList<>(rows.values());
        int materialsCost = items.stream().mapToInt(EstimateItemDto::cost).sum();
        double totalArea = project.rooms().stream().mapToDouble(r -> r.length() * r.width()).sum();

        int laborRate = "Косметический".equals(project.repair()) ? 900 : "Дизайнерский".equals(project.repair()) ? 2800 : 1800;
        int laborCost = project.labor() ? (int) Math.round(totalArea * laborRate) : 0;

        // Категории
        List<CategoryTotalDto> categories = List.of(
                createCategoryTotal("floor", "Напольные покрытия", "#bd7853", items),
                createCategoryTotal("walls", "Отделка стен", "#83917c", items),
                createCategoryTotal("prep", "Подготовка поверхностей", "#c4bba6", items),
                createCategoryTotal("electric", "Электрика", "#697f88", items)
        );

        return new EstimateDto(
                items,
                materialsCost,
                laborCost,
                materialsCost + laborCost,
                totalArea,
                categories
        );
    }

    private void addItem(Map<String, EstimateItemDto> rows, List<ProductDto> catalog, String productId, double surface, int reserve, String roomName, boolean directCount) {
        ProductDto product = catalog.stream().filter(p -> p.id().equals(productId)).findFirst().orElse(null);
        if (product == null) return;

        int quantity = (int) Math.ceil(directCount ? surface : (surface * (1 + reserve / 100.0)) / product.coverage());

        EstimateItemDto existing = rows.get(productId);
        if (existing != null) {
            quantity += existing.quantity();
            List<String> rooms = new ArrayList<>(existing.rooms());
            rooms.add(roomName);
            rows.put(productId, new EstimateItemDto(product, quantity, quantity * product.price(), rooms, surface + existing.surface()));
        } else {
            rows.put(productId, new EstimateItemDto(product, quantity, quantity * product.price(), new ArrayList<>(List.of(roomName)), surface));
        }
    }

    private CategoryTotalDto createCategoryTotal(String id, String name, String color, List<EstimateItemDto> items) {
        int total = items.stream().filter(i -> i.product().category().equals(id)).mapToInt(EstimateItemDto::cost).sum();
        return new CategoryTotalDto(id, name, color, total);
    }
}