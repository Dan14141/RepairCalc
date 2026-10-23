package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class MlService {
    private final DataService dataService;

    public MlService(DataService dataService) {
        this.dataService = dataService;
    }

    // 1. Подбор рекомендаций (Recommendations)
    public RecommendationResultDto getRecommendations(RecommendationInputDto input) {
        RoomDto room = input.room();
        List<ProductDto> products = dataService.getProducts();
        List<String> categories = List.of("floor", "walls");
        List<RecommendationResultDto.GroupDto> groups = new ArrayList<>();
        List<RecommendationResultDto.ExcludedDto> excluded = new ArrayList<>();

        for (String category : categories) {
            double surface = "floor".equals(category) ? room.length() * room.width() :
                    Math.max(0, 2 * (room.length() + room.width()) * room.height() - room.windows() * 2.1 - room.doors() * 1.6);

            List<RecommendationResultDto.CandidateDto> candidates = products.stream()
                    .filter(p -> p.category().equals(category))
                    .map(p -> {
                        boolean compatible = (!room.wet() || p.wet()) && (!room.heavy() || p.heavy());
                        if (!compatible) {
                            excluded.add(new RecommendationResultDto.ExcludedDto(p.id(), room.wet() && !p.wet() ? "Не подтверждена влагостойкость" : "Не рассчитан на высокую нагрузку"));
                            return null;
                        }
                        int quantity = (int) Math.ceil((surface * (1 + input.reserve() / 100.0)) / p.coverage());
                        double score = p.id().equals("floor".equals(category) ? room.floor() : room.wall()) ? 0.96 : p.heavy() ? 0.93 : 0.89;

                        List<RecommendationResultDto.EvidenceDto> evidence = List.of(
                                new RecommendationResultDto.EvidenceDto("Характеристики", p.description(), "Карточка товара"),
                                new RecommendationResultDto.EvidenceDto("Норма расхода", p.coverage() + " м² / " + p.unit(), "Справочник")
                        );
                        List<String> reasons = List.of(
                                room.wet() ? "Подходит для влажности" : "Для сухой комнаты",
                                p.heavy() ? "Выдерживает нагрузку" : "Обычная нагрузка",
                                quantity + " " + p.unit() + " с запасом " + input.reserve() + "%"
                        );
                        return new RecommendationResultDto.CandidateDto(p.id(), score, reasons, "Учтите особенности основания.", quantity, quantity * p.price(), evidence);
                    })
                    .filter(Objects::nonNull)
                    .sorted((a, b) -> {
                        if ("budget".equals(input.priority())) return Integer.compare(a.total(), b.total());
                        return Double.compare(b.score(), a.score());
                    })
                    .collect(Collectors.toList());

            if (!candidates.isEmpty()) {
                groups.add(new RecommendationResultDto.GroupDto(category, candidates));
            }
        }

        String summary = "Подбор для " + room.name() + ": учтены условия и запас " + input.reserve() + "%.";
        return new RecommendationResultDto(summary, groups, excluded);
    }

    // 2. Парсер комнаты (Parse Room)
    public ParsedRoomDto parseRoom(String text) {
        String normalized = text.toLowerCase().replace(',', '.');
        String type = null, name = "";
        if (normalized.matches(".*(сануз|ванн|туалет).*")) { type = "bathroom"; name = "Санузел"; }
        else if (normalized.matches(".*кухн.*")) { type = "kitchen"; name = "Кухня"; }
        else if (normalized.matches(".*детск.*")) { type = "kids"; name = "Детская"; }
        else if (normalized.matches(".*спальн.*")) { type = "bedroom"; name = "Спальня"; }
        else if (normalized.matches(".*(балкон|лоджи).*")) { type = "balcony"; name = "Балкон"; }
        else if (normalized.matches(".*(гостин|зал).*")) { type = "living"; name = "Гостиная"; }

        if (type == null) {
            return new ParsedRoomDto(null, List.of(), List.of(), "Уточните назначение комнаты (кухня, санузел и т.д.)");
        }

        double length = 4.0, width = 3.0, height = 2.7;
        int windows = 1, doors = 1;
        boolean wet = List.of("bathroom", "kitchen", "balcony").contains(type);
        boolean heavy = "kitchen".equals(type);
        List<String> extracted = new ArrayList<>();
        List<String> assumptions = new ArrayList<>();

        Matcher mDim = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*[xх×]\\s*(\\d+(?:\\.\\d+)?)").matcher(normalized);
        if (mDim.find()) {
            length = Double.parseDouble(mDim.group(1));
            width = Double.parseDouble(mDim.group(2));
            extracted.add("Размеры: " + length + " × " + width + " м");
        } else {
            assumptions.add("Размеры не указаны — подставлены типовые.");
        }

        Matcher mHeight = Pattern.compile("(?:высот[а-я]*|потол[а-я]*)[^\\d]{0,12}(\\d+(?:\\.\\d+)?)").matcher(normalized);
        if (mHeight.find()) {
            height = Double.parseDouble(mHeight.group(1));
            extracted.add("Высота: " + height + " м");
        } else {
            assumptions.add("Высота принята 2.7 м.");
        }

        if (normalized.matches(".*влаж.*")) { wet = true; extracted.add("Повышенная влажность"); }
        if (normalized.matches(".*(собак|кошк|нагруз|дет).*")) { heavy = true; extracted.add("Высокая нагрузка"); }
        assumptions.add("Окна: " + windows + ", двери: " + doors);

        return new ParsedRoomDto(
                new ParsedRoomDto.DraftDto(name, type, length, width, height, windows, doors, wet, heavy),
                extracted, assumptions, null
        );
    }

    // 3. Генерация привязок (Assignments)
    public List<AssignmentDto> getAssignments(List<String> productIds) {
        List<ProductDto> products = dataService.getProducts();
        if (productIds == null || productIds.isEmpty()) {
            productIds = products.stream().map(ProductDto::id).collect(Collectors.toList());
        }

        List<AssignmentDto> result = new ArrayList<>();
        for (String id : productIds) {
            ProductDto p = products.stream().filter(x -> x.id().equals(id)).findFirst().orElse(null);
            if (p == null) continue;

            List<String> works = new ArrayList<>();
            if ("floor".equals(p.category())) {
                works.add("flooring");
                if ("stone".equals(p.texture())) works.add("tiling");
            } else if ("walls".equals(p.category())) {
                if ("tile".equals(p.texture())) works.add("tiling");
                else if ("linen".equals(p.texture())) works.add("wallpaper");
                else works.add("painting");
            } else if ("prep".equals(p.category())) works.add("preparation");
            else works.add("electrical");

            List<String> rooms = List.of("living", "bedroom", "kids"); // Упрощенно
            double score = p.id().equals("primer") ? 0.76 : p.id().equals("paint") ? 0.88 : 0.96;

            String explanation = "Категория: " + p.category() + ". " + (p.wet() ? "Влагостойкий." : "Для сухих помещений.");
            result.add(new AssignmentDto(p.id(), works, rooms, score, explanation, "pending"));
        }
        return result;
    }
}