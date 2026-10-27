package com.repaircalc.backend_java;

import com.repaircalc.backend_java.controller.BootstrapController;
import com.repaircalc.backend_java.controller.WorkspaceController;
import com.repaircalc.backend_java.dto.*;
import com.repaircalc.backend_java.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/** Uses the migrated PostgreSQL catalog. Workspace writes roll back after every test. */
@SpringBootTest
@Transactional
class PostgresApplicationTests {
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataService data;
    @Autowired CalculationService calculations;
    @Autowired ProductService products;
    @Autowired MlService ml;
    @Autowired WorkspaceController workspace;
    @Autowired BootstrapController bootstrap;

    private ProductDto product(String category) {
        return data.getProducts().stream().filter(p -> p.category().equals(category)).findFirst().orElseThrow();
    }
    private RoomDto room(String id, double length, boolean wet, boolean heavy) {
        return new RoomDto(id, "Тестовая комната", "living", length, 3, 2.7, 1, 1,
                wet, heavy, product("floor").id(), product("walls").id());
    }
    private ProjectDto project(List<RoomDto> rooms) {
        return new ProjectDto("postgres-test", "Проверка PostgreSQL", "Квартира", "Косметический",
                rooms, 10, false, "2026-10-24T00:00:00Z");
    }
    private void status(int code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode().value()).isEqualTo(code));
    }

    @Test void usesPostgresWithImportedCatalogAndNoMockIdentifiers() {
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).startsWith("PostgreSQL");
        assertThat(data.catalogCount()).isGreaterThan(80000);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM repaircalc.products WHERE id IN ('oak','paint','primer')", Long.class)).isZero();
        var initial = bootstrap.getBootstrap();
        assertThat(initial.products()).allMatch(p -> p.coverage() > 0);
        assertThat(initial.catalogTotal()).isEqualTo(data.catalogCount());
    }

    @Test void catalogPaginatesSortsAndFiltersAcrossTheWholeDatabase() {
        var first = data.catalog("", "all", "price-up", 0, 48, null);
        var second = data.catalog("", "all", "price-up", 1, 48, null);
        assertThat(first.products()).hasSize(48);
        assertThat(first.products()).extracting(ProductDto::id)
                .doesNotContainAnyElementsOf(second.products().stream().map(ProductDto::id).toList());
        assertThat(first.products().get(47).price()).isLessThanOrEqualTo(second.products().get(0).price());
        var sample = product("floor");
        assertThat(data.catalog(sample.id(), "floor", "recommended", 0, 48, List.of(sample.id())).products())
                .extracting(ProductDto::id).containsExactly(sample.id());
        assertThat(data.catalog("%", "all", "recommended", 0, 48, null).products())
                .allMatch(p -> p.name().contains("%") || p.brand().contains("%"));
        assertThat(data.catalog("", "all", "recommended", 0, 48, List.of("__empty__")).total()).isZero();
        status(400, () -> data.catalog("", "all", "recommended", -1, 48, null));
        status(400, () -> data.catalog("", "invalid", "recommended", 0, 48, null));
        status(400, () -> data.catalog("", "all", "recommended", 0, 101, null));
    }

    @Test void calculatesSaleUnitsWithExactDecimalMoney() {
        String id = product("floor").id();
        // Supplied calculable floor prices are whole rubles; exercise kopecks with a rolled-back fixture.
        jdbc.update("UPDATE repaircalc.products SET price=125.25 WHERE id=?", id);
        entityManager.clear();
        var p = data.getProduct(id);
        var result = products.calculateProduct(id, 19.7, 10);
        int expected = (int) Math.ceil(19.7 * 1.1 / p.coverage());
        assertThat(result.quantity()).isEqualTo(expected);
        assertThat(result.total()).isEqualByComparingTo(p.price().multiply(BigDecimal.valueOf(expected)));
        assertThat(result.unit()).isEqualTo(p.unit());
        assertThat(products.calculateProduct(id, 0, 10).quantity()).isZero();
    }

    @Test void rejectsUnknownCoverageAndInvalidProductCalculations() {
        String id = jdbc.queryForObject("SELECT id FROM repaircalc.products WHERE coverage=0 ORDER BY id LIMIT 1", String.class);
        status(422, () -> products.calculateProduct(id, 20, 10));
        status(404, () -> products.calculateProduct("missing-test-product", 20, 10));
        String floor = product("floor").id();
        status(400, () -> products.calculateProduct(floor, -1, 10));
        status(400, () -> products.calculateProduct(floor, Double.NaN, 10));
        status(400, () -> products.calculateProduct(floor, 20, 101));
    }

    @Test void roundsEachRoomBeforeAggregatingAndKeepsTotalsConsistent() {
        var r1 = room("one", 4.1, false, false);
        var r2 = room("two", 5.2, false, false);
        var estimate = calculations.calculateEstimate(project(List.of(r1, r2)));
        var floor = product("floor");
        var line = estimate.items().stream().filter(i -> i.product().id().equals(floor.id())).findFirst().orElseThrow();
        int quantity = (int) Math.ceil(4.1 * 3 * 1.1 / floor.coverage()) + (int) Math.ceil(5.2 * 3 * 1.1 / floor.coverage());
        assertThat(line.quantity()).isEqualTo(quantity);
        assertThat(line.cost()).isEqualByComparingTo(floor.price().multiply(BigDecimal.valueOf(quantity)));
        assertThat(estimate.materials()).isEqualByComparingTo(estimate.items().stream().map(EstimateItemDto::cost).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertThat(estimate.total()).isEqualByComparingTo(estimate.materials().add(estimate.labor()));
        assertThat(estimate.categories().stream().map(CategoryTotalDto::total).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo(estimate.materials());
    }

    @Test void wetAndHeavyRoomsUseOnlyCompatibleImportedMaterials() {
        var catalog = data.getProducts();
        var floor = catalog.stream().filter(p -> p.category().equals("floor") && p.wet() && p.heavy()).findFirst().orElseThrow();
        var wall = catalog.stream().filter(p -> p.category().equals("walls") && p.wet() && p.heavy()).findFirst().orElseThrow();
        var room = new RoomDto("wet", "Санузел", "bathroom", 3, 2, 2.7, 0, 1, true, true, floor.id(), wall.id());
        var estimate = calculations.calculateEstimate(project(List.of(room)));
        assertThat(estimate.items()).allMatch(i -> i.product().wet());
        var recommendations = ml.getRecommendations(new RecommendationInputDto(room, 10, "budget"));
        assertThat(recommendations.groups()).hasSize(2);
        recommendations.groups().forEach(group -> {
            assertThat(group.candidates()).allMatch(c -> {
                var p = catalog.stream().filter(item -> item.id().equals(c.productId())).findFirst().orElseThrow();
                return p.wet() && p.heavy() && p.coverage() > 0;
            });
        });
    }

    @Test void persistsProjectsAndFavoritesInPostgresAndReadsThemBack() {
        var saved = new WorkspaceDto(List.of(project(List.of(room("one", 4, false, false)))),
                List.of(data.catalog("", "other", "recommended", 0, 1, null).products().get(0).id()));
        workspace.saveWorkspace(saved);
        assertThat(jdbc.queryForObject("SELECT payload->'projects'->0->>'id' FROM repaircalc.app_workspace WHERE id=1", String.class)).isEqualTo("postgres-test");
        assertThat(workspace.getSavedWorkspace()).isEqualTo(saved);
        assertThat(bootstrap.getBootstrap().favorites()).isEqualTo(saved.favorites());
    }

    @Test void rejectsMalformedWorkspaceWithoutReplacingExistingData() {
        var before = workspace.getSavedWorkspace();
        var p = project(List.of(room("one", 4, false, false)));
        status(400, () -> workspace.saveWorkspace(new WorkspaceDto(List.of(p, p), List.of())));
        status(400, () -> workspace.saveWorkspace(new WorkspaceDto(List.of(p), List.of("same", "same"))));
        var malformed = new ProjectDto(p.id(), p.name(), p.object(), null, p.rooms(), 10, false, p.updatedAt());
        status(400, () -> workspace.saveWorkspace(new WorkspaceDto(List.of(malformed), List.of())));
        assertThat(workspace.getSavedWorkspace()).isEqualTo(before);
    }

    @Test void rejectsInvalidRoomDimensionsAndIncompatibleSelections() {
        status(400, () -> calculations.calculateEstimate(project(List.of(room("one", 0, false, false)))));
        var r = room("one", 4, false, false);
        var missing = new RoomDto(r.id(), r.name(), r.type(), 4, 3, 2.7, 1, 1, false, false, "oak", r.wall());
        status(422, () -> calculations.calculateEstimate(project(List.of(missing))));
        status(400, () -> ml.getRecommendations(new RecommendationInputDto(r, -10, "budget")));
    }
}
